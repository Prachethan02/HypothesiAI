"""
Stage 6 Tests: Research Information Extraction
==============================================
Tests structured extraction of methods, datasets, metrics, concepts,
findings, limitations, future work, objectives, and study population/domain.
Verifies exact provenance retention (paper_id, page_number, section, source_reference).
"""
from __future__ import annotations

import pytest
import httpx
from app.main import app
from app.schemas.pipeline import TextSegment
from app.schemas.extraction import ExtractedEntitySchema
from app.extraction.pattern_extractor import PatternHeuristicExtractor
from app.extraction.distilbert_extractor import DistilBertExtractor
from app.extraction.information_extractor import ResearchInformationExtractor
from app.extraction.base import normalize_entity_name, build_source_reference

SAMPLE_SEGMENTS = [
    TextSegment(
        paper_id="paper-101",
        page_number=1,
        section_type="abstract",
        heading="Abstract",
        text=(
            "This paper presents a novel Graph Attention Network for biomedical drug discovery. "
            "Our primary objective is to predict drug-target interactions with high precision. "
            "We evaluate our model on the PubMed benchmark dataset and compare it against standard SVM baselines."
        ),
    ),
    TextSegment(
        paper_id="paper-101",
        page_number=2,
        section_type="methods",
        heading="2. Methodology",
        text=(
            "We construct a multi-relational knowledge graph using the Transformer architecture. "
            "The study population comprises 1,200 clinical patients collected across two hospitals. "
            "Models are trained using AdamW optimization with contrastive learning objectives."
        ),
    ),
    TextSegment(
        paper_id="paper-101",
        page_number=3,
        section_type="results",
        heading="3. Empirical Results",
        text=(
            "Our results demonstrate that the proposed architecture achieves 94.5% accuracy "
            "and an AUC-ROC of 0.98. It significantly outperforms prior GCN approaches across all metrics."
        ),
    ),
    TextSegment(
        paper_id="paper-101",
        page_number=4,
        section_type="limitations",
        heading="4. Limitations",
        text=(
            "A key limitation of our method is the computational overhead when scaling to graphs "
            "with over ten million edges. Our framework struggles with noisy protein interaction data."
        ),
    ),
    TextSegment(
        paper_id="paper-101",
        page_number=4,
        section_type="future_work",
        heading="5. Future Work",
        text=(
            "In future work, we plan to integrate multi-modal molecular structures and explore "
            "diffusion models for de novo molecular generation."
        ),
    ),
]


class TestBaseHelpers:
    """Test helper functions."""

    def test_normalize_entity_name(self):
        assert normalize_entity_name(' "Transformer" ') == "Transformer"
        assert normalize_entity_name("BLEU") == "BLEU"
        assert normalize_entity_name("Deep Neural Networks") == "deep neural networks"
        assert normalize_entity_name("(Accuracy).") == "accuracy"

    def test_build_source_reference(self):
        ref = build_source_reference("methods", 2, "2. Methodology")
        assert "Section: Methods (2. Methodology)" in ref
        assert "Page 2" in ref

        ref_no_heading = build_source_reference("limitations", 4)
        assert ref_no_heading == "Section: Limitations, Page 4"


