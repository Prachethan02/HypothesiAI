"""
HypothesiAI — Stage 11: HDBSCAN clustering of semantic embeddings
================================================================
Clusters MiniLM embeddings of limitations, future-work statements, and
unresolved research problems. Clusters are evidence signals, not research gaps.

Every cluster retains source-paper evidence for each member statement.
HDBSCAN label -1 is preserved as noise/outliers.
"""
from __future__ import annotations

import logging
import uuid
from collections import Counter, defaultdict
from typing import Any

import numpy as np

from app.pipeline.embeddings.embedding_service import embedding_service
from app.pipeline.embeddings.cosine import batch_cosine_similarity
from app.schemas.topics import (
    ClusterDocumentInput,
    ClusterEvidenceItem,
    ClusterGenerationRequest,
    ClusterResult,
    TopicRepresentation,
)

logger = logging.getLogger(__name__)

STATEMENT_TYPES = ("limitation", "future_work", "problem")
MAX_REPRESENTATIVE = 5
MAX_SUMMARY_TERMS = 8


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return matrix / norms


def _keyword_summary(texts: list[str], n_terms: int = MAX_SUMMARY_TERMS) -> list[tuple[str, float]]:
    if not texts:
        return []
    try:
        from sklearn.feature_extraction.text import CountVectorizer

        vectorizer = CountVectorizer(
            stop_words="english",
            min_df=1,
            ngram_range=(1, 2),
            max_features=200,
        )
        x = vectorizer.fit_transform(texts)
        freqs = np.asarray(x.sum(axis=0)).ravel()
        vocab = vectorizer.get_feature_names_out()
        if freqs.sum() == 0:
            return []
        weights = freqs / float(freqs.sum())
        ranked = sorted(zip(vocab, weights), key=lambda item: item[1], reverse=True)
        return [(str(w), float(s)) for w, s in ranked[:n_terms]]
    except Exception as exc:
        logger.warning("Keyword summary fallback: %s", exc)
        tokens: Counter[str] = Counter()
        for text in texts:
            for tok in text.lower().split():
                cleaned = "".join(ch for ch in tok if ch.isalnum())
                if len(cleaned) > 3:
                    tokens[cleaned] += 1
        total = sum(tokens.values()) or 1
        return [(w, c / total) for w, c in tokens.most_common(n_terms)]


def _greedy_cosine_cluster(embeddings: np.ndarray, min_cluster_size: int, threshold: float = 0.62) -> np.ndarray:
    """Fallback when hdbscan is unavailable. Small groups become noise (-1)."""
    n = embeddings.shape[0]
    labels = np.full(n, -1, dtype=int)
    assigned = np.zeros(n, dtype=bool)
    next_label = 0
    sim = embeddings @ embeddings.T

    for i in range(n):
        if assigned[i]:
            continue
        members = np.where(sim[i] >= threshold)[0]
        members = [int(j) for j in members if not assigned[j]]
        if len(members) >= min_cluster_size:
            for j in members:
                labels[j] = next_label
                assigned[j] = True
            next_label += 1
        else:
            assigned[i] = True
            labels[i] = -1
    return labels


