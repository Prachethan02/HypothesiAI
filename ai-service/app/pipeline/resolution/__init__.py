from app.pipeline.resolution.config import ResolutionConfig
from app.pipeline.resolution.acronyms import check_acronym_match, is_potential_acronym, RESEARCH_ACRONYM_MAP
from app.pipeline.resolution.guardrails import should_reject_merge, is_type_compatible, is_contrastive_pair
from app.pipeline.resolution.fuzzy import compute_fuzzy_metrics, is_spelling_variation, normalize_text_for_fuzzy
from app.pipeline.resolution.resolver import EntityResolver

__all__ = [
    "ResolutionConfig",
    "check_acronym_match",
    "is_potential_acronym",
    "RESEARCH_ACRONYM_MAP",
    "should_reject_merge",
    "is_type_compatible",
    "is_contrastive_pair",
    "compute_fuzzy_metrics",
    "is_spelling_variation",
    "normalize_text_for_fuzzy",
    "EntityResolver",
]
