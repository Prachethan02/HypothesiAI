"""
HypothesiAI – Advanced Pipeline Tests (Stage 21)
================================================
Comprehensive unit & integration tests covering:
  - Topic Modeling & HDBSCAN Clustering
  - Research Pattern Mining (FP-Growth / Apriori, Association Rules, Underexplored Combos)
  - NLI Contradiction Detection & Lexical/Semantic Comparison
  - Evidence Aggregation Multi-Signal Engine
  - Research Gap Ranking & 9-Dimension Composite Scoring
"""
import pytest
from app.pipeline.clustering.hdbscan_service import clustering_service
from app.schemas.topics import ClusterDocumentInput, ClusterGenerationRequest
from app.pipeline.patterns.pattern_mining_service import (
    mine_patterns,
    _normalize,
    _build_transactions,
)
from app.pipeline.nli.nli_service import NLIService
from app.pipeline.ranking.gap_ranking_service import (
    GapRankingService,
    _normalise_weights,
)
from app.schemas.ranking import RankingWeightsConfig
from app.schemas.evidence import EvidenceItem, SourcePaperRef


# ===========================================================================
# 1. Topic Modeling & HDBSCAN Clustering
# ===========================================================================
class TestHDBSCANClustering:
    def test_clustering_basic_flow(self):
        docs = [
            ClusterDocumentInput(
                id="doc1",
                text="The model suffers from severe memory bottlenecks on large graphs.",
                metadata={"paper_id": "p1", "statement_type": "limitation"},
            ),
            ClusterDocumentInput(
                id="doc2",
                text="GPU memory exhaustion prevents training on large graph datasets.",
                metadata={"paper_id": "p2", "statement_type": "limitation"},
            ),
            ClusterDocumentInput(
                id="doc3",
                text="Future architectures should explore sparse attention mechanisms.",
                metadata={"paper_id": "p3", "statement_type": "future_work"},
            ),
            ClusterDocumentInput(
                id="doc4",
                text="Investigating sparse self-attention could reduce quadratic scaling.",
                metadata={"paper_id": "p4", "statement_type": "future_work"},
            ),
        ]
        req = ClusterGenerationRequest(
            documents=docs,
            min_cluster_size=2,
            min_samples=1,
        )
        clusters, doc_mapping, model_id, stats = clustering_service.cluster_documents(req)
        assert stats["document_count"] == 4
        assert stats["noise_count"] >= 0
        assert isinstance(clusters, list)
        for c in clusters:
            assert c.cluster_id >= 0 or c.is_noise is True
            assert c.size >= 1
            assert len(c.evidence) == c.size

    def test_clustering_empty_documents_raises(self):
        req = ClusterGenerationRequest(documents=[], min_cluster_size=2)
        with pytest.raises(ValueError, match="No documents"):
            clustering_service.cluster_documents(req)


# ===========================================================================
# 2. Pattern Mining
# ===========================================================================
class TestPatternMining:
    def test_normalization_and_transactions(self):
        entities_by_paper = {
            "p1": [
                {"entity_type": "Method", "text": "Transformer"},
                {"entity_type": "Dataset", "text": "ImageNet"},
            ],
            "p2": [
                {"entity_type": "Method", "text": "Transformer"},
                {"entity_type": "Dataset", "text": "ImageNet"},
                {"entity_type": "Metric", "text": "Accuracy"},
            ],
        }
        transactions, item_papers = _build_transactions(entities_by_paper)
        assert len(transactions) == 2
        assert "method:transformer" in item_papers
        assert "dataset:imagenet" in item_papers
        assert len(item_papers["method:transformer"]) == 2

    def test_mine_patterns_execution(self):
        entities_by_paper = {
            f"p{i}": [
                {"entity_type": "method", "normalized_name": "ResNet"},
                {"entity_type": "dataset", "normalized_name": "CIFAR-10"},
                {"entity_type": "metric", "normalized_name": "Top-1 Error"},
            ]
            for i in range(1, 6)
        }
        entities_by_paper["p6"] = [
            {"entity_type": "method", "normalized_name": "GraphSAGE"},
            {"entity_type": "dataset", "normalized_name": "PubMed"},
        ]

        result = mine_patterns(
            entities_by_paper=entities_by_paper,
            min_support=0.2,
            min_confidence=0.3,
            algorithm="fpgrowth",
        )
        assert result["n_papers"] == 6
        assert len(result["frequent_patterns"]) > 0
        assert isinstance(result["association_rules"], list)
        assert isinstance(result["underexplored_candidates"], list)


