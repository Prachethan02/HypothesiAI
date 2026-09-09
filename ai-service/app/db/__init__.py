"""
Lightweight in-memory key-value stores for Stage 11.
These act as a fallback when PostgreSQL is unavailable.
They are module-level singletons (persisted for the lifetime of the process).
"""
from __future__ import annotations
from typing import Any, Dict

# {run_id: {run_id, clusters, noise_cluster, doc_mapping, stats}}
evidence_run_store: Dict[str, Any] = {}
