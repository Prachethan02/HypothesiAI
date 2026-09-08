"""
HypothesiAI — Stage 5: Modular PDF Parser
==========================================
Parses a PDF file into structured TextSegment objects.
Each segment retains full provenance: paper_id, page_number,
section_type, heading, and raw text.

Strategy:
  1. Open PDF with PyMuPDF (fitz).
  2. Extract text page-by-page.
  3. Detect section boundaries using keyword heuristics on
     heading-like lines (short lines, uppercase or title-case).
  4. Accumulate text under the current section label.
  5. Return a ParseResult containing all TextSegments.

DistilBERT NER is explicitly excluded — that is Stage 6.
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Section keyword map — order matters (more specific first)
# ---------------------------------------------------------------------------
SECTION_KEYWORDS: list[tuple[str, list[str]]] = [
    ("abstract",      ["abstract"]),
    ("introduction",  ["introduction", "background"]),
    ("related_work",  ["related work", "literature review", "prior work", "survey"]),
    ("methods",       ["method", "methodology", "approach", "proposed", "model", "architecture",
                       "experimental setup", "experiment"]),
    ("results",       ["result", "evaluation", "performance", "comparison", "analysis",
                       "findings", "discussion"]),
    ("limitations",   ["limitation", "weakness", "shortcoming", "constraint"]),
    ("future_work",   ["future work", "future direction", "open problem",
                       "next step", "outlook", "conclusion and future"]),
    ("conclusion",    ["conclusion", "summary", "closing"]),
]

# Regex: a heading is a "short" line (≤ 80 chars) that may start with
# a section number like "1.", "2.1", "A.", or just be mostly uppercase/title-case.
_HEADING_RE = re.compile(
    r"^(?:(?:\d+(?:\.\d+)*|[A-Z])[\.\)]\s*)?(.{3,80})$"
)
_NUMBERED_HEADING_RE = re.compile(r"^\s*\d+(?:\.\d+)*[\.\)]\s+\w")


# ---------------------------------------------------------------------------
# Dataclasses (internal — Pydantic models are in schemas/pipeline.py)
# ---------------------------------------------------------------------------

@dataclass
class RawSegment:
    """Internal representation before converting to Pydantic model."""
    paper_id: str
    page_number: int
    section_type: str
    heading: Optional[str]
    lines: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return " ".join(line for line in self.lines if line.strip())


# ---------------------------------------------------------------------------
# Section detection helpers
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Lower-case, strip, collapse whitespace."""
    return re.sub(r"\s+", " ", text.lower().strip())


def _detect_section(line: str) -> Optional[str]:
    """
    Return a section_type key if the line is recognised as a section heading.
    Returns None if the line is not a heading.
    """
    norm = _normalise(line)
    # Remove leading numbering for matching (e.g., "2. Related Work" → "related work")
    norm_clean = re.sub(r"^\d+(?:\.\d+)*[\.\)]\s*", "", norm)

    for section_type, keywords in SECTION_KEYWORDS:
        for kw in keywords:
            if norm_clean.startswith(kw) or norm_clean == kw:
                return section_type
    return None


def _is_likely_heading(line: str) -> bool:
    """
    Heuristic: a line is a candidate heading if it is:
    - Short (≤ 80 characters after stripping)
    - Starts with a number+dot pattern OR is mostly title/uppercase
    - Not a sentence (no period mid-string before length 60)
    """
    stripped = line.strip()
    if not stripped or len(stripped) > 80:
        return False
    if _NUMBERED_HEADING_RE.match(stripped):
        return True
    # Title-case heuristic: most words start with uppercase
    words = stripped.split()
    if len(words) >= 2:
        upper_count = sum(1 for w in words if w and w[0].isupper())
        if upper_count / len(words) >= 0.7 and len(words) <= 8:
            return True
    # ALL CAPS short line
    if stripped.isupper() and 3 <= len(stripped) <= 60:
        return True
    return False


# ---------------------------------------------------------------------------
# Core parser
# ---------------------------------------------------------------------------