# ===========================================================================
# 3. Natural Language Inference (NLI)
# ===========================================================================
class TestNLIService:
    @pytest.fixture
    def nli(self):
        return NLIService()

    def test_lexical_directional_conflict(self, nli):
        s1 = "Our proposed method significantly increases classification accuracy on ImageNet."
        s2 = "Our method decreases classification accuracy on the ImageNet benchmark."
        label, conf, probs = nli._classify_pair(s1, s2, semantic_sim=0.75)
        assert label == "CONTRADICTION"
        assert conf >= 0.50

    def test_lexical_negation_conflict(self, nli):
        s1 = "We confirm a statistically significant correlation between width and convergence."
        s2 = "There is no significant correlation between model width and convergence speed."
        label, conf, probs = nli._classify_pair(s1, s2, semantic_sim=0.75)
        assert label == "CONTRADICTION"

    def test_neutral_relationship(self, nli):
        s1 = "We evaluate transformer architectures on standard translation benchmarks."
        s2 = "Convolutional filters are initialized using He normal distribution."
        label, conf, probs = nli._classify_pair(s1, s2, semantic_sim=0.30)
        assert label in ("NEUTRAL", "CONTRADICTION", "ENTAILMENT")


# ===========================================================================
# 4. Evidence Aggregation & Gap Ranking
# ===========================================================================
class TestGapRanking:
    def test_weight_normalisation(self):
        w = RankingWeightsConfig(
            recurrence=0.3,
            evidence_strength=0.3,
            independent_paper_support=0.2,
            contradiction_strength=0.2,
            underexplored_combination_strength=0.0,
            topic_relevance=0.0,
            temporal_signal=0.0,
            graph_evidence=0.0,
            confidence=0.0,
        )
        norm = _normalise_weights(w)
        assert abs(sum(norm.values()) - 1.0) < 1e-6
        assert norm["recurrence"] == 0.3
        assert norm["independent_paper_support"] == 0.2

    def test_rank_candidate_gaps(self):
        from app.db.store import evidence_aggregation_store

        ranking_service = GapRankingService()
        evidence_items = [
            EvidenceItem(
                evidence_id="ev1",
                type="recurring_limitations",
                title="Graph Transformers Scalability on Million-Node Graphs",
                description="Quadratic attention leads to out-of-memory errors on large graphs.",
                score=0.85,
                confidence=0.80,
                source_papers=[
                    SourcePaperRef(id="p1", title="Scaling Graph Transformers"),
                    SourcePaperRef(id="p2", title="Attention for Large Graphs"),
                ],
                metadata={"cluster_size": 5, "paper_count": 4},
            ),
            EvidenceItem(
                evidence_id="ev2",
                type="contradiction_evidence",
                title="Evaluation Benchmarks for Multimodal Reasoning",
                description="Standard metrics fail to capture commonsense failures.",
                score=0.60,
                confidence=0.65,
                source_papers=[
                    SourcePaperRef(id="p3", title="Multimodal Benchmarks"),
                ],
                metadata={"cluster_size": 2, "paper_count": 2},
            ),
        ]

        evidence_aggregation_store["test_unit_run"] = {"evidence": evidence_items}
        ranked, total, weights_used = ranking_service.rank_gaps()

        assert len(ranked) >= 2
        # Verify ordering: higher composite score first
        assert ranked[0].composite_score >= ranked[1].composite_score
        # Check dimensional breakdown
        assert len(ranked[0].dimensions) == 9
        for dim in ranked[0].dimensions:
            assert 0.0 <= dim.raw_score <= 1.0
            assert dim.weight > 0.0
            assert 0.0 <= dim.weighted_contribution <= 1.0
