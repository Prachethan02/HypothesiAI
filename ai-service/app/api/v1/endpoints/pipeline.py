"""
Stage 5: Pipeline processing endpoint.
POST /api/v1/pipeline/process — triggers PDF parsing for a given paper.
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app.schemas.pipeline import ProcessRequest, ParseResult
from app.extraction.pdf_parser import parse_pdf, validate_pdf_file

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/process",
    response_model=ParseResult,
    summary="Process a PDF and extract structured text segments",
    description=(
        "Accepts a paper_id and a file path, validates the PDF, "
        "then runs the modular pdf_parser to extract text segments "
        "with full provenance (paper_id, page_number, section_type, heading, text). "
        "DistilBERT NER is not yet included (Stage 6)."
    ),
    status_code=status.HTTP_200_OK,
)
async def process_paper(request: ProcessRequest) -> ParseResult:
    """
    Trigger the PDF parsing pipeline for a single paper.

    The backend calls this endpoint after saving the uploaded file to disk.
    Results are returned as a ParseResult and the backend is responsible
    for persisting the segments to PostgreSQL.
    """
    logger.info(
        "process_paper called: paper_id=%s  file=%s",
        request.paper_id, request.file_path,
    )

    # 1. Validate file exists and is a readable PDF
    validation = validate_pdf_file(request.file_path)
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "pdf_validation_failed",
                "message": validation["error"],
                "paper_id": request.paper_id,
                "file_path": request.file_path,
            },
        )

    # 2. Parse
    try:
        result = parse_pdf(
            paper_id=request.paper_id,
            file_path=request.file_path,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "file_not_found", "message": str(exc)},
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "parse_error", "message": str(exc)},
        ) from exc
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "dependency_missing", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error parsing paper_id=%s", request.paper_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": str(exc)},
        ) from exc

    logger.info(
        "process_paper complete: paper_id=%s  segments=%d  pages=%d",
        request.paper_id, result.total_segments, result.total_pages,
    )
    return result
