from __future__ import annotations
import re
from typing import Dict, Optional, Tuple

# Comprehensive bidirectional knowledge base of common scientific and research acronyms
RESEARCH_ACRONYM_MAP: Dict[str, str] = {
    # Architectures & Models
    "GCN": "Graph Convolutional Network",
    "GAT": "Graph Attention Network",
    "GNN": "Graph Neural Network",
    "CNN": "Convolutional Neural Network",
    "RNN": "Recurrent Neural Network",
    "LSTM": "Long Short-Term Memory",
    "GRU": "Gated Recurrent Unit",
    "MLP": "Multilayer Perceptron",
    "BERT": "Bidirectional Encoder Representations from Transformers",
    "ROBERTA": "Robustly Optimized BERT Approach",
    "BART": "Bidirectional and Auto-Regressive Transformers",
    "GPT": "Generative Pre-trained Transformer",
    "LLM": "Large Language Model",
    "GAN": "Generative Adversarial Network",
    "VAE": "Variational Autoencoder",
    "SVM": "Support Vector Machine",
    "MCMC": "Markov Chain Monte Carlo",
    "HMM": "Hidden Markov Model",
    
    # Optimization & Learning
    "SGD": "Stochastic Gradient Descent",
    "RL": "Reinforcement Learning",
    "DQN": "Deep Q-Network",
    "PPO": "Proximal Policy Optimization",
    "DDPG": "Deep Deterministic Policy Gradient",
    
    # Domains & Tasks
    "NLP": "Natural Language Processing",
    "CV": "Computer Vision",
    "IR": "Information Retrieval",
    "NER": "Named Entity Recognition",
    "POS": "Part of Speech",
    "NMT": "Neural Machine Translation",
    "ASR": "Automatic Speech Recognition",
    "TTS": "Text to Speech",
    "SOTA": "State of the Art",
    
    # Metrics
    "BLEU": "Bilingual Evaluation Understudy",
    "ROUGE": "Recall-Oriented Understudy for Gisting Evaluation",
    "AUC": "Area Under Curve",
    "ROC": "Receiver Operating Characteristic",
    "AUC-ROC": "Area Under Receiver Operating Characteristic Curve",
    "MSE": "Mean Squared Error",
    "RMSE": "Root Mean Squared Error",
    "MAE": "Mean Absolute Error",
    "MAP": "Mean Average Precision",
    "MRR": "Mean Reciprocal Rank",
    "NDCG": "Normalized Discounted Cumulative Gain",
    "F1": "F1 Score",
}

STOP_WORDS_ACRONYM = {"of", "the", "and", "in", "for", "from", "with", "on", "at", "by", "to", "an", "a"}


def is_potential_acronym(text: str) -> bool:
    """Returns True if text appears to be an acronym (short, mostly uppercase/alphanumeric)."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", text)
    if not (2 <= len(cleaned) <= 8):
        return False
    # If text is all uppercase or has at least 70% uppercase letters
    upper_count = sum(1 for c in cleaned if c.isupper())
    return (upper_count / len(cleaned)) >= 0.7


def extract_initials(text: str) -> str:
    """Extracts first letters of significant words from a phrase."""
    words = re.findall(r"[A-Za-z0-9]+", text)
    initials = []
    for w in words:
        if w.lower() in STOP_WORDS_ACRONYM and len(words) > 3:
            continue
        initials.append(w[0].upper())
    return "".join(initials)


def check_acronym_match(text_a: str, text_b: str) -> Tuple[bool, float, Optional[str], Optional[str]]:
    """
    Checks if one text is an acronym/abbreviation of the other.
    Returns:
        (is_match, similarity_score, canonical_entity, rationale)
    """
    norm_a = text_a.strip()
    norm_b = text_b.strip()

    upper_a = re.sub(r"[^A-Za-z0-9]", "", norm_a).upper()
    upper_b = re.sub(r"[^A-Za-z0-9]", "", norm_b).upper()

    # Case 1: Direct lookup in knowledge base
    if upper_a in RESEARCH_ACRONYM_MAP:
        target_expansion = RESEARCH_ACRONYM_MAP[upper_a]
        # Check if text_b matches the target expansion or a close variant
        # (e.g. "Graph Convolution Network" vs "Graph Convolutional Network")
        if _is_acronym_expansion_variant(norm_b, target_expansion):
            return True, 0.98, target_expansion, f"Direct acronym lookup: '{norm_a}' expands to '{target_expansion}'"

    if upper_b in RESEARCH_ACRONYM_MAP:
        target_expansion = RESEARCH_ACRONYM_MAP[upper_b]
        if _is_acronym_expansion_variant(norm_a, target_expansion):
            return True, 0.98, target_expansion, f"Direct acronym lookup: '{norm_b}' expands to '{target_expansion}'"

    # Case 2: Dynamic initials matching
    short_candidate, long_candidate = None, None
    if is_potential_acronym(norm_a) and len(norm_b.split()) >= 2:
        short_candidate, long_candidate = upper_a, norm_b
        prefer_canonical = norm_b
    elif is_potential_acronym(norm_b) and len(norm_a.split()) >= 2:
        short_candidate, long_candidate = upper_b, norm_a
        prefer_canonical = norm_a

    if short_candidate and long_candidate:
        initials = extract_initials(long_candidate)
        if short_candidate == initials:
            return True, 0.95, prefer_canonical, f"Dynamic acronym initials match: '{short_candidate}' matches '{initials}' from '{long_candidate}'"
        
        # Check initials with and without stop words
        all_words = re.findall(r"[A-Za-z0-9]+", long_candidate)
        all_initials = "".join(w[0].upper() for w in all_words)
        if short_candidate == all_initials:
            return True, 0.95, prefer_canonical, f"Dynamic acronym full initials match: '{short_candidate}' matches '{all_initials}'"

    return False, 0.0, None, None


def _is_acronym_expansion_variant(text: str, target: str) -> bool:
    """Checks if text is a recognized grammatical variation of the acronym expansion."""
    t_clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower().split()
    target_clean = re.sub(r"[^a-zA-Z0-9\s]", " ", target).lower().split()

    if t_clean == target_clean:
        return True

    # e.g., "convolution" vs "convolutional"
    if len(t_clean) == len(target_clean):
        mismatches = 0
        for w1, w2 in zip(t_clean, target_clean):
            if w1 == w2:
                continue
            # Stemming / adjective suffixes: -al, -ed, -ing, -s, -tion
            stem1 = re.sub(r"(al|ed|ing|s|tion|ive)$", "", w1)
            stem2 = re.sub(r"(al|ed|ing|s|tion|ive)$", "", w2)
            if stem1 == stem2 and len(stem1) >= 3:
                continue
            mismatches += 1
        return mismatches == 0

    return False
