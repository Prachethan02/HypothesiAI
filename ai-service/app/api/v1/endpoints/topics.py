import logging
from fastapi import APIRouter, HTTPException

from app.schemas.topics import TopicGenerationRequest, TopicGenerationResponse
from app.pipeline.topics.bertopic_service import topic_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/generate", response_model=TopicGenerationResponse)
async def generate_topics(request: TopicGenerationRequest):
    """
    Generates BERTopic clusters from a list of research statements/documents.
    """
    if not request.documents:
        raise HTTPException(status_code=400, detail="No documents provided for topic modeling.")
        
    try:
        topics, doc_mapping, model_id = topic_service.generate_topics(request)
        return TopicGenerationResponse(
            success=True,
            model_id=model_id,
            topics=topics,
            document_mapping=doc_mapping
        )
    except Exception as e:
        logger.error(f"Error during topic generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
