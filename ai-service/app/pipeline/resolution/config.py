from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class ResolutionConfig:
    """Configurable thresholds and options for research entity normalization."""
    exact_match_threshold: float = 1.0
    rapidfuzz_token_sort_threshold: float = 0.85
    rapidfuzz_ratio_threshold: float = 0.82
    semantic_cosine_threshold: float = 0.82
    hybrid_min_confidence: float = 0.85
    rapidfuzz_weight: float = 0.5
    semantic_weight: float = 0.5
    require_type_match: bool = True
    enable_acronym_matching: bool = True
    acronym_min_confidence: float = 0.95

    @classmethod
    def from_dict(cls, data: dict | None) -> ResolutionConfig:
        if not data:
            return cls()
        valid_keys = {f for f in cls.__dataclass_fields__}
        filtered = {k: v for k, v in data.items() if k in valid_keys and v is not None}
        return cls(**filtered)
