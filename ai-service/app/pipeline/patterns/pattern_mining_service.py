"""
HypothesiAI – Stage 12: Research Pattern Mining
================================================
Uses Apriori / FP-Growth (mlxtend) to discover frequent entity-combination
patterns across papers (Method+Dataset, Method+Metric, Method+Domain,
Method+Dataset+Metric).

Observed combinations are compared against ALL candidate combinations to
surface potentially underexplored combinations.

IMPORTANT: An absent or rare combination is labelled "underexplored candidate"
only. Apriori/FP-Growth does NOT directly prove a research gap.
"""
from __future__ import annotations

import itertools
import logging
import uuid
from collections import defaultdict
from typing import Any
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Entity types used in pattern mining
# ---------------------------------------------------------------------------
COMBO_SPECS: list[tuple[str, ...]] = [
    ("method", "dataset"),
    ("method", "metric"),
    ("method", "domain"),
    ("method", "dataset", "metric"),
]

MIN_SUPPORT_DEFAULT = 0.02          # 2 % of transactions
MIN_CONFIDENCE_DEFAULT = 0.3        # 30 %
MAX_CANDIDATE_COMBOS = 5000         # guard against combinatorial explosion
UNDEREXPLORED_SUPPORT_THRESHOLD = 0.01   # below 1 % → candidate for underexplored


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    return text.lower().strip()


def _build_transactions(
    entities_by_paper: dict[str, list[dict[str, Any]]],
) -> tuple[list[frozenset[str]], dict[str, list[str]]]:
    """
    Build one transaction (basket) per paper.
    Each item is  "<entity_type>:<normalized_name>".
    Also returns a mapping  item -> list[paper_id].
    """
    transactions: list[frozenset[str]] = []
    item_papers: dict[str, list[str]] = defaultdict(list)
    relevant_types = {"method", "dataset", "metric", "domain"}

    for paper_id, entities in entities_by_paper.items():
        basket: set[str] = set()
        for ent in entities:
            etype = _normalize(str(ent.get("entity_type", "")))
            if etype not in relevant_types:
                continue
            name = _normalize(str(ent.get("normalized_name") or ent.get("text", "")))
            if not name or len(name) < 2 or len(name) > 60:
                continue
            item = f"{etype}:{name}"
            basket.add(item)
            item_papers[item].append(paper_id)
        if basket:
            transactions.append(frozenset(basket))

    return transactions, dict(item_papers)


def _run_fpgrowth(
    transactions: list[frozenset[str]],
    min_support: float,
) -> pd.DataFrame:
    """Run FP-Growth (falls back to Apriori if mlxtend.frequent_patterns.fpgrowth fails)."""
    try:
        from mlxtend.preprocessing import TransactionEncoder
        from mlxtend.frequent_patterns import fpgrowth

        te = TransactionEncoder()
        te_array = te.fit_transform(list(list(t) for t in transactions))
        df = pd.DataFrame(te_array, columns=te.columns_)
        freq = fpgrowth(df, min_support=min_support, use_colnames=True, max_len=3)
        return freq
    except Exception as exc:
        logger.warning("FP-Growth failed (%s), falling back to Apriori.", exc)
        try:
            from mlxtend.preprocessing import TransactionEncoder
            from mlxtend.frequent_patterns import apriori

            te = TransactionEncoder()
            te_array = te.fit_transform(list(list(t) for t in transactions))
            df = pd.DataFrame(te_array, columns=te.columns_)
            freq = apriori(df, min_support=min_support, use_colnames=True, max_len=3)
            return freq
        except Exception as exc2:
            logger.error("Apriori also failed: %s", exc2)
            return pd.DataFrame(columns=["support", "itemsets"])


def _association_rules(
    freq_df: pd.DataFrame,
    min_confidence: float,
) -> pd.DataFrame:
    """Derive association rules from frequent itemsets."""
    try:
        from mlxtend.frequent_patterns import association_rules

        if freq_df.empty:
            return pd.DataFrame()
        rules = association_rules(freq_df, metric="confidence", min_threshold=min_confidence)
        return rules
    except Exception as exc:
        logger.warning("Association rules failed: %s", exc)
        return pd.DataFrame()


