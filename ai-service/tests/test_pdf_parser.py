"""
Stage 5 Tests: PDF Parser
=========================
Creates real PDF files programmatically using PyMuPDF and tests the parser.
No external sample files needed.
"""
from __future__ import annotations

import uuid
import shutil
import tempfile
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Helpers: create minimal PDFs in-memory via PyMuPDF
# ---------------------------------------------------------------------------

def _make_pdf(tmpdir: Path, content: str, filename: str = "test_paper.pdf") -> Path:
    """Create a real PDF with the given text content and return its path."""
    import fitz

    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    # Write the content as text on the page (with line wrapping)
    lines = content.split("\n")
    y = 72  # start position
    for line in lines:
        page.insert_text(
            (72, y),
            line,
            fontsize=10,
            color=(0, 0, 0),
        )
        y += 14
        if y > 800:
            # add another page if content is long
            page = doc.new_page(width=595, height=842)
            y = 72

    path = tmpdir / filename
    doc.save(str(path))
    doc.close()
    return path


def _make_multipage_pdf(tmpdir: Path) -> Path:
    """Create a multi-page PDF with realistic section headings."""
    import fitz

    PAGES = [
        # Page 1 — Title & Abstract
        (
            "Attention Is All You Need\n"
            "A. Vaswani, N. Shazeer, et al.\n\n"
            "Abstract\n"
            "We propose the Transformer, a model architecture based solely on "
            "attention mechanisms. Our model achieves state-of-the-art results "
            "on machine translation tasks."
        ),
        # Page 2 — Introduction
        (
            "1. Introduction\n"
            "Recurrent neural networks have long dominated sequence modelling. "
            "However, they struggle with long-range dependencies. "
            "We introduce a fully attentional architecture that removes recurrence."
        ),
        # Page 3 — Methods
        (
            "2. Model Architecture\n"
            "The Transformer uses stacked self-attention and fully-connected layers "
            "in both encoder and decoder. Multi-head attention allows the model to "
            "jointly attend to information from different subspaces."
        ),
        # Page 4 — Results
        (
            "3. Results\n"
            "On WMT 2014 English-German we achieve 28.4 BLEU, outperforming all "
            "previous models. On English-French we achieve 41.0 BLEU."
        ),
        # Page 5 — Limitations & Future Work
        (
            "4. Limitations\n"
            "Our model assumes a fixed input length and may not scale efficiently "
            "to very long sequences without modifications.\n\n"
            "5. Future Work\n"
            "We plan to extend the Transformer to other tasks such as image and "
            "audio processing."
        ),
    ]

    doc = fitz.open()
    for page_text in PAGES:
        page = doc.new_page(width=595, height=842)
        y = 72
        for line in page_text.split("\n"):
            page.insert_text((72, y), line, fontsize=10, color=(0, 0, 0))
            y += 16

    path = tmpdir / "multipage_paper.pdf"
    doc.save(str(path))
    doc.close()
    return path


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_pdf_dir(tmp_path: Path):
    yield tmp_path


@pytest.fixture
def sample_paper_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Unit tests: pdf_parser
# ---------------------------------------------------------------------------

class TestPdfParserImport:
    """Ensure the module is importable."""

    def test_import_pdf_parser(self):
        from app.extraction import pdf_parser  # noqa: F401

    def test_import_parse_pdf_function(self):
        from app.extraction.pdf_parser import parse_pdf
        assert callable(parse_pdf)

    def test_import_validate_pdf_file_function(self):
        from app.extraction.pdf_parser import validate_pdf_file
        assert callable(validate_pdf_file)


class TestValidatePdfFile:
    """Tests for the quick-validation helper."""

    def test_validate_real_pdf(self, tmp_pdf_dir, sample_paper_id):
        pdf_path = _make_pdf(tmp_pdf_dir, "Hello world PDF test", "valid.pdf")
        from app.extraction.pdf_parser import validate_pdf_file
        result = validate_pdf_file(pdf_path)
        assert result["valid"] is True
        assert result["pages"] >= 1
        assert result["error"] is None

    def test_validate_missing_file(self, tmp_pdf_dir):
        from app.extraction.pdf_parser import validate_pdf_file
        result = validate_pdf_file(tmp_pdf_dir / "does_not_exist.pdf")
        assert result["valid"] is False
        assert result["error"] is not None

    def test_validate_non_pdf_extension(self, tmp_pdf_dir):
        """A .txt file with PDF magic bytes passes byte check but fails open."""
        # Actually use a non-pdf file written as plaintext
        txt = tmp_pdf_dir / "paper.txt"
        txt.write_text("this is not a pdf")
        from app.extraction.pdf_parser import validate_pdf_file
        result = validate_pdf_file(txt)
        # Must fail — either bad magic bytes or cannot open as PDF
        assert result["valid"] is False

    def test_validate_corrupt_pdf(self, tmp_pdf_dir):
        """Write fake PDF magic bytes followed by garbage."""
        bad = tmp_pdf_dir / "corrupt.pdf"
        bad.write_bytes(b"%PDF-garbage-not-real")
        from app.extraction.pdf_parser import validate_pdf_file
        result = validate_pdf_file(bad)
        # May or may not open depending on PyMuPDF tolerance; either valid or not
        # Just ensure it doesn't raise an exception
        assert isinstance(result["valid"], bool)