class TestPatternExtractor:
    """Tests for PatternHeuristicExtractor."""

    @pytest.fixture
    def extractor(self):
        return PatternHeuristicExtractor()

    def test_extracts_methods(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        methods = [e for e in entities if e.entity_type == "method"]
        assert len(methods) >= 1
        method_texts = [m.text.lower() for m in methods]
        assert any("transformer" in t or "graph attention network" in t or "svm" in t for t in method_texts)

    def test_extracts_datasets(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        datasets = [e for e in entities if e.entity_type == "dataset"]
        assert len(datasets) >= 1
        assert any("pubmed" in d.text.lower() for d in datasets)

    def test_extracts_metrics(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        metrics = [e for e in entities if e.entity_type == "metric"]
        assert len(metrics) >= 1
        metric_texts = [m.text.lower() for m in metrics]
        assert any("accuracy" in m or "auc-roc" in m or "auc" in m for m in metric_texts)

    def test_extracts_objectives(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        objectives = [e for e in entities if e.entity_type == "objective"]
        assert len(objectives) >= 1
        assert any("predict drug-target interactions" in o.text.lower() or "objective" in o.text.lower() for o in objectives)

    def test_extracts_limitations(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        limitations = [e for e in entities if e.entity_type == "limitation"]
        assert len(limitations) >= 1
        assert any("limitation" in l.text.lower() or "computational overhead" in l.text.lower() for l in limitations)

    def test_extracts_future_work(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        future_works = [e for e in entities if e.entity_type == "future_work"]
        assert len(future_works) >= 1
        assert any("future work" in f.text.lower() or "diffusion models" in f.text.lower() for f in future_works)

    def test_extracts_findings(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        findings = [e for e in entities if e.entity_type == "finding"]
        assert len(findings) >= 1
        assert any("results demonstrate" in f.text.lower() or "achieves" in f.text.lower() for f in findings)

    def test_extracts_population_and_domain(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        pop_domain = [e for e in entities if e.entity_type == "population_domain"]
        assert len(pop_domain) >= 1
        texts = [p.text.lower() for p in pop_domain]
        assert any("biomedical" in t or "patients" in t for t in texts)

    def test_provenance_retention(self, extractor):
        """Every extracted entity must include valid paper_id, page_number, section, and source_reference."""
        entities = extractor.extract(SAMPLE_SEGMENTS)
        assert len(entities) > 0
        for e in entities:
            assert e.paper_id == "paper-101"
            assert e.page_number is not None and e.page_number >= 1
            assert len(e.section) > 0
            assert len(e.source_reference) > 0
            assert "Page" in e.source_reference
            assert 0.0 <= e.confidence <= 1.0


class TestDistilBertExtractor:
    """Tests for DistilBertExtractor."""

    @pytest.fixture
    def extractor(self):
        return DistilBertExtractor()

    def test_extractor_name(self, extractor):
        assert "distilbert" in extractor.name

    def test_distilbert_extracts_entities(self, extractor):
        entities = extractor.extract(SAMPLE_SEGMENTS)
        assert len(entities) > 0
        for e in entities:
            assert e.paper_id == "paper-101"
            assert e.page_number is not None


class TestResearchInformationExtractor:
    """Tests for the master ResearchInformationExtractor."""

    @pytest.fixture
    def master_extractor(self):
        return ResearchInformationExtractor()

    def test_extract_from_segments_produces_result(self, master_extractor):
        result = master_extractor.extract_from_segments("paper-101", SAMPLE_SEGMENTS)
        assert result.paper_id == "paper-101"
        assert result.total_entities > 0
        assert len(result.entities) == result.total_entities

        # Verify multiple entity types detected
        types_detected = set(result.entity_counts.keys())
        expected_types = {"method", "dataset", "metric", "objective", "limitation", "future_work"}
        assert len(types_detected.intersection(expected_types)) >= 3

    def test_deduplication(self, master_extractor):
        """Duplicate entities in the same section and page should be merged."""
        duplicated_segments = [SAMPLE_SEGMENTS[0], SAMPLE_SEGMENTS[0]]
        result = master_extractor.extract_from_segments("paper-101", duplicated_segments)
        # Check no exact duplicates exist in result
        keys = [f"{e.entity_type}::{e.normalized_name}::{e.section}::{e.page_number}" for e in result.entities]
        assert len(keys) == len(set(keys))


@pytest.mark.asyncio
class TestExtractionEndpoint:
    """Integration test for POST /api/v1/extraction/extract."""

    async def test_extract_endpoint_success(self):
        payload = {
            "paper_id": "api-paper-test-01",
            "segments": [
                {
                    "paper_id": "api-paper-test-01",
                    "page_number": 1,
                    "section_type": "methods",
                    "heading": "Methodology",
                    "text": "We evaluate our Transformer on the WMT benchmark dataset using BLEU score.",
                }
            ],
            "enable_neural": True,
        }

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/extraction/extract", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["paper_id"] == "api-paper-test-01"
            assert data["total_entities"] >= 1
            assert len(data["entities"]) == data["total_entities"]

    async def test_extract_endpoint_empty_segments_fails(self):
        payload = {
            "paper_id": "api-paper-test-02",
            "segments": [],
        }
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/extraction/extract", json=payload)
            assert resp.status_code == 400
