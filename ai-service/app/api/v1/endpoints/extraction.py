"""
HypothesiAI — Stage 6: Extraction API Endpoint
=============================================
POST /api/v1/extraction/extract
Extracts structured research information from parsed text segments.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status
from app.schemas.extraction import ExtractionRequest, ExtractionResult
from app.extraction.information_extractor import ResearchInformationExtractor

logger = logging.getLogger(__name__)
router = APIRouter()

# Global extractor instance
extractor = ResearchInformationExtractor()


@router.post(
    "/extract",
    response_model=ExtractionResult,
    summary="Extract structured research information from paper segments",
    description=(
        "Extracts research methods, datasets, metrics, concepts, findings, limitations, "
        "future work directions, research objectives, and study population/domain. "
        "Every extracted item retains full source reference and confidence score."
    ),
    status_code=status.HTTP_200_OK,
)
async def extract_research_information(request: ExtractionRequest) -> ExtractionResult:
    """
    Trigger structured extraction for a given paper across its text segments.
    """
    if not request.segments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "empty_segments", "message": "At least one text segment is required for extraction"},
        )

    try:
        result = extractor.extract_from_segments(
            paper_id=request.paper_id,
            segments=request.segments,
            enable_neural=request.enable_neural,
        )
        return result
    except Exception as exc:
        logger.exception("Error extracting research information for paper_id=%s", request.paper_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "extraction_error", "message": str(exc)},
        ) from exc
