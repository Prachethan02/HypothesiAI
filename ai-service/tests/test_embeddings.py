"""
Stage 7 Tests: Semantic Embedding Generation & Cosine Similarity
================================================================
Tests the MiniLM embedding service, batching, unit vector normalization,
hash caching, cosine similarity utilities, and API endpoints.
"""
from __future__ import annotations

import pytest
import numpy as np
import httpx
from app.main import app
from app.pipeline.embeddings.embedding_service import (
    EmbeddingService,
    compute_content_hash,
    compute_embedding_id,
)
from app.pipeline.embeddings.cosine import (
    cosine_similarity,
    batch_cosine_similarity,
    pairwise_cosine_similarity,
    find_most_similar,
)

SAMPLE_RESEARCH_TEXTS = [
    "Transformer architecture with multi-head self-attention mechanisms",
    "Convolutional neural networks for image classification on ImageNet",
    "A key limitation is the quadratic computational overhead in sequence length",
    "In future work, we plan to extend this method to multimodal tabular data",
    "Our empirical results demonstrate a 94.5% accuracy on benchmark tests",
]


class TestEmbeddingService:
    """Tests for core EmbeddingService functionality."""

    @pytest.fixture
    def service(self):
        svc = EmbeddingService(dimension=384)
        svc.clear_cache()
        return svc

    def test_single_embedding_shape_and_normalization(self, service):
        text = "Graph neural networks for drug discovery"
        vec = service.embed_text(text, normalize=True)

        assert len(vec) == 384
        norm = np.linalg.norm(vec)
        # Must be unit-normalized: |v| = 1.0 +/- 1e-4
        assert abs(norm - 1.0) < 1e-4

    def test_batch_embedding_consistency(self, service):
        """Batch embedding should produce identical results to single embeddings."""
        batch_vecs = service.embed_batch(SAMPLE_RESEARCH_TEXTS, batch_size=2, normalize=True)
        assert len(batch_vecs) == len(SAMPLE_RESEARCH_TEXTS)

        for vec in batch_vecs:
            assert len(vec) == 384
            assert abs(np.linalg.norm(vec) - 1.0) < 1e-4

    def test_hash_based_caching_avoids_recalculation(self, service):
        """Identical texts must hit the cache without recomputing."""
        texts = ["Identical sentence for cache testing", "Another sample sentence"]

        # First pass: both are cache misses
        res1 = service.process_batch_request(texts=texts)
        assert res1.computed == 2
        assert res1.cache_hits == 0

        # Second pass: both must be cache hits
        res2 = service.process_batch_request(texts=texts)
        assert res2.computed == 0
        assert res2.cache_hits == 2

        # Vectors between runs must match exactly
        assert res1.embeddings[0].embedding == res2.embeddings[0].embedding

    def test_deterministic_embedding_id(self):
        text = "Standard research claim text"
        id1 = compute_embedding_id(text)
        id2 = compute_embedding_id(text)
        assert id1 == id2
        assert id1.startswith("emb_")
        assert len(id1) == 20  # "emb_" (4) + 16 hex chars

    def test_embed_items_preserves_structure(self, service):
        items = [
            {"id": "ent-1", "text": "Transformer", "entity_type": "method"},
            {"id": "ent-2", "text": "Quadratic memory scaling limitation", "entity_type": "limitation"},
            {"id": "ent-3", "text": "Explore diffusion models in future work", "entity_type": "future_work"},
            {"id": "ent-4", "text": "Achieved state-of-the-art accuracy on WMT", "entity_type": "finding"},
        ]

        embedded = service.embed_items(items)
        assert len(embedded) == 4

        for item in embedded:
            assert "embedding" in item
            assert len(item["embedding"]) == 384
            assert "embedding_id" in item
            assert item["embedding_id"].startswith("emb_")
            assert item["dimension"] == 384