def _fit_hdbscan(embeddings: np.ndarray, min_cluster_size: int, min_samples: int | None) -> tuple[np.ndarray, bool]:
    actual_min = max(2, min(min_cluster_size, max(2, embeddings.shape[0] // 2)))
    samples = min_samples if min_samples is not None else max(1, actual_min - 1)
    try:
        from hdbscan import HDBSCAN

        clusterer = HDBSCAN(
            min_cluster_size=actual_min,
            min_samples=samples,
            metric="euclidean",
            cluster_selection_method="eom",
            prediction_data=False,
        )
        labels = clusterer.fit_predict(embeddings)
        return np.asarray(labels, dtype=int), True
    except Exception as exc:
        logger.warning("HDBSCAN unavailable (%s). Using cosine fallback clustering.", exc)
        return _greedy_cosine_cluster(embeddings, actual_min), False


def _statement_type(doc: ClusterDocumentInput) -> str:
    meta = doc.metadata or {}
    raw = str(meta.get("statement_type") or meta.get("type") or "unknown")
    return raw


class HDBSCANClusteringService:
    def cluster_documents(self, request: ClusterGenerationRequest) -> tuple[list[ClusterResult], dict[str, int], str, dict[str, Any]]:
        documents = [d for d in request.documents if d.text and d.text.strip()]
        if not documents:
            raise ValueError("No documents with text were provided for clustering.")

        grouped: dict[str, list[ClusterDocumentInput]] = defaultdict(list)
        for doc in documents:
            stype = _statement_type(doc)
            if stype not in STATEMENT_TYPES:
                stype = "problem" if stype in {"claim", "objective"} else stype
            grouped[stype].append(doc)

        all_results: list[ClusterResult] = []
        doc_mapping: dict[str, int] = {}
        used_hdbscan = True
        global_cluster_id = 0

        for statement_type, docs in grouped.items():
            results, mapping, used = self._cluster_group(
                docs,
                statement_type=statement_type,
                min_cluster_size=request.min_cluster_size,
                min_samples=request.min_samples,
                start_id=global_cluster_id,
            )
            used_hdbscan = used_hdbscan and used
            for result in results:
                all_results.append(result)
                if not result.is_noise:
                    global_cluster_id = max(global_cluster_id, result.cluster_id + 1)
            doc_mapping.update(mapping)

        model_id = str(uuid.uuid4())
        stats = {
            "algorithm": "hdbscan" if used_hdbscan else "cosine_fallback",
            "min_cluster_size": request.min_cluster_size,
            "document_count": len(documents),
            "cluster_count": sum(1 for c in all_results if not c.is_noise),
            "noise_count": sum(c.size for c in all_results if c.is_noise),
        }
        return all_results, doc_mapping, model_id, stats

    def _cluster_group(
        self,
        docs: list[ClusterDocumentInput],
        statement_type: str,
        min_cluster_size: int,
        min_samples: int | None,
        start_id: int,
    ) -> tuple[list[ClusterResult], dict[str, int], bool]:
        embeddings = self._resolve_embeddings(docs)
        labels, used_hdbscan = _fit_hdbscan(embeddings, min_cluster_size, min_samples)

        mapping: dict[str, int] = {}
        unique_labels = sorted(set(int(x) for x in labels.tolist()))
        remapped: dict[int, int] = {}
        next_id = start_id
        for lab in unique_labels:
            if lab == -1:
                remapped[lab] = -1
            else:
                remapped[lab] = next_id
                next_id += 1

        remapped_labels = np.array([remapped[int(l)] for l in labels], dtype=int)
        for doc, lab in zip(docs, remapped_labels):
            mapping[doc.id] = int(lab)

        results: list[ClusterResult] = []
        for lab in sorted(set(remapped_labels.tolist())):
            member_idx = [i for i, l in enumerate(remapped_labels.tolist()) if l == lab]
            results.append(
                self._build_cluster(
                    cluster_id=int(lab),
                    statement_type=statement_type,
                    docs=docs,
                    embeddings=embeddings,
                    member_idx=member_idx,
                    is_noise=(lab == -1),
                )
            )
        return results, mapping, used_hdbscan

    def _resolve_embeddings(self, docs: list[ClusterDocumentInput]) -> np.ndarray:
        vectors: list[list[float]] = []
        missing_texts: list[str] = []
        missing_pos: list[int] = []

        for i, doc in enumerate(docs):
            if doc.embedding and len(doc.embedding) > 0:
                vectors.append([float(x) for x in doc.embedding])
            else:
                vectors.append([])
                missing_texts.append(doc.text)
                missing_pos.append(i)

        if missing_texts:
            computed = embedding_service.embed_batch(missing_texts, normalize=True)
            for pos, vec in zip(missing_pos, computed):
                vectors[pos] = vec

        dim = max((len(v) for v in vectors), default=384)
        matrix = np.zeros((len(docs), dim), dtype=np.float32)
        for i, vec in enumerate(vectors):
            if not vec:
                continue
            arr = np.asarray(vec, dtype=np.float32)
            if arr.shape[0] != dim:
                padded = np.zeros(dim, dtype=np.float32)
                padded[: min(dim, arr.shape[0])] = arr[:dim]
                arr = padded
            matrix[i] = arr
        return _l2_normalize(matrix)

    def _build_cluster(
        self,
        cluster_id: int,
        statement_type: str,
        docs: list[ClusterDocumentInput],
        embeddings: np.ndarray,
        member_idx: list[int],
        is_noise: bool,
    ) -> ClusterResult:
        members = [docs[i] for i in member_idx]
        member_vecs = embeddings[member_idx]
        centroid = member_vecs.mean(axis=0)
        centroid_norm = np.linalg.norm(centroid)
        if centroid_norm > 0:
            centroid = centroid / centroid_norm

        scores = batch_cosine_similarity(centroid, member_vecs, is_normalized=True)
        ranked = sorted(zip(members, member_idx, scores), key=lambda item: item[2], reverse=True)

        paper_ids: list[str] = []
        evidence: list[ClusterEvidenceItem] = []
        for doc, _idx, score in ranked:
            meta = doc.metadata or {}
            paper_id = meta.get("paper_id")
            paper_id_str = str(paper_id) if paper_id else None
            if paper_id_str and paper_id_str not in paper_ids:
                paper_ids.append(paper_id_str)
            evidence.append(
                ClusterEvidenceItem(
                    document_id=doc.id,
                    paper_id=paper_id_str,
                    paper_title=meta.get("paper_title"),
                    statement_type=_statement_type(doc) or statement_type,
                    text=doc.text,
                    similarity_to_centroid=round(float(score), 4),
                    is_representative=False,
                )
            )

        top_n = min(MAX_REPRESENTATIVE, len(evidence))
        for i in range(top_n):
            evidence[i].is_representative = True

        representative = [e.text for e in evidence[:top_n]]
        terms = _keyword_summary([m.text for m in members])
        representation = [TopicRepresentation(word=w, score=round(s, 4)) for w, s in terms]
        keywords = [t.word for t in representation[:5]]
        name = (
            f"{statement_type}_noise"
            if is_noise
            else f"{statement_type}_{cluster_id}_{'_'.join(keywords[:3])}" if keywords else f"{statement_type}_{cluster_id}"
        )
        if is_noise:
            summary = (
                f"HDBSCAN noise/outliers for {statement_type} statements "
                f"({len(members)} items across {len(paper_ids)} papers). "
                "These were not assigned to a dense cluster."
            )
        else:
            term_str = ", ".join(keywords) if keywords else statement_type.replace("_", " ")
            summary = (
                f"Evidence cluster of {len(members)} {statement_type.replace('_', ' ')} statements "
                f"from {len(paper_ids)} source paper(s). Recurring terms: {term_str}."
            )

        return ClusterResult(
            cluster_id=cluster_id,
            is_noise=is_noise,
            statement_type=statement_type,
            name=name,
            summary=summary,
            representation=representation,
            size=len(members),
            paper_count=len(paper_ids),
            paper_ids=paper_ids,
            representative_statements=representative,
            evidence=evidence,
        )


clustering_service = HDBSCANClusteringService()
