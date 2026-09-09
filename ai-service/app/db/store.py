"""
In-memory key-value stores for Stage 11 evidence clustering
and Stage 12 pattern mining.
These act as a process-lifetime fallback when PostgreSQL is unavailable.
"""
from __future__ import annotations
from typing import Any, Dict

# Stage 11 – Evidence Clustering
# {run_id: {run_id, clusters, noise_cluster, doc_mapping, stats}}
evidence_run_store: Dict[str, Any] = {}

# Stage 12 – Pattern Mining
# {run_id: full mine_patterns result dict}
pattern_run_store: Dict[str, Any] = {}

# Stage 13 – Contradiction Analysis
# {run_id: full analysis result dict}
contradiction_run_store: Dict[str, Any] = {}
# {comparison_id: NLIComparisonItem dict}
contradiction_comparisons_store: Dict[str, Any] = {}

# Stage 14 – Unified Evidence Aggregation
# {run_id: full aggregation result dict}
evidence_aggregation_store: Dict[str, Any] = {}

# Stage 15 – Research-Gap Ranking
# {run_id: full ranking result dict}
gap_ranking_store: Dict[str, Any] = {}

# Stage 16 – Evidence-Grounded Hypotheses
# {key: GroundedHypothesis dict}
hypothesis_store: Dict[str, Any] = {}

