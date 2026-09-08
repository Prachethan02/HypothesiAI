from __future__ import annotations
import datetime
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from app.pipeline.embeddings import embedding_service, cosine_similarity
from app.pipeline.resolution.config import ResolutionConfig
from app.pipeline.resolution.acronyms import check_acronym_match, is_potential_acronym
from app.pipeline.resolution.guardrails import should_reject_merge, is_type_compatible
from app.pipeline.resolution.fuzzy import compute_fuzzy_metrics, normalize_text_for_fuzzy
from app.schemas.resolution import (
    EntityItem,
    ResolutionDecision,
    ResolvedEntity,
    ResolveEntitiesResponse,
    PairCompareResponse,
)


class EntityResolver:
    """
    Master research entity normalization engine.
    Combines exact matching, scientific acronym/abbreviation expansion,
    RapidFuzz string/token similarity, and Sentence-Transformer semantic cosine similarity.
    """

    def __init__(self, config: Optional[ResolutionConfig] = None):
        self.config = config or ResolutionConfig()

    def compare_pair(
        self,
        entity_a: EntityItem,
        entity_b: EntityItem,
        config: Optional[ResolutionConfig] = None
    ) -> Tuple[bool, str, float, str, float, ResolutionDecision]:
        """
        Compares two entities and decides whether they should be normalized to the same concept.
        Returns:
            (should_merge, canonical_entity, similarity_score, resolution_method, confidence, decision)
        """
        cfg = config or self.config
        text_a = entity_a.text.strip()
        text_b = entity_b.text.strip()
        type_a = entity_a.entity_type
        type_b = entity_b.entity_type
        decision_id = f"dec_{uuid.uuid4().hex[:12]}"
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # ---------------------------------------------------------------------
        # Guardrail Pre-Check: Entity Type Compatibility
        # ---------------------------------------------------------------------
        if cfg.require_type_match and not is_type_compatible(type_a, type_b):
            fuzzy_metrics = compute_fuzzy_metrics(text_a, text_b)
            decision = ResolutionDecision(
                decision_id=decision_id,
                original_text=text_a,
                candidate_text=text_b,
                canonical_entity=text_a,
                entity_type=type_a,
                similarity_score=fuzzy_metrics["composite"],
                resolution_method="none",
                confidence=0.0,
                decision="rejected",
                rationale=f"Entity type mismatch: cannot merge '{type_a}' with '{type_b}'",
                metrics=fuzzy_metrics,
                timestamp=now,
            )
            return False, text_a, fuzzy_metrics["composite"], "none", 0.0, decision

        # ---------------------------------------------------------------------
        # Tier 1: Exact Match (after whitespace / punctuation / case normalization)
        # ---------------------------------------------------------------------
        norm_a = normalize_text_for_fuzzy(text_a)
        norm_b = normalize_text_for_fuzzy(text_b)

        if norm_a == norm_b:
            canonical = self._select_canonical_between_two(text_a, text_b)
            decision = ResolutionDecision(
                decision_id=decision_id,
                original_text=text_a,
                candidate_text=text_b,
                canonical_entity=canonical,
                entity_type=type_a,
                similarity_score=1.0,
                resolution_method="exact",
                confidence=1.0,
                decision="merged",
                rationale=f"Exact normalized string match: '{text_a}' == '{text_b}'",
                metrics={"rapidfuzz_ratio": 1.0, "cosine_similarity": 1.0},
                timestamp=now,
            )
            return True, canonical, 1.0, "exact", 1.0, decision

        # ---------------------------------------------------------------------
        # Tier 2: Acronym / Abbreviation Match
        # (e.g. "GCN" <-> "Graph Convolutional Network")
        # ---------------------------------------------------------------------
        if cfg.enable_acronym_matching:
            is_acronym, ac_score, ac_canonical, ac_rationale = check_acronym_match(text_a, text_b)
            if is_acronym and ac_canonical:
                # Still check type compatibility guardrail
                guard_reject, guard_reason = should_reject_merge(
                    text_a, text_b, type_a, type_b, require_type_match=cfg.require_type_match
                )
                if not guard_reject:
                    decision = ResolutionDecision(
                        decision_id=decision_id,
                        original_text=text_a,
                        candidate_text=text_b,
                        canonical_entity=ac_canonical,
                        entity_type=type_a,
                        similarity_score=ac_score,
                        resolution_method="abbreviation",
                        confidence=cfg.acronym_min_confidence,
                        decision="merged",
                        rationale=ac_rationale or f"Acronym match: '{text_a}' <=> '{text_b}'",
                        metrics={"acronym_match": True, "score": ac_score},
                        timestamp=now,
                    )
                    return True, ac_canonical, ac_score, "abbreviation", cfg.acronym_min_confidence, decision

        # ---------------------------------------------------------------------
        # Tier 3: Anti-Merging Guardrails
        # ---------------------------------------------------------------------
        guard_reject, guard_reason = should_reject_merge(
            text_a, text_b, type_a, type_b, require_type_match=cfg.require_type_match
        )
        if guard_reject:
            fuzzy_metrics = compute_fuzzy_metrics(text_a, text_b)
            decision = ResolutionDecision(
                decision_id=decision_id,
                original_text=text_a,
                candidate_text=text_b,
                canonical_entity=text_a,
                entity_type=type_a,
                similarity_score=fuzzy_metrics["composite"],
                resolution_method="none",
                confidence=0.0,
                decision="rejected",
                rationale=guard_reason or "Failed anti-merging guardrails",
                metrics=fuzzy_metrics,
                timestamp=now,
            )
            return False, text_a, fuzzy_metrics["composite"], "none", 0.0, decision

        # ---------------------------------------------------------------------
        # Tier 4: Multi-Signal RapidFuzz & Semantic Cosine Evaluation
        # ---------------------------------------------------------------------
        fuzzy_metrics = compute_fuzzy_metrics(text_a, text_b)
        tsr = fuzzy_metrics["token_sort_ratio"]
        composite_fuzzy = fuzzy_metrics["composite"]

        # Compute semantic cosine similarity
        cosine_sim = self._get_or_compute_cosine(entity_a, entity_b)
        fuzzy_metrics["cosine_similarity"] = round(cosine_sim, 4)

        # 4a. RapidFuzz Spelling / Token-order / Hyphenation variation
        # (e.g. "Graph Convolution Network" vs "Graph Convolutional Network"
        #  or "Multihead Self-Attention" vs "Multi-head Self Attention")
        lev = fuzzy_metrics["levenshtein"]
        ratio = fuzzy_metrics["ratio"]
        lev_threshold = max(cfg.rapidfuzz_ratio_threshold, 0.90)
        ratio_threshold = cfg.rapidfuzz_ratio_threshold
        is_spelling_match = (
            (tsr >= cfg.rapidfuzz_token_sort_threshold and (cosine_sim >= 0.50 or lev >= 0.85))
            or (lev >= lev_threshold and ratio >= ratio_threshold)
            or (composite_fuzzy >= cfg.rapidfuzz_ratio_threshold and lev >= 0.88)
        )
        if is_spelling_match:
            canonical = self._select_canonical_between_two(text_a, text_b)
            score = max(tsr, lev, composite_fuzzy)
            confidence = round(0.5 * score + 0.5 * max(cosine_sim, 0.5), 4)
            decision = ResolutionDecision(
                decision_id=decision_id,
                original_text=text_a,
                candidate_text=text_b,
                canonical_entity=canonical,
                entity_type=type_a,
                similarity_score=score,
                resolution_method="rapidfuzz",
                confidence=confidence,
                decision="merged",
                rationale=f"RapidFuzz spelling/token alignment (TSR={tsr:.2f}, Lev={lev:.2f}, Comp={composite_fuzzy:.2f})",
                metrics=fuzzy_metrics,
                timestamp=now,
            )
            return True, canonical, score, "rapidfuzz", confidence, decision

        # 4b. High Semantic Cosine with Reasonable String Alignment
        if cosine_sim >= cfg.semantic_cosine_threshold and composite_fuzzy >= 0.60:
            canonical = self._select_canonical_between_two(text_a, text_b)
            confidence = round(0.6 * cosine_sim + 0.4 * composite_fuzzy, 4)
            decision = ResolutionDecision(
                decision_id=decision_id,
                original_text=text_a,
                candidate_text=text_b,
                canonical_entity=canonical,
                entity_type=type_a,
                similarity_score=cosine_sim,
                resolution_method="cosine_embedding",
                confidence=confidence,
                decision="merged",
                rationale=f"High semantic cosine similarity ({cosine_sim:.2f}) with string alignment ({composite_fuzzy:.2f})",
                metrics=fuzzy_metrics,
                timestamp=now,
            )
            return True, canonical, cosine_sim, "cosine_embedding", confidence, decision

        # 4c. Hybrid Weighted Resolution
        hybrid_score = (cfg.rapidfuzz_weight * composite_fuzzy) + (cfg.semantic_weight * cosine_sim)
        fuzzy_metrics["hybrid_score"] = round(hybrid_score, 4)

        if hybrid_score >= cfg.hybrid_min_confidence:
            canonical = self._select_canonical_between_two(text_a, text_b)
            decision = ResolutionDecision(
                decision_id=decision_id,
                original_text=text_a,
                candidate_text=text_b,
                canonical_entity=canonical,
                entity_type=type_a,
                similarity_score=round(hybrid_score, 4),
                resolution_method="hybrid",
                confidence=round(hybrid_score, 4),
                decision="merged",
                rationale=f"Combined hybrid score ({hybrid_score:.2f}) exceeds confidence threshold ({cfg.hybrid_min_confidence})",
                metrics=fuzzy_metrics,
                timestamp=now,
            )
            return True, canonical, round(hybrid_score, 4), "hybrid", round(hybrid_score, 4), decision

        # ---------------------------------------------------------------------
        # Fallback: Evidence Does Not Support Merge -> Keep Separate
        # ---------------------------------------------------------------------
        decision = ResolutionDecision(
            decision_id=decision_id,
            original_text=text_a,
            candidate_text=text_b,
            canonical_entity=text_a,
            entity_type=type_a,
            similarity_score=round(max(composite_fuzzy, cosine_sim), 4),
            resolution_method="none",
            confidence=0.0,
            decision="rejected",
            rationale=f"Insufficient similarity evidence: RapidFuzz ({composite_fuzzy:.2f}), Cosine ({cosine_sim:.2f}), Hybrid ({hybrid_score:.2f})",
            metrics=fuzzy_metrics,
            timestamp=now,
        )
        return False, text_a, round(max(composite_fuzzy, cosine_sim), 4), "none", 0.0, decision

    def resolve_batch(
        self,
        entities: List[EntityItem],
        config: Optional[ResolutionConfig] = None
    ) -> ResolveEntitiesResponse:
        """
        Clusters and resolves a batch of entities into canonical concepts with complete audit logging.
        """
        cfg = config or self.config
        if not entities:
            return ResolveEntitiesResponse(
                resolved_entities=[],
                unique_canonical_count=0,
                merged_count=0,
                audit_trail=[],
            )

        audit_trail: List[ResolutionDecision] = []
        # Precompute embeddings for any entities missing them
        self._ensure_embeddings(entities)

        # Partition entities by entity_type if require_type_match is enabled
        partitions: Dict[str, List[EntityItem]] = {}
        for ent in entities:
            part_key = ent.entity_type if cfg.require_type_match else "all"
            partitions.setdefault(part_key, []).append(ent)

        resolved_list: List[ResolvedEntity] = []
        merged_total = 0

        for part_type, part_entities in partitions.items():
            clusters: List[Dict[str, Any]] = []
            # clusters item structure:
            # {
            #    "canonical": str,
            #    "rep_entity": EntityItem,
            #    "members": List[EntityItem],
            #    "methods": List[str],
            #    "scores": List[float],
            #    "decision_ids": List[str]
            # }

            for item in part_entities:
                best_cluster = None
                best_score = -1.0
                best_decision = None
                best_method = "none"
                best_conf = 0.0

                for cluster in clusters:
                    rep = cluster["rep_entity"]
                    should_merge, can_name, score, method, conf, decision = self.compare_pair(item, rep, cfg)
                    audit_trail.append(decision)

                    if should_merge and score > best_score:
                        best_score = score
                        best_cluster = cluster
                        best_decision = decision
                        best_method = method
                        best_conf = conf

                if best_cluster is not None:
                    # Merge into existing cluster
                    best_cluster["members"].append(item)
                    best_cluster["methods"].append(best_method)
                    best_cluster["scores"].append(best_score)
                    best_cluster["decision_ids"].append(best_decision.decision_id if best_decision else "")
                    # Re-evaluate canonical name across cluster members
                    best_cluster["canonical"] = self._select_cluster_canonical(best_cluster["members"])
                    merged_total += 1
                else:
                    # New singleton cluster
                    dec_id = f"dec_{uuid.uuid4().hex[:12]}"
                    initial_canonical = self._format_initial_canonical(item.text)
                    clusters.append({
                        "canonical": initial_canonical,
                        "rep_entity": item,
                        "members": [item],
                        "methods": ["new_canonical"],
                        "scores": [1.0],
                        "decision_ids": [dec_id]
                    })
                    audit_trail.append(ResolutionDecision(
                        decision_id=dec_id,
                        original_text=item.text,
                        candidate_text=None,
                        canonical_entity=initial_canonical,
                        entity_type=item.entity_type,
                        similarity_score=1.0,
                        resolution_method="new_canonical",
                        confidence=1.0,
                        decision="new_canonical",
                        rationale="First occurrence initialized as new canonical concept",
                        metrics={},
                        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    ))

            # Build resolved outputs for partition
            for cluster in clusters:
                canonical = cluster["canonical"]
                aliases = list({m.text for m in cluster["members"] if m.text.lower() != canonical.lower()})
                for idx, member in enumerate(cluster["members"]):
                    method = cluster["methods"][idx]
                    score = cluster["scores"][idx]
                    dec_id = cluster["decision_ids"][idx]
                    conf = 1.0 if method in ("exact", "new_canonical") else score

                    resolved_list.append(ResolvedEntity(
                        original_id=member.id,
                        original_text=member.text,
                        canonical_entity=canonical,
                        entity_type=member.entity_type,
                        similarity_score=round(score, 4),
                        resolution_method=method,
                        confidence=round(conf, 4),
                        decision_id=dec_id,
                        aliases=aliases,
                    ))

        unique_canonicals = len({r.canonical_entity for r in resolved_list})

        return ResolveEntitiesResponse(
            resolved_entities=resolved_list,
            unique_canonical_count=unique_canonicals,
            merged_count=merged_total,
            audit_trail=audit_trail,
        )

    def _get_or_compute_cosine(self, entity_a: EntityItem, entity_b: EntityItem) -> float:
        """Retrieves or calculates semantic embedding cosine similarity between two entities."""
        emb_a = entity_a.embedding
        emb_b = entity_b.embedding

        if not emb_a:
            emb_a = embedding_service.embed_text(entity_a.text)
            entity_a.embedding = emb_a
        if not emb_b:
            emb_b = embedding_service.embed_text(entity_b.text)
            entity_b.embedding = emb_b

        if emb_a and emb_b:
            return float(cosine_similarity(emb_a, emb_b))
        return 0.0

    def _ensure_embeddings(self, entities: List[EntityItem]) -> None:
        """Batch generates embeddings for entities that lack precomputed vectors."""
        missing_indices = [i for i, ent in enumerate(entities) if not ent.embedding]
        if missing_indices:
            texts = [entities[i].text for i in missing_indices]
            vectors = embedding_service.embed_batch(texts)
            for idx, vec in zip(missing_indices, vectors):
                entities[idx].embedding = vec

    def _select_canonical_between_two(self, text_a: str, text_b: str) -> str:
        """Selects the best canonical form between two mentions."""
        is_ac_a = is_potential_acronym(text_a)
        is_ac_b = is_potential_acronym(text_b)

        # Rule 1: Prefer full phrase over acronym (e.g. "Graph Convolutional Network" over "GCN")
        if is_ac_a and not is_ac_b:
            return text_b
        if is_ac_b and not is_ac_a:
            return text_a

        # Rule 2: Prefer standard Title Case or longer descriptive text
        if len(text_a) > len(text_b):
            return text_a
        if len(text_b) > len(text_a):
            return text_b

        # Rule 3: Prefer capitalized text
        if text_a.istitle() and not text_b.istitle():
            return text_a
        if text_b.istitle() and not text_a.istitle():
            return text_b

        return text_a

    def _select_cluster_canonical(self, members: List[EntityItem]) -> str:
        """Selects canonical concept name for an entire cluster of mentions."""
        # Prefer non-acronyms with the highest frequency and title casing
        non_acronyms = [m.text for m in members if not is_potential_acronym(m.text)]
        pool = non_acronyms if non_acronyms else [m.text for m in members]

        # Count frequencies
        freq: Dict[str, int] = {}
        for text in pool:
            freq[text] = freq.get(text, 0) + 1

        # Sort by frequency desc, then length desc
        sorted_candidates = sorted(freq.keys(), key=lambda t: (freq[t], len(t)), reverse=True)
        return sorted_candidates[0]

    def _format_initial_canonical(self, text: str) -> str:
        """Initial formatting for canonical concept string."""
        stripped = text.strip()
        if is_potential_acronym(stripped):
            return stripped.upper()
        # If all lowercase, title case it
        if stripped.islower():
            return stripped.title()
        return stripped
