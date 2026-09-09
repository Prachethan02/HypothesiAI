"""
HypothesiAI – Stage 15: Research-Gap Ranking Engine
=====================================================
Consumes Stage 14 EvidenceItem objects and computes an explainable composite
ranking score for each candidate gap using 9 configurable weight dimensions.

IMPORTANT: Composite scores are computationally derived evidence signals.
They do NOT constitute verified scientific conclusions. Every dimension is
traceable to its source evidence items, statements, and papers.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.ranking import (
    RankingWeightsConfig,
    RankedGap,
    RankedGapDimension,
    GapRankingResponse,
)
from app.schemas.evidence import EvidenceItem, SourcePaperRef
from app.db.store import evidence_aggregation_store
from app.pipeline.ranking.rgqs_calculator import calculate_rgqs_for_evidence_item

logger = logging.getLogger(__name__)


def _get_db_conn():
    import psycopg2  # type: ignore
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "hypothesiai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def _normalise_weights(w: RankingWeightsConfig) -> Dict[str, float]:
    """Return a dict of dimension_name→weight, normalised so they sum to 1."""
    raw = {
        "recurrence": w.recurrence,
        "evidence_strength": w.evidence_strength,
        "independent_paper_support": w.independent_paper_support,
        "contradiction_strength": w.contradiction_strength,
        "underexplored_combination_strength": w.underexplored_combination_strength,
        "topic_relevance": w.topic_relevance,
        "temporal_signal": w.temporal_signal,
        "graph_evidence": w.graph_evidence,
        "confidence": w.confidence,
    }
    total = sum(raw.values())
    if total == 0:
        # Fallback: equal weights
        return {k: 1.0 / len(raw) for k in raw}
    return {k: v / total for k, v in raw.items()}


# Human-readable labels for each dimension
_DIMENSION_LABELS: Dict[str, str] = {
    "recurrence": "Recurrence",
    "evidence_strength": "Evidence Strength",
    "independent_paper_support": "Independent Paper Support",
    "contradiction_strength": "Contradiction Strength",
    "underexplored_combination_strength": "Underexplored Combination",
    "topic_relevance": "Topic Relevance",
    "temporal_signal": "Temporal Signal",
    "graph_evidence": "Graph Evidence",
    "confidence": "Confidence",
}


def _compute_dimension_scores(item: EvidenceItem) -> Dict[str, float]:
    """
    Derive a raw score (0→1) for each of the 9 dimensions from an EvidenceItem.
    Only use information already present on the item; never fabricate signals.
    """
    meta = item.metadata or {}
    paper_count = len(item.source_papers)

    # ── recurrence ──────────────────────────────────────────────────────────
    # Prefer explicit cluster_size or paper_count from metadata
    cluster_size = meta.get("cluster_size", 0) or meta.get("paper_count", 0)
    recurrence_raw = min(1.0, (cluster_size / 12.0) if cluster_size > 0 else (paper_count / 8.0))

    # ── evidence_strength ───────────────────────────────────────────────────
    evidence_strength_raw = float(item.score)

    # ── independent_paper_support ───────────────────────────────────────────
    # Normalise over a reasonable corpus cap of 20 papers
    independent_paper_support_raw = min(1.0, paper_count / 10.0)

    # ── contradiction_strength ──────────────────────────────────────────────
    if item.type == "contradiction_evidence":
        contradiction_strength_raw = float(item.confidence)
    else:
        contradiction_strength_raw = 0.0

    # ── underexplored_combination_strength ──────────────────────────────────
    if item.type == "underexplored_method_dataset":
        uex_raw = meta.get("raw_underexplored_score", 0.5)
        underexplored_combination_strength_raw = float(min(1.0, uex_raw))
    else:
        underexplored_combination_strength_raw = 0.0

    # ── topic_relevance ─────────────────────────────────────────────────────
    # If metadata has a topic_relevance value, use it; otherwise 0.5 as neutral
    topic_relevance_raw = float(meta.get("topic_relevance", 0.5))

    # ── temporal_signal ─────────────────────────────────────────────────────
    temporal_signal_raw = float(meta.get("temporal_signal", 0.0))

    # ── graph_evidence ──────────────────────────────────────────────────────
    if item.type in ("kg_structural_gaps", "disconnected_research_areas"):
        graph_evidence_raw = float(item.confidence)
    else:
        graph_evidence_raw = 0.0

    # ── confidence ──────────────────────────────────────────────────────────
    confidence_raw = float(item.confidence)

    return {
        "recurrence": recurrence_raw,
        "evidence_strength": evidence_strength_raw,
        "independent_paper_support": independent_paper_support_raw,
        "contradiction_strength": contradiction_strength_raw,
        "underexplored_combination_strength": underexplored_combination_strength_raw,
        "topic_relevance": topic_relevance_raw,
        "temporal_signal": temporal_signal_raw,
        "graph_evidence": graph_evidence_raw,
        "confidence": confidence_raw,
    }


def _build_explanation(dim_name: str, raw_score: float, item: EvidenceItem) -> str:
    meta = item.metadata or {}
    paper_count = len(item.source_papers)

    explanations = {
        "recurrence": (
            f"This signal recurs across {max(paper_count, meta.get('cluster_size', paper_count))} "
            f"documents/instances (raw score: {raw_score:.2f})."
        ),
        "evidence_strength": (
            f"Stage 14 aggregation scored this evidence at {item.score:.2f} "
            f"across all signal modalities."
        ),
        "independent_paper_support": (
            f"{paper_count} independent paper(s) reference this signal "
            f"(normalised score: {raw_score:.2f})."
        ),
        "contradiction_strength": (
            f"NLI model detected a contradiction with confidence {item.confidence:.2f}. "
            "Contradictory findings may indicate an unresolved empirical question."
            if item.type == "contradiction_evidence"
            else "No contradiction signal present for this evidence type."
        ),
        "underexplored_combination_strength": (
            f"Pattern mining identified this method-dataset combination as underexplored "
            f"(underexplored score: {meta.get('raw_underexplored_score', 0):.2f})."
            if item.type == "underexplored_method_dataset"
            else "Not applicable — not an underexplored combination signal."
        ),
        "topic_relevance": (
            f"Topic relevance score: {raw_score:.2f}. "
            "Higher values indicate tighter alignment with a coherent topic cluster."
        ),
        "temporal_signal": (
            f"Temporal signal: {raw_score:.2f}. "
            "Reflects declining or stagnating coverage over time where available."
        ),
        "graph_evidence": (
            f"Knowledge-graph structural gap detected (confidence {item.confidence:.2f}). "
            "Entities present in separate papers lack an evaluation link in the graph."
            if item.type in ("kg_structural_gaps", "disconnected_research_areas")
            else "No graph-structural gap signal for this evidence type."
        ),
        "confidence": (
            f"Model confidence in the underlying analytical signal: {item.confidence:.2f}."
        ),
    }
    return explanations.get(dim_name, f"Score: {raw_score:.2f}")


def _build_why_identified(item: EvidenceItem, dimensions: List[RankedGapDimension]) -> str:
    """
    Assemble a transparent, machine-generated explanation of why this gap was
    identified. Uses only signals with a meaningful weighted contribution.
    This is a computational summary, not a verified scientific conclusion.
    """
    active = [d for d in dimensions if d.weighted_contribution >= 0.015]
    active.sort(key=lambda d: d.weighted_contribution, reverse=True)

    if not active:
        return (
            f"This candidate gap was identified by the evidence aggregation engine "
            f"based on signal type '{item.type}'. No individual dimension had a dominant "
            "contribution. Researcher inspection of the evidence is recommended."
        )

    top_dims = active[:3]
    dim_desc = "; ".join(
        f"{d.name} (contribution {d.weighted_contribution:.3f})" for d in top_dims
    )
    paper_count = len(item.source_papers)
    paper_note = (
        f"{paper_count} independent paper(s) surface this signal."
        if paper_count > 0
        else "Source paper data is not yet available for this signal."
    )

    return (
        f"Identified via '{item.type}' evidence signal. "
        f"Leading scoring dimensions: {dim_desc}. "
        f"{paper_note} "
        f"Overall evidence score from Stage 14: {item.score:.2f}. "
        "NOTE: This is a computationally derived candidate signal. It has not been "
        "validated by domain experts and should not be treated as a confirmed research gap."
    )


class GapRankingService:
    """Explainable research-gap ranking engine (Stage 15)."""

    def rank_gaps(
        self,
        weights: Optional[RankingWeightsConfig] = None,
        min_composite_score: float = 0.10,
        min_evidence_count: int = 1,
        top_k: Optional[int] = None,
    ) -> Tuple[List[RankedGap], int, RankingWeightsConfig]:
        """
        Pull EvidenceItems from Stage 14 stores and DB, compute composite scores,
        and return sorted RankedGap objects.
        """
        if weights is None:
            weights = RankingWeightsConfig()

        norm_weights = _normalise_weights(weights)
        evidence_items: List[EvidenceItem] = []

        # ── 1. Pull from in-memory Stage 14 store ────────────────────────────
        for run_data in evidence_aggregation_store.values():
            raw_evidence = run_data.get("evidence", [])
            for e in raw_evidence:
                try:
                    if isinstance(e, EvidenceItem):
                        evidence_items.append(e)
                    elif isinstance(e, dict):
                        evidence_items.append(EvidenceItem(**e))
                except Exception as exc:
                    logger.debug("Skipping malformed evidence item: %s", exc)

        # ── 2. Pull from PostgreSQL ───────────────────────────────────────────
        if not evidence_items:
            try:
                conn = _get_db_conn()
                cur = conn.cursor()
                cur.execute("""
                    SELECT evidence_id, evidence_type, title, description, score,
                           confidence, source_papers, source_pages, source_statements, metadata
                    FROM aggregated_candidate_evidence
                    ORDER BY score DESC
                    LIMIT 200
                """)
                rows = cur.fetchall()
                cur.close()
                conn.close()
                import json
                for row in rows:
                    (eid, etype, title, desc, score, conf,
                     sp_raw, spages_raw, sstmts_raw, meta_raw) = row
                    try:
                        source_papers = [
                            SourcePaperRef(**p) if isinstance(p, dict) else p
                            for p in (json.loads(sp_raw) if isinstance(sp_raw, str) else sp_raw or [])
                        ]
                        source_pages = json.loads(spages_raw) if isinstance(spages_raw, str) else (spages_raw or [])
                        source_statements = json.loads(sstmts_raw) if isinstance(sstmts_raw, str) else (sstmts_raw or [])
                        metadata = json.loads(meta_raw) if isinstance(meta_raw, str) else (meta_raw or {})
                        evidence_items.append(EvidenceItem(
                            evidence_id=str(eid),
                            type=etype,
                            title=title,
                            description=desc,
                            score=float(score),
                            confidence=float(conf),
                            source_papers=source_papers,
                            source_pages=source_pages,
                            source_statements=source_statements,
                            metadata=metadata,
                        ))
                    except Exception as parse_exc:
                        logger.debug("DB row parse error: %s", parse_exc)
            except Exception as db_exc:
                logger.warning("DB query for evidence items failed: %s", db_exc)

        logger.info("Gap ranking: %d evidence items to rank", len(evidence_items))

        # ── 3. Compute composite scores ───────────────────────────────────────
        ranked_gaps: List[RankedGap] = []
        total_candidates = len(evidence_items)

        for item in evidence_items:
            if len(item.source_papers) < min_evidence_count and min_evidence_count > 1:
                continue

            dim_scores = _compute_dimension_scores(item)

            # Build dimension objects
            dimensions: List[RankedGapDimension] = []
            composite = 0.0
            for dim_name, norm_w in norm_weights.items():
                raw = dim_scores[dim_name]
                contribution = raw * norm_w
                composite += contribution
                dimensions.append(RankedGapDimension(
                    name=_DIMENSION_LABELS.get(dim_name, dim_name),
                    weight=norm_w,
                    raw_score=round(raw, 4),
                    weighted_contribution=round(contribution, 4),
                    explanation=_build_explanation(dim_name, raw, item),
                ))

            composite = round(min(1.0, composite), 4)

            if composite < min_composite_score:
                continue

            why = _build_why_identified(item, dimensions)

            rgqs_breakdown = calculate_rgqs_for_evidence_item(
                item_type=item.type,
                score=item.score,
                confidence=item.confidence,
                source_papers=item.source_papers,
                source_pages=item.source_pages,
                source_statements=item.source_statements,
                metadata=item.metadata,
                dimension_scores=dim_scores,
            )

            ranked_gaps.append(RankedGap(
                gap_id=item.evidence_id,
                title=item.title,
                description=item.description,
                composite_score=composite,
                confidence=item.confidence,
                rank=1,  # assigned after sort
                dimensions=dimensions,
                evidence_type=item.type,
                evidence_ids=[item.evidence_id],
                source_papers=item.source_papers,
                source_pages=item.source_pages,
                source_statements=item.source_statements,
                why_identified=why,
                rgqs=rgqs_breakdown.rgqs,
                rgqs_breakdown=rgqs_breakdown.model_dump(),
                metadata=item.metadata,
            ))

        # ── 4. Sort and assign ranks ──────────────────────────────────────────
        ranked_gaps.sort(key=lambda g: g.composite_score, reverse=True)
        for i, gap in enumerate(ranked_gaps, start=1):
            gap.rank = i

        if top_k is not None:
            ranked_gaps = ranked_gaps[:top_k]

        return ranked_gaps, total_candidates, weights


gap_ranking_service = GapRankingService()
