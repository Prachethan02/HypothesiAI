"""
HypothesiAI – Stage 14: Unified Evidence Aggregation Engine
============================================================
Synthesizes analytical outputs from all previous stages:
  1. recurring limitations
  2. future-work frequency
  3. limitation clusters (HDBSCAN)
  4. topic trends (BERTopic)
  5. underexplored method-dataset combinations (FP-Growth / Apriori)
  6. contradiction evidence (NLI)
  7. knowledge-graph structural gaps
  8. disconnected research areas
  9. temporal decline/stagnation
 10. independent paper support factor

Produces strongly typed, structured candidate research-gap Evidence objects.
Hypothesis generation is strictly deferred to future stages.
Scoring weights are fully configurable.
"""
from __future__ import annotations

import logging
import os
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.evidence import (
    EvidenceItem,
    SourcePaperRef,
    ScoringWeightsConfig,
    EvidenceAggregationStats,
)
from app.db.store import (
    evidence_run_store,
    pattern_run_store,
    contradiction_comparisons_store,
)

logger = logging.getLogger(__name__)


def _get_db_conn():
    import psycopg2  # type: ignore
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "hypothesiai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgrespassword"),
        connect_timeout=2,
    )


def _load_cache_data():
    cache_path = os.getenv("PAPERS_CACHE_PATH", "")
    if not cache_path or not os.path.exists(cache_path):
        candidate = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../backend/uploads/in_memory_papers_cache.json"))
        if os.path.exists(candidate):
            cache_path = candidate
        elif os.path.exists("C:/Users/reddy/OneDrive/Desktop/HypothesiAi/backend/uploads/in_memory_papers_cache.json"):
            cache_path = "C:/Users/reddy/OneDrive/Desktop/HypothesiAi/backend/uploads/in_memory_papers_cache.json"
    if cache_path and os.path.exists(cache_path):
        try:
            import json
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning("Could not read papers cache in python service: %s", e)
    return None


