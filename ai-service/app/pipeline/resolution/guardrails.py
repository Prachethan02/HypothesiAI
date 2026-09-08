from __future__ import annotations
import re
from typing import Optional, Set, Tuple

# Domain paradigm modifiers that represent fundamentally different families
DISTINCTIVE_MODIFIERS: Set[str] = {
    "graph",
    "convolutional",
    "recurrent",
    "bayesian",
    "quantum",
    "temporal",
    "spatial",
    "generative",
    "contrastive",
    "diffusion",
    "hierarchical",
    "sparse",
    "dense",
    "relational",
    "supervised",
    "unsupervised",
    "self-supervised",
}

# Known contrastive pairs that have high surface string similarity but are distinct
CONTRASTIVE_PAIRS = {
    # Architectures
    (frozenset({"bert", "bart"})),
    (frozenset({"bert", "ernie"})),
    (frozenset({"adam", "adagrad"})),
    (frozenset({"adam", "adamw"})),
    (frozenset({"resnet", "densenet"})),
    (frozenset({"resnet", "resnext"})),
    (frozenset({"cnn", "gcn"})),
    (frozenset({"rnn", "gnn"})),
    (frozenset({"cnn", "rnn"})),
    
    # Metrics
    (frozenset({"precision", "recall"})),
    (frozenset({"bleu", "rouge"})),
    (frozenset({"accuracy", "f1"})),
    (frozenset({"accuracy", "f1 score"})),
    (frozenset({"mse", "mae"})),
    (frozenset({"mse", "rmse"})),
    (frozenset({"mae", "rmse"})),
    (frozenset({"map", "mrr"})),
    
    # Datasets
    (frozenset({"cifar-10", "cifar-100"})),
    (frozenset({"glue", "superglue"})),
    (frozenset({"squad 1.1", "squad 2.0"})),
}


def clean_term(t: str) -> str:
    """Normalize for guardrail checks."""
    return re.sub(r"[^a-z0-9]", "", t.strip().lower())


def is_type_compatible(type_a: Optional[str], type_b: Optional[str]) -> bool:
    """
    Checks whether entity types are compatible.
    Rejects combinations like 'method' vs 'metric', or 'dataset' vs 'limitation'.
    """
    if not type_a or not type_b:
        return True
    ta = type_a.strip().lower()
    tb = type_b.strip().lower()

    if ta == tb:
        return True
    # Generic entity type is compatible with any specific type
    if ta in ("entity", "concept") or tb in ("entity", "concept"):
        return True
    return False


def is_contrastive_pair(text_a: str, text_b: str) -> Tuple[bool, Optional[str]]:
    """Checks if two terms form a known contrastive pair."""
    t1 = text_a.strip().lower()
    t2 = text_b.strip().lower()

    pair = frozenset({t1, t2})
    if pair in CONTRASTIVE_PAIRS:
        return True, f"Explicit contrastive pair: '{text_a}' and '{text_b}' are distinct concepts"

    c1 = clean_term(t1)
    c2 = clean_term(t2)
    clean_pair = frozenset({c1, c2})
    if clean_pair in CONTRASTIVE_PAIRS:
        return True, f"Explicit contrastive pair: '{text_a}' and '{text_b}' are distinct concepts"

    # Numeric version divergence (e.g. GPT-3 vs GPT-4, CIFAR-10 vs CIFAR-100, VGG-16 vs VGG-19)
    v_match = _check_version_mismatch(t1, t2)
    if v_match:
        return True, v_match

    return False, None


def _check_version_mismatch(text_a: str, text_b: str) -> Optional[str]:
    """Detects when terms share a base name but have different version numbers."""
    num_pattern = r"(.*?)(?:[-_\s]*v?(\d+(?:\.\d+)?))$"
    m_a = re.match(num_pattern, text_a.strip().lower())
    m_b = re.match(num_pattern, text_b.strip().lower())

    if m_a and m_b:
        base_a, ver_a = m_a.group(1).strip(), m_a.group(2).strip()
        base_b, ver_b = m_b.group(1).strip(), m_b.group(2).strip()
        if base_a == base_b and ver_a != ver_b:
            return f"Distinct versions: '{text_a}' (v{ver_a}) vs '{text_b}' (v{ver_b})"

    return None


def _stem_word(w: str) -> str:
    """Stems common grammatical and adjective suffixes iteratively."""
    word = w.lower().strip()
    while len(word) > 3:
        new_word = re.sub(r"(al|ed|ing|s|tion|ive)$", "", word)
        if new_word == word:
            break
        word = new_word
    return word

# Distinctive modifier paradigms (stemmed)
STEMMED_DISTINCTIVE_MODIFIERS: Set[str] = {
    _stem_word(m) for m in DISTINCTIVE_MODIFIERS
}


def has_distinctive_modifier_mismatch(text_a: str, text_b: str) -> Tuple[bool, Optional[str]]:
    """
    Detects if one entity contains a paradigm-defining modifier that the other entity completely lacks.
    E.g., "Graph Convolutional Network" vs "Convolutional Neural Network"
    (both contain 'Convolutional', but one has 'Graph').
    """
    words_a = [w for w in re.findall(r"[a-z0-9]+", text_a.lower())]
    words_b = [w for w in re.findall(r"[a-z0-9]+", text_b.lower())]

    # Find stemmed modifiers in each
    stemmed_a = {_stem_word(w) for w in words_a}
    stemmed_b = {_stem_word(w) for w in words_b}

    mods_a = stemmed_a.intersection(STEMMED_DISTINCTIVE_MODIFIERS)
    mods_b = stemmed_b.intersection(STEMMED_DISTINCTIVE_MODIFIERS)

    # If both phrases have at least 2 words and their distinctive modifier sets differ
    if len(words_a) >= 2 and len(words_b) >= 2:
        diff_a = mods_a - mods_b
        diff_b = mods_b - mods_a
        if diff_a or diff_b:
            reasons = []
            if diff_a:
                reasons.append(f"'{text_a}' specifies {list(diff_a)}")
            if diff_b:
                reasons.append(f"'{text_b}' specifies {list(diff_b)}")
            return True, f"Distinctive modifier mismatch: {'; '.join(reasons)}"

    return False, None


def should_reject_merge(
    text_a: str,
    text_b: str,
    type_a: Optional[str] = None,
    type_b: Optional[str] = None,
    require_type_match: bool = True
) -> Tuple[bool, Optional[str]]:
    """
    Evaluates all anti-merging guardrails.
    Returns:
        (should_reject, rejection_rationale)
    """
    # 1. Type compatibility
    if require_type_match and not is_type_compatible(type_a, type_b):
        return True, f"Entity type mismatch: cannot merge '{type_a}' with '{type_b}'"

    # 2. Contrastive pair check
    is_contrast, reason = is_contrastive_pair(text_a, text_b)
    if is_contrast:
        return True, reason

    # 3. Distinctive modifier check
    has_mod_mismatch, mod_reason = has_distinctive_modifier_mismatch(text_a, text_b)
    if has_mod_mismatch:
        return True, mod_reason

    # 4. Short acronym confusion guard:
    # If both are short (<= 4 chars) and not identical
    clean_a = clean_term(text_a)
    clean_b = clean_term(text_b)
    if len(clean_a) <= 4 and len(clean_b) <= 4 and clean_a != clean_b:
        return True, f"Short abbreviations '{text_a}' and '{text_b}' are distinct and cannot be fuzzy-merged"

    return False, None