class TestParsePdf:
    """Tests for the full parse_pdf function."""

    def test_parse_single_page_pdf(self, tmp_pdf_dir, sample_paper_id):
        content = (
            "Abstract\n"
            "This paper proposes a new method for testing PDF parsers "
            "in a fully automated fashion without needing real academic papers."
        )
        pdf_path = _make_pdf(tmp_pdf_dir, content)
        from app.extraction.pdf_parser import parse_pdf
        result = parse_pdf(paper_id=sample_paper_id, file_path=pdf_path)

        assert result.paper_id == sample_paper_id
        assert result.total_pages == 1
        assert result.total_segments >= 1

    def test_parse_result_segment_provenance(self, tmp_pdf_dir, sample_paper_id):
        """Every segment must carry the correct paper_id and page_number."""
        content = "Introduction\nThis is an introductory paragraph about the research."
        pdf_path = _make_pdf(tmp_pdf_dir, content)
        from app.extraction.pdf_parser import parse_pdf
        result = parse_pdf(paper_id=sample_paper_id, file_path=pdf_path)

        for seg in result.segments:
            assert seg.paper_id == sample_paper_id, "paper_id mismatch in segment"
            assert seg.page_number >= 1, "page_number must be ≥ 1"
            assert isinstance(seg.text, str) and len(seg.text) >= 1
            assert seg.section_type in (
                "abstract", "introduction", "related_work", "methods",
                "results", "limitations", "future_work", "conclusion", "other",
            )

    def test_parse_multipage_pdf_section_detection(self, tmp_pdf_dir, sample_paper_id):
        """Multi-page PDF should detect multiple sections."""
        pdf_path = _make_multipage_pdf(tmp_pdf_dir)
        from app.extraction.pdf_parser import parse_pdf
        result = parse_pdf(paper_id=sample_paper_id, file_path=pdf_path)

        assert result.total_pages == 5
        assert result.total_segments >= 3, "Expected at least 3 distinct sections"
        # Should detect at least abstract OR introduction
        detected = set(result.sections_detected)
        assert len(detected) >= 2, f"Expected multiple sections, got: {detected}"

    def test_parse_returns_word_counts(self, tmp_pdf_dir, sample_paper_id):
        """TextSegment word_count and char_count should be populated."""
        content = "Results\nWe achieved 95 percent accuracy on the benchmark dataset."
        pdf_path = _make_pdf(tmp_pdf_dir, content)
        from app.extraction.pdf_parser import parse_pdf
        result = parse_pdf(paper_id=sample_paper_id, file_path=pdf_path)

        for seg in result.segments:
            assert seg.word_count > 0
            assert seg.char_count > 0

    def test_parse_missing_file_raises(self, tmp_pdf_dir, sample_paper_id):
        from app.extraction.pdf_parser import parse_pdf
        with pytest.raises(FileNotFoundError):
            parse_pdf(sample_paper_id, tmp_pdf_dir / "missing.pdf")

    def test_parse_non_pdf_raises(self, tmp_pdf_dir, sample_paper_id):
        txt = tmp_pdf_dir / "paper.txt"
        txt.write_text("not a pdf")
        from app.extraction.pdf_parser import parse_pdf
        with pytest.raises(ValueError, match="not a PDF"):
            parse_pdf(sample_paper_id, txt)

    def test_parse_metadata_contains_filename(self, tmp_pdf_dir, sample_paper_id):
        content = "Abstract\nShort paper for metadata test."
        pdf_path = _make_pdf(tmp_pdf_dir, content, "my_paper.pdf")
        from app.extraction.pdf_parser import parse_pdf
        result = parse_pdf(paper_id=sample_paper_id, file_path=pdf_path)

        assert result.metadata.get("filename") == "my_paper.pdf"
        assert result.metadata.get("file_size_bytes", 0) > 0


class TestTextSegmentSchema:
    """Pydantic schema tests for TextSegment."""

    def test_text_segment_auto_counts(self):
        from app.schemas.pipeline import TextSegment
        seg = TextSegment(
            paper_id="abc-123",
            page_number=1,
            section_type="introduction",
            text="Hello world this is a test",
        )
        assert seg.word_count == 6
        assert seg.char_count == 26

    def test_parse_result_schema(self):
        from app.schemas.pipeline import ParseResult, TextSegment
        seg = TextSegment(
            paper_id="abc-123",
            page_number=2,
            section_type="results",
            heading="3. Results",
            text="We achieved state of the art results.",
        )
        result = ParseResult(
            paper_id="abc-123",
            total_pages=5,
            total_segments=1,
            sections_detected=["results"],
            segments=[seg],
        )
        assert result.total_segments == 1
        assert result.segments[0].section_type == "results"
        assert result.segments[0].heading == "3. Results"
