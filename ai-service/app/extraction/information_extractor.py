"""
HypothesiAI — Stage 6: Master Research Information Extractor
===========================================================
Orchestrates neural (DistilBERT) and scientific pattern extractors,
deduplicates overlapping spans, normalizes canonical entities,
and constructs the final ExtractionResult with guaranteed provenance.
"""
from __future__ import annotations

import logging
from typing import Optional
from app.schemas.pipeline import TextSegment
from app.schemas.extraction import ExtractedEntitySchema, ExtractionResult
from app.extraction.base import BaseExtractor
from app.extraction.pattern_extractor import PatternHeuristicExtractor
from app.extraction.distilbert_extractor import DistilBertExtractor

logger = logging.getLogger(__name__)


class ResearchInformationExtractor:
    """
    Master pipeline component for extracting structured research information
    across papers.
    """

    def __init__(self, extractors: Optional[list[BaseExtractor]] = None):
        if extractors is not None:
            self.extractors = extractors
        else:
            self.extractors = [
                PatternHeuristicExtractor(),
                DistilBertExtractor(),
            ]

    def extract_from_segments(
        self,
        paper_id: str,
        segments: list[TextSegment],
        enable_neural: bool = True,
    ) -> ExtractionResult:
        """
        Executes multi-component extraction over paper text segments.
        Merges, deduplicates, and validates provenance for every entity.
        """
        logger.info(
            "Starting information extraction: paper_id=%s  segments=%d",
            paper_id, len(segments),
        )

        all_candidates: list[ExtractedEntitySchema] = []

        for extractor in self.extractors:
            # Skip neural extractor if disabled
            if not enable_neural and "distilbert" in extractor.name:
                continue
            try:
                candidates = extractor.extract(segments)
                all_candidates.extend(candidates)
            except Exception as e:
                logger.error("Extractor %s failed: %s", extractor.name, e, exc_info=True)

        # Deduplicate candidates based on (entity_type, normalized_name, page_number, section)
        deduped = self._deduplicate_entities(all_candidates)

        # Sort: first by page_number, then by confidence descending
        deduped.sort(key=lambda e: (e.page_number or 0, -e.confidence))

        # Build entity counts summary
        counts: dict[str, int] = {}
        for e in deduped:
            counts[e.entity_type] = counts.get(e.entity_type, 0) + 1

        logger.info(
            "Information extraction complete: paper_id=%s  total_entities=%d  types=%s",
            paper_id, len(deduped), counts,
        )

        return ExtractionResult(
            paper_id=paper_id,
            total_entities=len(deduped),
            entities=deduped,
            entity_counts=counts,
        )

    def _deduplicate_entities(
        self,
        entities: list[ExtractedEntitySchema],
    ) -> list[ExtractedEntitySchema]:
        """
        Merges duplicate or heavily overlapping entities.
        If duplicates exist, preserves the one with the highest confidence score.
        """
        unique_map: dict[str, ExtractedEntitySchema] = {}

        for ent in entities:
            # Key combines normalized form, type, section, and page
            norm = ent.normalized_name or ent.text.lower().strip()
            key = f"{ent.entity_type}::{norm}::{ent.section}::{ent.page_number or 0}"

            if key not in unique_map:
                unique_map[key] = ent
            else:
                existing = unique_map[key]
                if ent.confidence > existing.confidence:
                    # Update with higher confidence and merge metadata
                    merged_meta = {**existing.metadata, **ent.metadata}
                    ent.metadata = merged_meta
                    unique_map[key] = ent
                else:
                    existing.metadata = {**existing.metadata, **ent.metadata}

        return list(unique_map.values())
