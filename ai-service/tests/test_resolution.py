import pytest
from app.pipeline.resolution.config import ResolutionConfig
from app.pipeline.resolution.resolver import EntityResolver
from app.pipeline.resolution.fuzzy import compute_fuzzy_metrics, is_spelling_variation
from app.pipeline.resolution.acronyms import check_acronym_match, is_potential_acronym
from app.pipeline.resolution.guardrails import (
    should_reject_merge,
    is_type_compatible,
    is_contrastive_pair,
    has_distinctive_modifier_mismatch,
)
from app.schemas.resolution import EntityItem, ResolveEntitiesRequest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestObviousDuplicates:
    """Test resolution of exact matches, case variations, whitespace, and hyphens."""

    def test_exact_case_insensitive_match(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="Transformer", entity_type="method")
        e2 = EntityItem(text="transformer", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert canonical.lower() == "transformer"
        assert score == 1.0
        assert method == "exact"
        assert conf == 1.0
        assert dec.decision == "merged"
        assert dec.original_text == "Transformer"
        assert dec.candidate_text == "transformer"

    def test_hyphen_and_whitespace_variations(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="ResNet-50", entity_type="method")
        e2 = EntityItem(text="ResNet 50", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert score == 1.0
        assert method == "exact"

    def test_punctuation_and_trailing_whitespace(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="  Support Vector Machine  ", entity_type="method")
        e2 = EntityItem(text="Support Vector Machine.", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert score == 1.0
        assert method == "exact"


class TestSpellingVariations:
    """Test RapidFuzz similarity on spelling and morphological variants."""

    def test_graph_convolution_vs_convolutional_network(self):
        """User example: 'Graph Convolution Network' vs 'Graph Convolutional Network'."""
        resolver = EntityResolver()
        e1 = EntityItem(text="Graph Convolution Network", entity_type="method")
        e2 = EntityItem(text="Graph Convolutional Network", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert canonical in ("Graph Convolution Network", "Graph Convolutional Network")
        assert score >= 0.85
        assert method in ("rapidfuzz", "cosine_embedding", "hybrid")
        assert conf >= 0.80
        assert dec.decision == "merged"

    def test_multihead_attention_morphology(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="Multihead Self-Attention", entity_type="method")
        e2 = EntityItem(text="Multi-head Self Attention", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert score >= 0.85

    def test_minor_typo_resilience(self):
        metrics = compute_fuzzy_metrics("Convolutional Neural Network", "Convolutionl Neural Network")
        assert metrics["token_sort_ratio"] >= 0.90
        assert metrics["levenshtein"] >= 0.90


class TestAbbreviationsAndAcronyms:
    """Test scientific acronym expansion and initials matching."""

    def test_gcn_to_graph_convolutional_network(self):
        """User example: 'GCN' vs 'Graph Convolutional Network'."""
        resolver = EntityResolver()
        e1 = EntityItem(text="GCN", entity_type="method")
        e2 = EntityItem(text="Graph Convolutional Network", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert canonical == "Graph Convolutional Network"
        assert score >= 0.95
        assert method == "abbreviation"
        assert conf >= 0.90
        assert dec.decision == "merged"

    def test_gcn_to_graph_convolution_network(self):
        """User example: 'GCN' vs 'Graph Convolution Network'."""
        resolver = EntityResolver()
        e1 = EntityItem(text="GCN", entity_type="method")
        e2 = EntityItem(text="Graph Convolution Network", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert score >= 0.95
        assert method == "abbreviation"

    def test_bert_acronym(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="BERT", entity_type="method")
        e2 = EntityItem(text="Bidirectional Encoder Representations from Transformers", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is True
        assert canonical == "Bidirectional Encoder Representations from Transformers"
        assert method == "abbreviation"

    def test_dynamic_initials_matching(self):
        is_match, score, canonical, rationale = check_acronym_match("DQN", "Deep Q Network")
        assert is_match is True
        assert score >= 0.95


class TestUnrelatedTermsDoNotMerge:
    """Anti-merging tests: verify distinct scientific concepts are NOT merged."""

    def test_contrastive_models_bert_and_bart(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="BERT", entity_type="method")
        e2 = EntityItem(text="BART", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"
        assert "contrastive" in dec.rationale.lower() or "distinct" in dec.rationale.lower()

    def test_contrastive_optimizers_adam_and_adagrad(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="Adam", entity_type="method")
        e2 = EntityItem(text="AdaGrad", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"

    def test_distinctive_modifier_cnn_vs_gcn(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="CNN", entity_type="method")
        e2 = EntityItem(text="GCN", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"

    def test_distinctive_modifier_cnn_vs_graph_convolutional_network(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="Convolutional Neural Network", entity_type="method")
        e2 = EntityItem(text="Graph Convolutional Network", entity_type="method")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"
        assert "modifier mismatch" in dec.rationale.lower() or "graph" in dec.rationale.lower()

    def test_metrics_precision_vs_recall(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="Precision", entity_type="metric")
        e2 = EntityItem(text="Recall", entity_type="metric")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"

    def test_datasets_cifar10_vs_cifar100(self):
        resolver = EntityResolver()
        e1 = EntityItem(text="CIFAR-10", entity_type="dataset")
        e2 = EntityItem(text="CIFAR-100", entity_type="dataset")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"

    def test_entity_type_mismatch_guard(self):
        """Method 'F1' vs Metric 'F1-Score' must not merge if require_type_match is True."""
        resolver = EntityResolver(ResolutionConfig(require_type_match=True))
        e1 = EntityItem(text="Adam", entity_type="method")
        e2 = EntityItem(text="Adam", entity_type="dataset")
        should_merge, canonical, score, method, conf, dec = resolver.compare_pair(e1, e2)

        assert should_merge is False
        assert dec.decision == "rejected"
        assert "type mismatch" in dec.rationale.lower()


class TestBatchClusteringAndAuditTrail:
    """Test full batch resolution, clustering, and audit trail records."""

    def test_cluster_user_example_trio(self):
        """Cluster 'GCN', 'Graph Convolution Network', and 'Graph Convolutional Network'."""
        resolver = EntityResolver()
        entities = [
            EntityItem(id="ent-1", text="GCN", entity_type="method"),
            EntityItem(id="ent-2", text="Graph Convolution Network", entity_type="method"),
            EntityItem(id="ent-3", text="Graph Convolutional Network", entity_type="method"),
        ]
        resp = resolver.resolve_batch(entities)

        assert resp.unique_canonical_count == 1
        assert resp.merged_count >= 2
        assert len(resp.resolved_entities) == 3

        # All 3 resolve to same canonical concept
        canonicals = {r.canonical_entity for r in resp.resolved_entities}
        assert len(canonicals) == 1
        canon_name = next(iter(canonicals))
        assert "graph convolution" in canon_name.lower()

        # Audit trail must contain all decisions
        assert len(resp.audit_trail) >= 3
        for item in resp.resolved_entities:
            assert item.canonical_entity == canon_name
            assert item.similarity_score > 0.0
            assert item.resolution_method in ("exact", "abbreviation", "rapidfuzz", "cosine_embedding", "new_canonical")

    def test_configurable_threshold_stricter(self):
        """With very strict RapidFuzz threshold (0.99), subtle spelling difference is rejected."""
        strict_cfg = ResolutionConfig(
            rapidfuzz_token_sort_threshold=0.99,
            rapidfuzz_ratio_threshold=0.99,
            semantic_cosine_threshold=0.99,
            hybrid_min_confidence=0.99
        )
        resolver = EntityResolver(strict_cfg)
        e1 = EntityItem(text="Graph Convolution Network", entity_type="method")
        e2 = EntityItem(text="Graph Convolutional Network", entity_type="method")
        should_merge, _, score, _, _, _ = resolver.compare_pair(e1, e2, strict_cfg)

        # Under extreme 0.99 thresholds, should not merge
        assert should_merge is False


class TestResolutionAPIEndpoints:
    """Test FastAPI REST endpoints."""

    def test_resolve_endpoint(self):
        payload = {
            "entities": [
                {"id": "1", "text": "GCN", "entity_type": "method"},
                {"id": "2", "text": "Graph Convolutional Network", "entity_type": "method"},
            ]
        }
        res = client.post("/api/v1/resolution/resolve", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["unique_canonical_count"] == 1
        assert len(data["resolved_entities"]) == 2
        assert len(data["audit_trail"]) >= 1

    def test_compare_endpoint(self):
        payload = {
            "entity_a": {"text": "BERT", "entity_type": "method"},
            "entity_b": {"text": "BART", "entity_type": "method"},
        }
        res = client.post("/api/v1/resolution/compare", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["should_merge"] is False
        assert data["decision"]["decision"] == "rejected"

    def test_get_config_endpoint(self):
        res = client.get("/api/v1/resolution/config")
        assert res.status_code == 200
        data = res.json()
        assert "exact_match_threshold" in data
        assert "rapidfuzz_token_sort_threshold" in data
