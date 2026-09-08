"""
Pydantic schemas for the Stage 5 PDF ingestion pipeline.
Every extracted text segment retains full provenance:
  paper_id · page_number · section_type · heading · text
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    """Request body sent by the backend to trigger PDF parsing."""
    paper_id: str = Field(..., description="UUID of the paper record in PostgreSQL")
    file_path: str = Field(..., description="Absolute or relative path to the uploaded PDF file")
    original_filename: str = Field(default="paper.pdf", description="Original filename for logging")


class TextSegment(BaseModel):
    """
    A single extracted text segment with full provenance.
    This is the atomic unit of extracted content.
    """
    paper_id: str
    page_number: int = Field(..., ge=1, description="1-indexed page number")
    section_type: str = Field(
        ...,
        description=(
            "Detected section: abstract | introduction | related_work | methods | "
            "results | limitations | future_work | conclusion | other"
        ),
    )
    heading: Optional[str] = Field(None, description="Detected heading text, if any")
    text: str = Field(..., description="Extracted text content of this segment")
    char_count: int = Field(default=0)
    word_count: int = Field(default=0)

    def model_post_init(self, __context: object) -> None:
        if not self.char_count:
            object.__setattr__(self, "char_count", len(self.text))
        if not self.word_count:
            object.__setattr__(self, "word_count", len(self.text.split()))


class ParseResult(BaseModel):
    """Complete result of parsing one PDF document."""
    paper_id: str
    total_pages: int
    total_segments: int
    sections_detected: list[str]
    segments: list[TextSegment]
    metadata: dict = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
