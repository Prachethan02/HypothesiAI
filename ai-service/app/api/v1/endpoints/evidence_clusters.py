"""
Stage 11 – Evidence Clustering endpoint.
POST /evidence-clusters/run  – trigger HDBSCAN clustering
GET  /evidence-clusters       – list clusters from latest run
GET  /evidence-clusters/{run_id} – get a specific run's clusters
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.evidence_clusters import (
    ClusterRunRequest,
    ClusterRunResponse,
    ClusterRunStats,
    ClusterListResponse,
    EvidenceClusterOut,
    EvidenceClusterSummary,
    EvidenceStatementOut,
)
from app.schemas.topics import (
    ClusterDocumentInput,
    ClusterGenerationRequest,
)
from app.pipeline.clustering.hdbscan_service import clustering_service

# In-memory store (fallback when DB is not available)
from app.db.store import evidence_run_store  # lightweight key-value store

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALLOWED_TYPES = {"limitation", "future_work", "problem"}


def _get_db_connection():
    """Return a psycopg2 connection using environment variables."""
    import os
    import psycopg2  # type: ignore

    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "hypothesiai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def _fetch_documents(statement_types: list[str]) -> list[ClusterDocumentInput]:
    """
    Retrieve statements from the database.
    Falls back to an empty list if the DB is unavailable
    (the endpoint will then return a 400 explaining no documents were found).
    """
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()

        placeholders = ",".join([f"%s" for _ in statement_types])
        cursor.execute(
            f"""
            SELECT e.id, e.text, e.entity_type, e.paper_id,
                   p.title AS paper_title
            FROM extracted_entities e
            LEFT JOIN papers p ON p.id = e.paper_id
            WHERE e.entity_type IN ({placeholders})
              AND e.text IS NOT NULL
              AND LENGTH(TRIM(e.text)) > 10
            ORDER BY e.created_at DESC
            LIMIT 5000
            """,
            statement_types,
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        docs: list[ClusterDocumentInput] = []
        for row in rows:
            entity_id, text, entity_type, paper_id, paper_title = row
            docs.append(
                ClusterDocumentInput(
                    id=str(entity_id),
                    text=text,
                    metadata={
                        "statement_type": entity_type,
                        "paper_id": str(paper_id) if paper_id else None,
                        "paper_title": paper_title or "",
                    },
                )
            )
        return docs
    except Exception as exc:
        logger.warning("Could not fetch documents from DB: %s", exc)
        return []


def _cluster_result_to_out(cr) -> EvidenceClusterOut:
    return EvidenceClusterOut(
        cluster_id=cr.cluster_id,
        is_noise=cr.is_noise,
        statement_type=cr.statement_type,
        name=cr.name,
        summary=cr.summary,
        size=cr.size,
        paper_count=cr.paper_count,
        paper_ids=cr.paper_ids,
        representative_statements=cr.representative_statements,
        top_terms=[{"word": r.word, "score": r.score} for r in cr.representation],
        evidence=[
            EvidenceStatementOut(
                document_id=e.document_id,
                paper_id=e.paper_id,
                paper_title=e.paper_title,
                statement_type=e.statement_type,
                text=e.text,
                similarity_to_centroid=e.similarity_to_centroid,
                is_representative=e.is_representative,
            )
            for e in cr.evidence
        ],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/run", response_model=ClusterRunResponse, status_code=200)
async def run_clustering(req: ClusterRunRequest):
    """
    Trigger HDBSCAN clustering on limitation / future-work / problem statements.

    Clusters are **evidence signals** – they are NOT automatically research gaps.
    HDBSCAN noise points (label -1) are preserved and returned separately.
    """
    types = [t for t in req.statement_types if t in ALLOWED_TYPES]
    if not types:
        raise HTTPException(
            status_code=400,
            detail=f"statement_types must include at least one of: {sorted(ALLOWED_TYPES)}",
        )

    if req.documents and len(req.documents) > 0:
        documents = [
            ClusterDocumentInput(
                id=str(d.get("id", str(uuid.uuid4()))),
                text=str(d.get("text", "")),
                metadata=d.get("metadata", {}),
            )
            for d in req.documents
            if d.get("text") and len(str(d.get("text", "")).strip()) > 5
        ]
    else:
        documents = _fetch_documents(types)

    if not documents:
        raise HTTPException(
            status_code=400,
            detail=(
                "No statements of the requested types were found. "
                "Upload and process at least one paper first."
            ),
        )

    gen_request = ClusterGenerationRequest(
        documents=documents,
        min_cluster_size=req.min_cluster_size,
        min_samples=req.min_samples,
    )

    try:
        clusters, doc_mapping, model_id, raw_stats = clustering_service.cluster_documents(gen_request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Clustering failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Clustering failed: {exc}") from exc

    run_id = model_id  # reuse UUID generated by the service
    stats = ClusterRunStats(**raw_stats)

    out_clusters = []
    noise_cluster: Optional[EvidenceClusterOut] = None
    for cr in clusters:
        out = _cluster_result_to_out(cr)
        if cr.is_noise:
            noise_cluster = out
        else:
            out_clusters.append(out)

    if not req.include_noise:
        noise_cluster = None

    # Persist to in-memory store (DB persistence happens via Node backend)
    evidence_run_store[run_id] = {
        "run_id": run_id,
        "clusters": out_clusters,
        "noise_cluster": noise_cluster,
        "doc_mapping": doc_mapping,
        "stats": stats,
    }

    return ClusterRunResponse(
        success=True,
        run_id=run_id,
        clusters=out_clusters,
        noise_cluster=noise_cluster,
        document_mapping=doc_mapping,
        stats=stats,
    )


@router.get("", response_model=ClusterListResponse)
async def list_clusters(
    run_id: Optional[str] = Query(default=None, description="Filter by specific run ID."),
):
    """
    Return a lightweight list of evidence clusters from the latest (or specified) run.
    Full evidence details are available via the individual run endpoint.
    """
    target_id = run_id
    if not target_id:
        # Return the most recent run
        if not evidence_run_store:
            return ClusterListResponse(success=True)
        target_id = list(evidence_run_store.keys())[-1]

    run_data = evidence_run_store.get(target_id)
    if not run_data:
        # Try DB
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM evidence_cluster_runs WHERE id = %s AND status = 'completed'",
                (target_id,),
            )
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            if not row:
                raise HTTPException(status_code=404, detail=f"Run {target_id} not found.")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=404, detail=f"Run {target_id} not found.")

    clusters_out = run_data.get("clusters", [])
    noise_cluster = run_data.get("noise_cluster")
    stats = run_data.get("stats")

    summaries = [
        EvidenceClusterSummary(
            cluster_id=c.cluster_id,
            is_noise=c.is_noise,
            statement_type=c.statement_type,
            name=c.name,
            summary=c.summary,
            size=c.size,
            paper_count=c.paper_count,
        )
        for c in clusters_out
    ]
    if noise_cluster:
        summaries.append(
            EvidenceClusterSummary(
                cluster_id=noise_cluster.cluster_id,
                is_noise=True,
                statement_type=noise_cluster.statement_type,
                name=noise_cluster.name,
                summary=noise_cluster.summary,
                size=noise_cluster.size,
                paper_count=noise_cluster.paper_count,
            )
        )

    total_clustered = sum(c.size for c in clusters_out)
    noise_count = noise_cluster.size if noise_cluster else 0

    return ClusterListResponse(
        success=True,
        run_id=target_id,
        clusters=summaries,
        noise_count=noise_count,
        total_clustered=total_clustered,
        stats=stats,
    )


@router.get("/{run_id}/detail", response_model=ClusterRunResponse)
async def get_run_detail(run_id: str):
    """Return full cluster details (including all evidence statements) for a given run."""
    run_data = evidence_run_store.get(run_id)
    if not run_data:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")

    return ClusterRunResponse(
        success=True,
        run_id=run_id,
        clusters=run_data["clusters"],
        noise_cluster=run_data.get("noise_cluster"),
        document_mapping=run_data.get("doc_mapping", {}),
        stats=run_data["stats"],
    )