class TestCosineSimilarityUtilities:
    """Tests for mathematical cosine similarity utilities."""

    def test_self_similarity_equals_one(self):
        v = np.random.randn(384).astype(np.float32)
        v /= np.linalg.norm(v)

        sim = cosine_similarity(v, v, is_normalized=True)
        assert abs(sim - 1.0) < 1e-5

    def test_opposite_similarity_equals_minus_one(self):
        v = np.random.randn(384).astype(np.float32)
        v /= np.linalg.norm(v)

        sim = cosine_similarity(v, -v, is_normalized=True)
        assert abs(sim - (-1.0)) < 1e-5

    def test_orthogonal_similarity_equals_zero(self):
        v1 = np.zeros(384, dtype=np.float32)
        v1[0] = 1.0
        v2 = np.zeros(384, dtype=np.float32)
        v2[1] = 1.0

        sim = cosine_similarity(v1, v2, is_normalized=True)
        assert abs(sim - 0.0) < 1e-5

    def test_batch_cosine_similarity(self):
        q = np.random.randn(384).astype(np.float32)
        q /= np.linalg.norm(q)

        m = np.random.randn(5, 384).astype(np.float32)
        m /= np.linalg.norm(m, axis=1, keepdims=True)

        scores = batch_cosine_similarity(q, m, is_normalized=True)
        assert len(scores) == 5
        for s in scores:
            assert -1.0 <= s <= 1.0

    def test_pairwise_cosine_similarity(self):
        matrix = np.random.randn(4, 384).astype(np.float32)
        matrix /= np.linalg.norm(matrix, axis=1, keepdims=True)

        sim_mat = pairwise_cosine_similarity(matrix, is_normalized=True)
        assert len(sim_mat) == 4
        assert len(sim_mat[0]) == 4
        # Diagonal must be 1.0
        for i in range(4):
            assert abs(sim_mat[i][i] - 1.0) < 1e-4

    def test_find_most_similar_ranking(self):
        q = np.zeros(384, dtype=np.float32)
        q[0] = 1.0

        cand1 = np.zeros(384, dtype=np.float32)
        cand1[0] = 0.95
        cand1[1] = 0.05
        cand1 /= np.linalg.norm(cand1)

        cand2 = np.zeros(384, dtype=np.float32)
        cand2[1] = 1.0  # orthogonal to q

        candidates = [
            {"name": "second", "embedding": cand2.tolist()},
            {"name": "first", "embedding": cand1.tolist()},
        ]

        results = find_most_similar(q.tolist(), candidates, top_k=2)
        assert len(results) == 2
        assert results[0]["name"] == "first"
        assert results[0]["score"] > results[1]["score"]


@pytest.mark.asyncio
class TestEmbeddingsAPIEndpoints:
    """Integration tests for embeddings REST API endpoints."""

    async def test_generate_embeddings_endpoint(self):
        payload = {
            "texts": [
                "Attention Is All You Need",
                "BERT Pre-training of Deep Bidirectional Transformers",
            ],
            "normalize": True,
            "batch_size": 2,
        }

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/embeddings/generate", json=payload)
            assert resp.status_code == 200
            data = resp.json()

            assert data["dimension"] == 384
            assert data["total_items"] == 2
            assert len(data["embeddings"]) == 2
            assert data["embeddings"][0]["embedding_id"].startswith("emb_")
            assert len(data["embeddings"][0]["embedding"]) == 384

    async def test_similarity_endpoint(self):
        payload = {
            "query_text": "Transformer neural network architecture",
            "candidate_texts": [
                "Transformer self-attention deep learning model",
                "Random forest ensemble decision tree classifier",
            ],
            "top_k": 2,
        }

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/embeddings/similarity", json=payload)
            assert resp.status_code == 200
            data = resp.json()

            assert "matches" in data
            assert len(data["matches"]) == 2
            # Transformer query should be more similar to Transformer candidate than Random Forest
            top_match = data["matches"][0]
            assert top_match["index"] == 0
            assert top_match["score"] > data["matches"][1]["score"]

    async def test_stats_and_clear_cache_endpoints(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            stats_resp = await client.get("/api/v1/embeddings/stats")
            assert stats_resp.status_code == 200
            stats_data = stats_resp.json()
            assert "cache_size" in stats_data
            assert stats_data["dimension"] == 384

            clear_resp = await client.post("/api/v1/embeddings/clear-cache")
            assert clear_resp.status_code == 200
            assert clear_resp.json()["status"] == "cache_cleared"