def _filter_combo(itemset: frozenset[str], combo_spec: tuple[str, ...]) -> bool:
    """Return True if itemset contains exactly the required entity types."""
    types_in_set = set(item.split(":", 1)[0] for item in itemset)
    return set(combo_spec) <= types_in_set


def _items_for_types(
    itemset: frozenset[str], entity_types: tuple[str, ...]
) -> tuple[str, ...]:
    """Extract one representative item per required entity type."""
    result: list[str] = []
    for etype in entity_types:
        for item in sorted(itemset):
            if item.startswith(f"{etype}:"):
                result.append(item)
                break
    return tuple(result)


def _underexplored_score(
    observed_support: float | None,
    n_papers_total: int,
    combo_size: int,
) -> float:
    """
    Heuristic score in [0, 1].
    Higher = more underexplored (lower support, larger combo, more papers).
    This is a signal indicator, NOT proof of a research gap.
    """
    if observed_support is None:
        base = 1.0
    else:
        base = max(0.0, 1.0 - observed_support * 10)
    size_bonus = min(1.0, (combo_size - 1) * 0.2)
    scale = min(1.0, np.log1p(n_papers_total) / 10)
    return round(float(base * 0.6 + size_bonus * 0.2 + scale * 0.2), 4)


# ---------------------------------------------------------------------------
# Main service function
# ---------------------------------------------------------------------------