def parse_pdf(paper_id: str, file_path: str | Path) -> "ParseResult":
    """
    Parse a PDF file and return a ParseResult with TextSegments.

    Args:
        paper_id: The UUID of the paper record (for provenance).
        file_path: Absolute or relative path to the PDF file.

    Returns:
        ParseResult with all extracted TextSegments.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file is not a valid PDF or has no extractable text.
    """
    # Import here so the module is importable even when PyMuPDF is not installed
    # (allows unit tests to mock it)
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ImportError(
            "PyMuPDF (fitz) is required for PDF parsing. "
            "Install it with: pip install PyMuPDF"
        ) from exc

    # Import Pydantic models
    from app.schemas.pipeline import ParseResult, TextSegment  # noqa: PLC0415

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"File is not a PDF: {path.name}")

    warnings: list[str] = []

    try:
        doc = fitz.open(str(path))
    except Exception as exc:
        raise ValueError(f"Cannot open PDF — possibly corrupt: {exc}") from exc

    total_pages = len(doc)
    if total_pages == 0:
        raise ValueError("PDF has no pages.")

    logger.info("Parsing PDF: paper_id=%s  pages=%d  file=%s", paper_id, total_pages, path.name)

    # ------------------------------------------------------------------
    # Phase 1: Collect per-page text lines
    # ------------------------------------------------------------------
    segments: list[RawSegment] = []
    current_section: str = "other"
    current_heading: Optional[str] = None
    current_segment: Optional[RawSegment] = None

    def _flush_segment() -> None:
        nonlocal current_segment
        if current_segment and current_segment.lines:
            text = current_segment.text.strip()
            if text:
                segments.append(current_segment)
        current_segment = None

    for page_idx in range(total_pages):
        page_num = page_idx + 1
        page = doc[page_idx]

        # Extract text as a list of text blocks, then lines
        try:
            raw_text = page.get_text("text")  # plain text, preserves layout order
        except Exception as exc:
            warnings.append(f"Page {page_num}: text extraction failed — {exc}")
            continue

        lines = raw_text.split("\n")

        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue

            # Check if this line is a section heading
            if _is_likely_heading(line_stripped):
                detected = _detect_section(line_stripped)
                if detected:
                    # Start a new segment for the new section
                    _flush_segment()
                    current_section = detected
                    current_heading = line_stripped
                    current_segment = RawSegment(
                        paper_id=paper_id,
                        page_number=page_num,
                        section_type=current_section,
                        heading=current_heading,
                    )
                    logger.debug("  → Section detected: [%s] '%s' on page %d",
                                 detected, line_stripped, page_num)
                    continue
                # It's a heading-like line but not a known section;
                # treat it as a paragraph separator — flush and continue in same section
                # (Don't break the current segment)

            # Regular text line: ensure we have an active segment
            if current_segment is None or current_segment.page_number != page_num:
                # Page boundary — start new segment, keep current section
                _flush_segment()
                current_segment = RawSegment(
                    paper_id=paper_id,
                    page_number=page_num,
                    section_type=current_section,
                    heading=None,
                )

            current_segment.lines.append(line_stripped)

    # Flush the last segment
    _flush_segment()
    doc.close()

    # ------------------------------------------------------------------
    # Phase 2: Validate & convert to Pydantic TextSegment models
    # ------------------------------------------------------------------
    if not segments:
        warnings.append("No text segments extracted — the PDF may be scanned/image-only.")

    pydantic_segments: list[TextSegment] = []
    for seg in segments:
        text = seg.text.strip()
        if len(text) < 10:
            continue  # Skip near-empty segments (noise/headers/footers)
        pydantic_segments.append(
            TextSegment(
                paper_id=seg.paper_id,
                page_number=seg.page_number,
                section_type=seg.section_type,
                heading=seg.heading,
                text=text,
            )
        )

    sections_detected = sorted(set(s.section_type for s in pydantic_segments))

    logger.info(
        "Parsing complete: paper_id=%s  segments=%d  sections=%s",
        paper_id, len(pydantic_segments), sections_detected,
    )

    return ParseResult(
        paper_id=paper_id,
        total_pages=total_pages,
        total_segments=len(pydantic_segments),
        sections_detected=sections_detected,
        segments=pydantic_segments,
        metadata={
            "filename": path.name,
            "file_size_bytes": path.stat().st_size,
        },
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Validation helpers (used by the API endpoint)
# ---------------------------------------------------------------------------

def validate_pdf_file(file_path: str | Path) -> dict:
    """
    Quick validation without full parse: checks magic bytes, size, and page count.
    Returns dict with keys: valid (bool), pages (int|None), error (str|None).
    """
    try:
        import fitz
    except ImportError:
        return {"valid": False, "pages": None, "error": "PyMuPDF not installed"}

    path = Path(file_path)

    # Check PDF magic bytes
    try:
        with open(path, "rb") as f:
            header = f.read(5)
        if header != b"%PDF-":
            return {"valid": False, "pages": None, "error": "File is not a valid PDF (bad magic bytes)"}
    except OSError as e:
        return {"valid": False, "pages": None, "error": str(e)}

    # Check page count
    try:
        doc = fitz.open(str(path))
        page_count = len(doc)
        doc.close()
        if page_count == 0:
            return {"valid": False, "pages": 0, "error": "PDF has no pages"}
        return {"valid": True, "pages": page_count, "error": None}
    except Exception as e:
        return {"valid": False, "pages": None, "error": f"Cannot open PDF: {e}"}
