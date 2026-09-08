from __future__ import annotations
import re
from typing import Dict, Tuple
from rapidfuzz import fuzz, distance


def normalize_text_for_fuzzy(text: str) -> str:
    """Normalize text by lowercasing, replacing hyphens/underscores with spaces, and trimming."""
    cleaned = re.sub(r"[-_]", " ", text.strip().lower())
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def compute_fuzzy_metrics(text_a: str, text_b: str) -> Dict[str, float]:
    """
    Computes multiple RapidFuzz similarity metrics between two texts.
    All scores are normalized to [0.0, 1.0].
    """
    norm_a = normalize_text_for_fuzzy(text_a)
    norm_b = normalize_text_for_fuzzy(text_b)

    if norm_a == norm_b:
        return {
            "ratio": 1.0,
            "token_sort_ratio": 1.0,
            "token_set_ratio": 1.0,
            "partial_ratio": 1.0,
            "levenshtein": 1.0,
            "composite": 1.0,
        }

    r = fuzz.ratio(norm_a, norm_b) / 100.0
    tsr = fuzz.token_sort_ratio(norm_a, norm_b) / 100.0
    tset = fuzz.token_set_ratio(norm_a, norm_b) / 100.0
    pr = fuzz.partial_ratio(norm_a, norm_b) / 100.0
    lev = distance.Levenshtein.normalized_similarity(norm_a, norm_b)

    # Composite weighted RapidFuzz score:
    # Emphasizes token sort ratio for word-order invariance and levenshtein for typos
    composite = 0.5 * tsr + 0.3 * lev + 0.2 * r

    return {
        "ratio": round(r, 4),
        "token_sort_ratio": round(tsr, 4),
        "token_set_ratio": round(tset, 4),
        "partial_ratio": round(pr, 4),
        "levenshtein": round(lev, 4),
        "composite": round(composite, 4),
    }


def is_spelling_variation(
    text_a: str,
    text_b: str,
    token_sort_threshold: float = 0.85,
    ratio_threshold: float = 0.82
) -> Tuple[bool, float, Dict[str, float]]:
    """
    Evaluates whether two texts represent spelling or morphological variations
    (e.g., 'Graph Convolution Network' vs 'Graph Convolutional Network',
    or 'Multihead Self-Attention' vs 'Multi-head Self Attention').
    """
    metrics = compute_fuzzy_metrics(text_a, text_b)
    tsr = metrics["token_sort_ratio"]
    comp = metrics["composite"]

    # Match if token sort ratio passes threshold OR composite score is very high
    is_match = (tsr >= token_sort_threshold) or (comp >= ratio_threshold)
    score = max(tsr, comp)

    return is_match, score, metrics