def mine_patterns(
    entities_by_paper: dict[str, list[dict[str, Any]]],
    min_support: float = MIN_SUPPORT_DEFAULT,
    min_confidence: float = MIN_CONFIDENCE_DEFAULT,
    algorithm: str = "fpgrowth",
) -> dict[str, Any]:
    """
    Mine frequent research patterns and identify underexplored candidates.

    Parameters
    ----------
    entities_by_paper : dict[paper_id -> list[entity_dict]]
        Each entity dict must have keys: entity_type, text, normalized_name (optional).
    min_support : float
        Minimum support threshold for FP-Growth / Apriori.
    min_confidence : float
        Minimum confidence for association rules.
    algorithm : str
        "fpgrowth" or "apriori".

    Returns
    -------
    dict with:
        run_id, algorithm, n_papers, frequent_patterns, association_rules,
        underexplored_candidates
    """
    run_id = str(uuid.uuid4())
    n_papers = len(entities_by_paper)

    if n_papers == 0:
        return {
            "run_id": run_id,
            "algorithm": algorithm,
            "n_papers": 0,
            "frequent_patterns": [],
            "association_rules": [],
            "underexplored_candidates": [],
            "error": "No papers provided.",
        }

    transactions, item_papers = _build_transactions(entities_by_paper)
    logger.info("Pattern mining: %d papers, %d transactions.", n_papers, len(transactions))

    # ── Frequent itemsets ────────────────────────────────────────────────────
    freq_df = _run_fpgrowth(transactions, min_support)
    rules_df = _association_rules(freq_df, min_confidence)

    # ── Build frequent-pattern records ────────────────────────────────────────
    frequent_patterns: list[dict[str, Any]] = []
    observed_combos: set[tuple[str, ...]] = set()   # for underexplored comparison

    for _, row in freq_df.iterrows():
        itemset: frozenset[str] = row["itemsets"]
        support: float = float(row["support"])
        n_papers_with = int(round(support * len(transactions)))

        # Collect source papers for this itemset
        paper_ids_for_pattern: set[str] = set()
        for item in itemset:
            for pid in item_papers.get(item, []):
                paper_ids_for_pattern.add(pid)

        # Check which combo specs this itemset satisfies
        matching_specs = [
            spec for spec in COMBO_SPECS if _filter_combo(itemset, spec)
        ]

        if matching_specs or len(itemset) >= 2:
            key = tuple(sorted(itemset))
            observed_combos.add(key)
            types_present = sorted({item.split(":", 1)[0] for item in itemset})
            pattern_label = " + ".join(
                f"{t.capitalize()}:{item.split(':',1)[1]}"
                for t in types_present
                for item in sorted(itemset)
                if item.startswith(f"{t}:")
            )
            frequent_patterns.append({
                "pattern_id": str(uuid.uuid4()),
                "run_id": run_id,
                "pattern_label": pattern_label,
                "items": sorted(itemset),
                "entity_types": types_present,
                "support": round(support, 6),
                "paper_count": n_papers_with,
                "paper_ids": sorted(paper_ids_for_pattern),
                "algorithm": algorithm,
                "combo_type": " + ".join(
                    [s.capitalize() for spec in matching_specs for s in spec]
                ) if matching_specs else "other",
            })

    # ── Association rules records ─────────────────────────────────────────────
    assoc_rules: list[dict[str, Any]] = []
    if not rules_df.empty:
        for _, row in rules_df.iterrows():
            antecedent = sorted(row["antecedents"])
            consequent = sorted(row["consequents"])
            paper_ids_union: set[str] = set()
            for item in antecedent + consequent:
                paper_ids_union.update(item_papers.get(item, []))
            assoc_rules.append({
                "rule_id": str(uuid.uuid4()),
                "run_id": run_id,
                "antecedent": antecedent,
                "consequent": consequent,
                "support": round(float(row["support"]), 6),
                "confidence": round(float(row["confidence"]), 6),
                "lift": round(float(row.get("lift", 1.0)), 4),
                "paper_count": int(round(float(row["support"]) * len(transactions))),
                "paper_ids": sorted(paper_ids_union),
            })

    # ── Underexplored candidates ─────────────────────────────────────────────
    underexplored: list[dict[str, Any]] = []

    # Collect all items per type
    items_by_type: dict[str, list[str]] = defaultdict(list)
    for item in item_papers.keys():
        etype, ename = item.split(":", 1)
        if etype not in items_by_type or item not in items_by_type[etype]:
            items_by_type[etype].append(item)

    support_lookup: dict[tuple[str, ...], float] = {}
    for fp in frequent_patterns:
        key = tuple(sorted(fp["items"]))
        support_lookup[key] = fp["support"]

    total_candidates = 0
    for spec in COMBO_SPECS:
        type_item_lists = [items_by_type.get(t, []) for t in spec]
        if any(not lst for lst in type_item_lists):
            continue

        for combo in itertools.product(*type_item_lists):
            total_candidates += 1
            if total_candidates > MAX_CANDIDATE_COMBOS:
                logger.warning("Candidate combos capped at %d.", MAX_CANDIDATE_COMBOS)
                break

            key = tuple(sorted(combo))
            observed_support = support_lookup.get(key)

            if observed_support is not None and observed_support >= UNDEREXPLORED_SUPPORT_THRESHOLD:
                continue   # well-observed, skip

            score = _underexplored_score(observed_support, n_papers, len(spec))
            if score < 0.25:
                continue   # not notably underexplored

            # Build paper evidence from individual items
            evidence_papers: set[str] = set()
            for item in combo:
                evidence_papers.update(item_papers.get(item, []))

            combo_label = " + ".join(
                f"{t.capitalize()}:{item.split(':',1)[1]}"
                for t, item in zip(spec, combo)
            )
            underexplored.append({
                "candidate_id": str(uuid.uuid4()),
                "run_id": run_id,
                "combo_type": " + ".join(s.capitalize() for s in spec),
                "items": sorted(combo),
                "combo_label": combo_label,
                "observed_support": observed_support,
                "underexplored_score": score,
                "paper_count": len(evidence_papers),
                "paper_ids": sorted(evidence_papers),
                "label": "underexplored candidate",  # NEVER "research gap"
                "note": (
                    "This combination appears rarely or not at all in the corpus. "
                    "This is an evidence signal only — it does not confirm a research gap."
                ),
            })

        if total_candidates > MAX_CANDIDATE_COMBOS:
            break

    # Sort by underexplored_score descending
    underexplored.sort(key=lambda x: x["underexplored_score"], reverse=True)

    logger.info(
        "Pattern mining complete: %d frequent patterns, %d rules, %d underexplored candidates.",
        len(frequent_patterns), len(assoc_rules), len(underexplored),
    )

    return {
        "run_id": run_id,
        "algorithm": algorithm,
        "n_papers": n_papers,
        "min_support": min_support,
        "min_confidence": min_confidence,
        "frequent_patterns": frequent_patterns,
        "association_rules": assoc_rules,
        "underexplored_candidates": underexplored[:500],  # cap response size
        "stats": {
            "frequent_pattern_count": len(frequent_patterns),
            "association_rule_count": len(assoc_rules),
            "underexplored_candidate_count": len(underexplored),
        },
    }
