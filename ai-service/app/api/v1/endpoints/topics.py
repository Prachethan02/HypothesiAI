import logging
from fastapi import APIRouter, HTTPException

from app.schemas.topics import TopicGenerationRequest, TopicGenerationResponse
from app.pipeline.clustering.hdbscan_service import clustering_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=TopicGenerationResponse)
async def generate_topics(request: TopicGenerationRequest):
    """
    Cluster limitation, future-work, and problem statement embeddings with HDBSCAN.

    Returned clusters are evidence signals only — they are not research gaps.
    Label -1 is HDBSCAN noise/outliers and is preserved with source evidence.
    """
    if not request.documents:
        raise HTTPException(status_code=400, detail="No documents provided for clustering.")

    payload = request
    if payload.min_cluster_size == 3 and payload.min_topic_size and payload.min_topic_size != 3:
        payload.min_cluster_size = payload.min_topic_size

    try:
        clusters, doc_mapping, model_id, stats = clustering_service.cluster_documents(payload)
        return TopicGenerationResponse(
            success=True,
            model_id=model_id,
            algorithm=str(stats.get("algorithm", "hdbscan")),
            min_cluster_size=payload.min_cluster_size,
            signal_kind="evidence_cluster",
            topics=clusters,
            document_mapping=doc_mapping,
            stats=stats,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Error during HDBSCAN clustering: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e
