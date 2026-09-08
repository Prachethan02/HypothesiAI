"""
HypothesiAI — Stage 7: Cosine Similarity Utilities
==================================================
High-performance cosine similarity calculations using vectorized numpy operations.
Supports single pair, batch-against-query, and pairwise matrix similarity.
"""
from __future__ import annotations

from typing import Any
import numpy as np


def cosine_similarity(
    vec_a: list[float] | np.ndarray,
    vec_b: list[float] | np.ndarray,
    is_normalized: bool = False,
) -> float:
    """
    Compute cosine similarity between two vectors.
    Returns float in [-1.0, 1.0].
    If vectors are already L2-normalized, returns the dot product.
    """
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)

    if a.shape != b.shape:
        raise ValueError(f"Vector dimension mismatch: {a.shape} vs {b.shape}")

    if is_normalized:
        sim = float(np.dot(a, b))
    else:
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        sim = float(np.dot(a, b) / (norm_a * norm_b))

    # Clamp to [-1.0, 1.0] to handle slight floating point drift
    return max(-1.0, min(1.0, sim))


def batch_cosine_similarity(
    query: list[float] | np.ndarray,
    matrix: list[list[float]] | np.ndarray,
    is_normalized: bool = False,
) -> list[float]:
    """
    Compute cosine similarity between a single query vector and a matrix of candidate vectors.
    Returns a list of floats in [-1.0, 1.0].
    """
    q = np.asarray(query, dtype=np.float32)
    m = np.asarray(matrix, dtype=np.float32)

    if m.size == 0:
        return []

    if q.ndim != 1:
        q = q.squeeze()
    if m.ndim == 1:
        m = m.reshape(1, -1)

    if q.shape[0] != m.shape[1]:
        raise ValueError(f"Dimension mismatch: query length {q.shape[0]} vs matrix columns {m.shape[1]}")

    if is_normalized:
        scores = np.dot(m, q)
    else:
        q_norm = np.linalg.norm(q)
        if q_norm == 0.0:
            return [0.0] * len(m)
        m_norms = np.linalg.norm(m, axis=1)
        # Avoid division by zero
        zero_mask = m_norms == 0.0
        m_norms[zero_mask] = 1.0
        scores = np.dot(m, q) / (m_norms * q_norm)
        scores[zero_mask] = 0.0

    scores = np.clip(scores, -1.0, 1.0)
    return [float(s) for s in scores]


def pairwise_cosine_similarity(
    vectors: list[list[float]] | np.ndarray,
    is_normalized: bool = False,
) -> list[list[float]]:
    """
    Compute full N x N pairwise cosine similarity matrix.
    """
    v = np.asarray(vectors, dtype=np.float32)
    if v.size == 0:
        return []

    if is_normalized:
        sim_matrix = np.dot(v, v.T)
    else:
        norms = np.linalg.norm(v, axis=1, keepdims=True)
        zero_mask = (norms == 0.0).squeeze()
        norms[norms == 0.0] = 1.0
        normed_v = v / norms
        sim_matrix = np.dot(normed_v, normed_v.T)
        if np.any(zero_mask):
            sim_matrix[zero_mask, :] = 0.0
            sim_matrix[:, zero_mask] = 0.0

    sim_matrix = np.clip(sim_matrix, -1.0, 1.0)
    return sim_matrix.tolist()


def find_most_similar(
    query_vector: list[float] | np.ndarray,
    candidates: list[dict[str, Any]],
    vector_key: str = "embedding",
    top_k: int = 5,
    is_normalized: bool = True,
) -> list[dict[str, Any]]:
    """
    Given a query vector and candidate dicts containing embedding vectors,
    returns the top_k most similar items with an attached 'score' attribute.
    """
    if not candidates:
        return []

    candidate_matrix = [c[vector_key] for c in candidates]
    scores = batch_cosine_similarity(query_vector, candidate_matrix, is_normalized=is_normalized)

    ranked_items: list[dict[str, Any]] = []
    for idx, (cand, score) in enumerate(zip(candidates, scores)):
        item_copy = dict(cand)
        item_copy["index"] = idx
        item_copy["score"] = round(score, 4)
        ranked_items.append(item_copy)

    ranked_items.sort(key=lambda x: x["score"], reverse=True)
    return ranked_items[:top_k]
