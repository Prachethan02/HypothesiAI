"""
HypothesiAI — Stage 6: Base Extractor Interface
===============================================
Abstract interface for modular research-information extractors.
Enables pluggable models (DistilBERT, SciBERT, BioBERT, pattern/rule components).
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import Optional
from app.schemas.pipeline import TextSegment
from app.schemas.extraction import ExtractedEntitySchema


def build_source_reference(section: str, page_number: Optional[int], heading: Optional[str] = None) -> str:
    """
    Construct a human-readable provenance citation string.
    e.g. "Section: Methods (2. Methodology), Page 3" or "Section: Limitations, Page 4"
    """
    parts: list[str] = []
    sec_label = section.replace("_", " ").title()
    if heading:
        parts.append(f"Section: {sec_label} ({heading})")
    else:
        parts.append(f"Section: {sec_label}")

    if page_number is not None and page_number > 0:
        parts.append(f"Page {page_number}")

    return ", ".join(parts)


def normalize_entity_name(text: str) -> str:
    """
    Clean and canonicalize an entity text span for clustering and indexing.
    - Strips leading/trailing punctuation and quotes
    - Collapses whitespace
    - Lowercases common words and multi-word phrases while preserving
      acronyms (BLEU, BERT), CamelCase (ResNet), and recognized architectures.
    """
    cleaned = re.sub(r"^[\s\"'“”‘«(\[]+|[\s\"'“”’»)\].,;:!?]+$", "", text.strip())
    cleaned = re.sub(r"\s+", " ", cleaned)

    words = cleaned.split()
    if len(words) == 1:
        # All-caps acronym e.g. BLEU, BERT, GNN, F1
        if cleaned.isupper() and len(cleaned) <= 8:
            return cleaned
        # CamelCase / Mixed Case e.g. ResNet, Word2Vec
        if any(c.isupper() for c in cleaned[1:]):
            return cleaned
        # Specific named architectures to preserve capitalized
        if cleaned in ("Transformer", "ResNet", "BERT", "RoBERTa", "DistilBERT"):
            return cleaned
        # Common lowercase entities (e.g. metrics, generic terms)
        if cleaned.lower() in ("accuracy", "precision", "recall", "f1", "perplexity", "latency", "method", "dataset"):
            return cleaned.lower()
        return cleaned

    # For multi-word phrases, lowercase for canonical normalization
    return cleaned.lower()


class BaseExtractor(ABC):
    """
    Abstract base class for all entity and claim extraction components.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the extractor component (for logging and provenance metadata)."""
        pass

    @abstractmethod
    def extract(self, segments: list[TextSegment]) -> list[ExtractedEntitySchema]:
        """
        Execute extraction on a list of text segments.
        Must never fabricate items and must preserve segment provenance.
        """
        pass