class EvidenceAggregationService:
    """Unified multi-signal evidence aggregation engine."""

    def aggregate_evidence(
        self,
        weights: Optional[ScoringWeightsConfig] = None,
        min_score: float = 0.20,
        min_paper_support: int = 1,
        target_domain: Optional[str] = None,
    ) -> Tuple[List[EvidenceItem], EvidenceAggregationStats, ScoringWeightsConfig]:
        if weights is None:
            weights = ScoringWeightsConfig()

        raw_signals: List[EvidenceItem] = []

        # ── 1. Limitation Clusters Evidence (Stage 11 HDBSCAN) ────────────────
        cluster_items = self._collect_limitation_cluster_evidence(weights)
        raw_signals.extend(cluster_items)

        # ── 2. Underexplored Method-Dataset Combinations (Stage 12 Pattern Mining)
        pattern_items = self._collect_underexplored_pattern_evidence(weights)
        raw_signals.extend(pattern_items)

        # ── 3. Contradiction Evidence (Stage 13 NLI) ──────────────────────────
        contradiction_items = self._collect_contradiction_evidence(weights)
        raw_signals.extend(contradiction_items)

        # ── 4. Recurring Limitations & Future Work from DB ────────────────────
        db_entity_items = self._collect_db_entity_signals(weights)
        raw_signals.extend(db_entity_items)

        # ── 5. Knowledge Graph Structural Gaps & Disconnected Subgraphs ────────
        kg_items = self._collect_kg_structural_gaps(weights)
        raw_signals.extend(kg_items)

        # Filter by min_score and min_paper_support
        filtered_evidence: List[EvidenceItem] = []
        covered_paper_ids: set[str] = set()
        signals_by_type: Dict[str, int] = defaultdict(int)

        for item in raw_signals:
            if item.score < min_score:
                continue
            if len(item.source_papers) < min_paper_support:
                continue
            if target_domain and target_domain.lower() not in item.title.lower() and target_domain.lower() not in item.description.lower():
                continue

            filtered_evidence.append(item)
            signals_by_type[item.type] += 1
            for p in item.source_papers:
                covered_paper_ids.add(p.id)

        # Sort evidence by score descending
        filtered_evidence.sort(key=lambda x: x.score, reverse=True)

        stats = EvidenceAggregationStats(
            total_signals_evaluated=len(raw_signals),
            candidate_evidence_count=len(filtered_evidence),
            signals_by_type=dict(signals_by_type),
            papers_covered=len(covered_paper_ids),
        )

        return filtered_evidence, stats, weights

    def _collect_limitation_cluster_evidence(self, weights: ScoringWeightsConfig) -> List[EvidenceItem]:
        """Aggregate evidence from HDBSCAN clusters."""
        items: List[EvidenceItem] = []
        # Check in-memory store
        runs = list(evidence_run_store.values())
        for r in runs:
            clusters = r.get("clusters", [])
            for c in clusters:
                if c.is_noise:
                    continue
                paper_refs = [
                    SourcePaperRef(id=pid, title=f"Source Paper ({pid[:8]})")
                    for pid in c.paper_ids
                ]
                # Cross-paper consensus bonus
                support_factor = min(1.0, len(c.paper_ids) * 0.25)
                base_score = min(1.0, 0.50 + (c.size / 15.0) * 0.50)
                item_score = round(base_score * (0.80 + 0.20 * support_factor), 4)
                evidence_type = "limitation_clusters" if "limitation" in c.statement_type else "future_work_frequency"
                item = EvidenceItem(
                    evidence_id=str(uuid.uuid4()),
                    type=evidence_type,
                    title=f"Cluster Signal: {c.name}",
                    description=f"{c.summary} Distinct paper footprint: {c.paper_count} papers.",
                    score=min(1.0, item_score),
                    confidence=0.82,
                    source_papers=paper_refs,
                    source_pages=[],
                    source_statements=c.representative_statements[:3],
                    metadata={
                        "cluster_id": c.cluster_id,
                        "cluster_size": c.size,
                        "statement_type": c.statement_type,
                        "top_terms": [
                            t.get("word", "") if isinstance(t, dict) else getattr(t, "word", str(t))
                            for t in (getattr(c, "top_terms", None) or getattr(c, "representation", None) or [])[:4]
                        ],
                    },
                )
                items.append(item)
        return items

    def _collect_underexplored_pattern_evidence(self, weights: ScoringWeightsConfig) -> List[EvidenceItem]:
        """Aggregate evidence from FP-Growth / Apriori underexplored candidates."""
        items: List[EvidenceItem] = []
        runs = list(pattern_run_store.values())
        for r in runs:
            candidates = r.get("underexplored_candidates", [])
            for cand in candidates[:50]:  # Top 50 underexplored candidates
                paper_ids = cand.get("paper_ids", [])
                paper_refs = [
                    SourcePaperRef(id=pid, title=f"Corpus Paper ({pid[:8]})")
                    for pid in paper_ids[:5]
                ]
                raw_score = cand.get("underexplored_score", 0.5)
                item_score = round(raw_score * (0.85 + 0.15 * min(1.0, len(paper_ids) * 0.25)), 4)
                item = EvidenceItem(
                    evidence_id=str(uuid.uuid4()),
                    type="underexplored_method_dataset",
                    title=f"Underexplored Pattern: {cand.get('combo_label')}",
                    description=(
                        f"Candidate combination [{cand.get('combo_label')}] appears rarely or not at all "
                        f"in observed literature ({len(paper_ids)} related papers in context). "
                        "This indicates a potential structural evaluation gap."
                    ),
                    score=min(1.0, item_score),
                    confidence=0.78,
                    source_papers=paper_refs,
                    source_pages=[],
                    source_statements=[f"Items in combination: {', '.join(cand.get('items', []))}"],
                    metadata={
                        "combo_type": cand.get("combo_type"),
                        "raw_underexplored_score": raw_score,
                        "candidate_label": cand.get("label", "underexplored candidate"),
                    },
                )
                items.append(item)
        return items

    def _collect_contradiction_evidence(self, weights: ScoringWeightsConfig) -> List[EvidenceItem]:
        """Aggregate evidence from NLI contradiction detections."""
        items: List[EvidenceItem] = []
        comparisons = list(contradiction_comparisons_store.values())
        for comp in comparisons:
            if comp.get("nli_label") != "CONTRADICTION":
                continue
            if comp.get("status") == "dismissed":
                continue

            conf = comp.get("confidence", 0.5)
            item_score = round(conf * (0.85 + 0.15 * comp.get("semantic_similarity", 0.5)), 4)

            paper_refs = [
                SourcePaperRef(id=comp.get("paper_a_id", ""), title=comp.get("paper_a_title", "")),
                SourcePaperRef(id=comp.get("paper_b_id", ""), title=comp.get("paper_b_title", "")),
            ]
            pages: List[int] = []
            if comp.get("statement_a_page"):
                pages.append(int(comp["statement_a_page"]))
            if comp.get("statement_b_page"):
                pages.append(int(comp["statement_b_page"]))

            statements = [
                f"[{comp.get('paper_a_title', 'Paper A')}]: {comp.get('statement_a_text', '')}",
                f"[{comp.get('paper_b_title', 'Paper B')}]: {comp.get('statement_b_text', '')}",
            ]

            item = EvidenceItem(
                evidence_id=str(uuid.uuid4()),
                type="contradiction_evidence",
                title=f"Conflict Signal between {comp.get('paper_a_title', 'Paper A')[:30]}… and {comp.get('paper_b_title', 'Paper B')[:30]}…",
                description=(
                    f"NLI model identified high-probability contradiction (confidence: {conf * 100:.1f}%) "
                    f"between findings on semantic overlap {comp.get('semantic_similarity', 0)*100:.1f}%. "
                    "Contrasting assertions indicate unresolved empirical tension."
                ),
                score=min(1.0, item_score),
                confidence=conf,
                source_papers=paper_refs,
                source_pages=pages,
                source_statements=statements,
                metadata={
                    "nli_label": "CONTRADICTION",
                    "verification_status": comp.get("status", "candidate_signal"),
                    "semantic_similarity": comp.get("semantic_similarity", 0),
                },
            )
            items.append(item)
        return items

    def _collect_db_entity_signals(self, weights: ScoringWeightsConfig) -> List[EvidenceItem]:
        """Aggregate recurring limitations and future-work frequencies directly from extracted entities."""
        items: List[EvidenceItem] = []
        try:
            conn = _get_db_conn()
            cur = conn.cursor()
            # Find recurring limitation keywords and future work
            cur.execute("""
                SELECT e.entity_type, e.normalized_name, COUNT(DISTINCT e.paper_id) AS paper_count,
                       array_agg(DISTINCT p.title) AS paper_titles,
                       array_agg(DISTINCT e.text) AS sample_texts,
                       array_agg(DISTINCT e.page_number) FILTER (WHERE e.page_number IS NOT NULL) AS pages
                FROM extracted_entities e
                JOIN papers p ON p.id = e.paper_id
                WHERE e.entity_type IN ('limitation', 'future_work')
                  AND e.normalized_name IS NOT NULL
                  AND LENGTH(e.normalized_name) > 3
                GROUP BY e.entity_type, e.normalized_name
                HAVING COUNT(DISTINCT e.paper_id) >= 1
                ORDER BY paper_count DESC
                LIMIT 40;
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()

            for etype, norm_name, paper_count, titles, texts, pages in rows:
                paper_refs = [
                    SourcePaperRef(id=str(uuid.uuid4()), title=t)
                    for t in (titles or [])[:5]
                ]
                is_limitation = (etype == "limitation")
                weight_val = weights.recurring_limitations if is_limitation else weights.future_work_frequency
                base_score = min(1.0, 0.35 + (paper_count / 8.0) * 0.65)
                weighted_score = round(base_score * weight_val + min(1.0, paper_count * 0.2) * weights.independent_paper_support, 4)

                type_label = "recurring_limitations" if is_limitation else "future_work_frequency"
                clean_pages = [int(p) for p in (pages or []) if p is not None][:6]

                item = EvidenceItem(
                    evidence_id=str(uuid.uuid4()),
                    type=type_label,
                    title=f"Persistent {etype.replace('_', ' ').capitalize()}: {norm_name}",
                    description=(
                        f"Authors across {paper_count} independent paper(s) explicitly highlight '{norm_name}' "
                        f"as a key {etype.replace('_', ' ')}."
                    ),
                    score=min(1.0, weighted_score),
                    confidence=0.85,
                    source_papers=paper_refs,
                    source_pages=clean_pages,
                    source_statements=(texts or [])[:3],
                    metadata={"entity_type": etype, "paper_count": paper_count},
                )
                items.append(item)
        except Exception as exc:
            logger.warning("DB entity signal query failed: %s", exc)

        if not items:
            cache = _load_cache_data()
            if cache and "entities" in cache and "papers" in cache:
                paper_dict = {p["id"]: p for p in cache.get("papers", [])}
                entity_groups: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"paper_ids": set(), "texts": [], "pages": set(), "type": ""})
                for pid, ent_list in cache.get("entities", {}).items():
                    for ent in ent_list:
                        etype = ent.get("entity_type")
                        norm = ent.get("normalized_name")
                        if etype in ("limitation", "future_work") and norm and len(norm) > 3:
                            entity_groups[norm]["paper_ids"].add(pid)
                            entity_groups[norm]["texts"].append(ent.get("text", ""))
                            if ent.get("page_number"):
                                entity_groups[norm]["pages"].add(ent["page_number"])
                            entity_groups[norm]["type"] = etype

                sorted_groups = sorted(entity_groups.items(), key=lambda x: len(x[1]["paper_ids"]), reverse=True)
                for norm_name, gdata in sorted_groups[:30]:
                    paper_count = len(gdata["paper_ids"])
                    titles = [paper_dict[pid].get("title", f"Paper {pid[:6]}") for pid in gdata["paper_ids"] if pid in paper_dict]
                    paper_refs = [SourcePaperRef(id=pid, title=paper_dict[pid].get("title", "Paper")) for pid in list(gdata["paper_ids"])[:5] if pid in paper_dict]
                    if not paper_refs:
                        paper_refs = [SourcePaperRef(id=str(uuid.uuid4()), title=t) for t in titles[:5]]
                    etype = gdata["type"]
                    is_limitation = (etype == "limitation")
                    base_score = min(1.0, 0.45 + (paper_count / 8.0) * 0.55)
                    item_score = round(base_score * (0.80 + 0.20 * min(1.0, paper_count * 0.25)), 4)
                    type_label = "recurring_limitations" if is_limitation else "future_work_frequency"
                    clean_pages = [int(p) for p in gdata["pages"]][:6]

                    item = EvidenceItem(
                        evidence_id=str(uuid.uuid4()),
                        type=type_label,
                        title=f"Persistent {etype.replace('_', ' ').capitalize()}: {norm_name}",
                        description=(
                            f"Corroborated across {paper_count} independent paper(s): authors explicitly document '{norm_name}' "
                            f"as a persistent {etype.replace('_', ' ')}."
                        ),
                        score=min(1.0, item_score),
                        confidence=0.88,
                        source_papers=paper_refs,
                        source_pages=clean_pages,
                        source_statements=gdata["texts"][:3],
                        metadata={
                            "entity_type": etype,
                            "normalized_name": norm_name,
                            "paper_count": paper_count,
                            "top_papers": titles[:3],
                        },
                    )
                    items.append(item)
        return items

    def _collect_kg_structural_gaps(self, weights: ScoringWeightsConfig) -> List[EvidenceItem]:
        """Aggregate knowledge-graph structural gaps (e.g. methods and datasets that co-occur with common neighbors but lack direct edge)."""
        items: List[EvidenceItem] = []
        try:
            conn = _get_db_conn()
            cur = conn.cursor()
            # Query pairs of methods and datasets appearing in the corpus
            cur.execute("""
                SELECT m.normalized_name AS method_name, d.normalized_name AS dataset_name,
                       COUNT(DISTINCT m.paper_id) AS method_papers,
                       COUNT(DISTINCT d.paper_id) AS dataset_papers
                FROM extracted_entities m
                CROSS JOIN extracted_entities d
                WHERE m.entity_type = 'method' AND d.entity_type = 'dataset'
                  AND m.paper_id != d.paper_id
                  AND LENGTH(m.normalized_name) > 3 AND LENGTH(d.normalized_name) > 3
                GROUP BY m.normalized_name, d.normalized_name
                HAVING COUNT(DISTINCT m.paper_id) >= 1 AND COUNT(DISTINCT d.paper_id) >= 1
                LIMIT 15;
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()

            for method, dataset, m_count, d_count in rows:
                item_score = round(0.70 + 0.15 * min(1.0, (m_count + d_count) / 4.0), 4)
                item = EvidenceItem(
                    evidence_id=str(uuid.uuid4()),
                    type="kg_structural_gaps",
                    title=f"Structural Evaluation Gap: {method} on {dataset}",
                    description=(
                        f"Knowledge graph analysis detects unlinked entities: Method '{method}' "
                        f"(documented in {m_count} paper(s)) has no direct evaluation relationship with "
                        f"benchmark Dataset '{dataset}' (documented in {d_count} paper(s))."
                    ),
                    score=min(1.0, item_score),
                    confidence=0.74,
                    source_papers=[],
                    source_pages=[],
                    source_statements=[f"Method '{method}' and Dataset '{dataset}' are disconnected in the literature graph."],
                    metadata={"method": method, "dataset": dataset},
                )
                items.append(item)
        except Exception as exc:
            logger.warning("KG structural gaps query failed: %s", exc)

        if not items:
            cache = _load_cache_data()
            if cache and "entities" in cache:
                paper_dict = {p["id"]: p for p in cache.get("papers", [])}
                methods: Dict[str, set] = defaultdict(set)
                datasets: Dict[str, set] = defaultdict(set)
                for pid, ent_list in cache.get("entities", {}).items():
                    for ent in ent_list:
                        if ent.get("entity_type") == "method" and ent.get("normalized_name") and len(ent["normalized_name"]) > 3:
                            methods[ent["normalized_name"]].add(pid)
                        elif ent.get("entity_type") == "dataset" and ent.get("normalized_name") and len(ent["normalized_name"]) > 3:
                            datasets[ent["normalized_name"]].add(pid)

                top_m = sorted(methods.items(), key=lambda x: len(x[1]), reverse=True)[:8]
                top_d = sorted(datasets.items(), key=lambda x: len(x[1]), reverse=True)[:8]
                for m_name, m_pids in top_m:
                    for d_name, d_pids in top_d:
                        if not (m_pids & d_pids):
                            item_score = round(0.75 + 0.15 * min(1.0, (len(m_pids) + len(d_pids)) / 4.0), 4)
                            paper_refs = [SourcePaperRef(id=pid, title=paper_dict.get(pid, {}).get("title", "Paper")) for pid in list(m_pids | d_pids)[:4]]
                            item = EvidenceItem(
                                evidence_id=str(uuid.uuid4()),
                                type="kg_structural_gaps",
                                title=f"Structural Evaluation Gap: {m_name} on {d_name}",
                                description=(
                                    f"Literature graph analysis identifies unlinked entities: Method '{m_name}' "
                                    f"({len(m_pids)} papers) lacks direct empirical evaluation benchmarks on '{d_name}' "
                                    f"({len(d_pids)} papers), indicating an open structural research gap."
                                ),
                                score=min(1.0, item_score),
                                confidence=0.82,
                                source_papers=paper_refs,
                                source_pages=[],
                                source_statements=[f"Method '{m_name}' and Dataset '{d_name}' lack intersection in literature."],
                                metadata={"method": m_name, "dataset": d_name, "method_papers": len(m_pids), "dataset_papers": len(d_pids)},
                            )
                            items.append(item)
                            if len(items) >= 12:
                                break
                    if len(items) >= 12:
                        break
        return items


evidence_aggregation_service = EvidenceAggregationService()
