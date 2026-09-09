"""
HypothesiAI – Stage 13: Contradiction Analysis using Natural Language Inference (NLI)
======================================================================================
Compares research findings and claims across different papers.
Pre-filters pairs using semantic similarity so only relevant statements are analyzed.
Classifies relationships into:
  - ENTAILMENT
  - CONTRADICTION
  - NEUTRAL

IMPORTANT: Contradictions detected by the NLI model are candidate signals,
not automatically scientific truth. Verbatim statements and source paper provenance
are preserved for researcher inspection.
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.pipeline.embeddings.embedding_service import embedding_service
from app.schemas.contradictions import (
    NLIStatementItem,
    NLIComparisonItem,
    NLIAnalysisStats,
)

logger = logging.getLogger(__name__)

# Polarity antonyms and directional indicators for high-confidence lexical analysis
DIRECTIONAL_CONFLICTS: List[Tuple[re.Pattern, re.Pattern]] = [
    (re.compile(r"\b(increase|increases|increased|increasing|boost|boosts|higher|elevate|elevates)\b", re.I),
     re.compile(r"\b(decrease|decreases|decreased|decreasing|reduce|reduces|reduced|lower|drop|drops)\b", re.I)),
    (re.compile(r"\b(improve|improves|improved|improving|superior|outperform|outperforms|outperformed|better)\b", re.I),
     re.compile(r"\b(degrade|degrades|degraded|inferior|underperform|underperforms|worse|fail|fails|failed)\b", re.I)),
    (re.compile(r"\b(positive|beneficial|advantageous|effective|promotes)\b", re.I),
     re.compile(r"\b(negative|detrimental|ineffective|inhibits|impairs|harmful)\b", re.I)),
    (re.compile(r"\b(correlates?|correlated|associated|linked|causes?|caused)\b", re.I),
     re.compile(r"\b(no\s+(correlation|association|effect|link)|uncorrelated|fails?\s+to\s+correlate|independent)\b", re.I)),
    (re.compile(r"\b(confirm|confirms|confirmed|validates?|supported|supports)\b", re.I),
     re.compile(r"\b(refute|refutes|refuted|contradict|contradicts|contradicted|disprove|disproven|challenges?)\b", re.I)),
    (re.compile(r"\b(statistically\s+significant|significant\s+(increase|effect|improvement))\b", re.I),
     re.compile(r"\b(statistically\s+insignificant|no\s+significant|negligible|not\s+significant)\b", re.I)),
]

NEGATION_PATTERNS = re.compile(
    r"\b(not|never|no|none|fails?\s+to|cannot|neither|nor|without|little\s+evidence)\b",
    re.I,
)


class NLIService:
    """Natural Language Inference service for cross-paper finding contradiction analysis."""

    def __init__(self, model_name: str = "cross-encoder/nli-deberta-v3-small"):
        self.model_name = model_name
        self._hf_pipeline = None
        self._initialized = False

    def _init_transformer_pipeline(self) -> None:
        """Attempt to load HuggingFace NLI cross-encoder if available."""
        if self._initialized:
            return
        self._initialized = True
        try:
            from transformers import pipeline  # type: ignore
            self._hf_pipeline = pipeline(
                "text-classification",
                model=self.model_name,
                device=-1,
                top_k=None,
            )
            logger.info("Initialized transformer NLI model: %s", self.model_name)
        except Exception as exc:
            logger.warning(
                "HuggingFace transformer NLI pipeline unavailable (%s). "
                "Using deterministic semantic-polarity cross-matching engine.",
                exc,
            )
            self._hf_pipeline = None

    def analyze_findings(
        self,
        statements: List[NLIStatementItem],
        semantic_threshold: float = 0.55,
        min_confidence: float = 0.5,
        max_comparisons: int = 500,
        target_paper_id: Optional[str] = None,
    ) -> Tuple[List[NLIComparisonItem], NLIAnalysisStats]:
        """
        Main entry point:
        1. Pre-filters pairs with high semantic similarity from different papers.
        2. Classifies each pair as ENTAILMENT, CONTRADICTION, or NEUTRAL.
        3. Returns structured comparison evidence with provenance.
        """
        if len(statements) < 2:
            return [], NLIAnalysisStats(
                total_findings=len(statements),
                pairs_evaluated=0,
                contradiction_count=0,
                entailment_count=0,
                neutral_count=0,
            )

        self._init_transformer_pipeline()

        # 1. Semantic Embedding Pre-filtering
        texts = [s.text for s in statements]
        embeddings = np.array(embedding_service.embed_batch(texts, normalize=True), dtype=np.float32)

        # Pairwise cosine similarities
        similarity_matrix = np.dot(embeddings, embeddings.T)
        n = len(statements)

        candidate_pairs: List[Tuple[int, int, float]] = []
        for i in range(n):
            for j in range(i + 1, n):
                s_a = statements[i]
                s_b = statements[j]

                # Must be from different papers!
                if s_a.paper_id == s_b.paper_id:
                    continue

                if target_paper_id and s_a.paper_id != target_paper_id and s_b.paper_id != target_paper_id:
                    continue

                sim = float(similarity_matrix[i, j])
                if sim >= semantic_threshold:
                    candidate_pairs.append((i, j, sim))

        # Sort candidate pairs by semantic similarity descending
        candidate_pairs.sort(key=lambda x: x[2], reverse=True)
        candidate_pairs = candidate_pairs[:max_comparisons]

        comparisons: List[NLIComparisonItem] = []
        contradiction_count = 0
        entailment_count = 0
        neutral_count = 0

        # 2. Relationship Classification
        for idx_a, idx_b, sim in candidate_pairs:
            s_a = statements[idx_a]
            s_b = statements[idx_b]

            label, confidence, probs = self._classify_pair(s_a.text, s_b.text, sim)

            if confidence < min_confidence:
                continue

            if label == "CONTRADICTION":
                contradiction_count += 1
            elif label == "ENTAILMENT":
                entailment_count += 1
            else:
                neutral_count += 1

            comparison_item = NLIComparisonItem(
                id=str(uuid.uuid4()),
                statement_a_id=s_a.statement_id,
                statement_a_text=s_a.text,
                statement_a_page=s_a.page_number,
                statement_a_section=s_a.section_name,
                paper_a_id=s_a.paper_id,
                paper_a_title=s_a.paper_title,
                statement_b_id=s_b.statement_id,
                statement_b_text=s_b.text,
                statement_b_page=s_b.page_number,
                statement_b_section=s_b.section_name,
                paper_b_id=s_b.paper_id,
                paper_b_title=s_b.paper_title,
                nli_label=label,
                confidence=round(confidence, 4),
                semantic_similarity=round(sim, 4),
                probabilities={k: round(v, 4) for k, v in probs.items()},
                status="candidate_signal",
                is_candidate_signal=True,
            )
            comparisons.append(comparison_item)

        stats = NLIAnalysisStats(
            total_findings=len(statements),
            pairs_evaluated=len(comparisons),
            contradiction_count=contradiction_count,
            entailment_count=entailment_count,
            neutral_count=neutral_count,
        )

        return comparisons, stats

    def _classify_pair(
        self, text_a: str, text_b: str, semantic_sim: float
    ) -> Tuple[str, float, Dict[str, float]]:
        """Classify pair into ENTAILMENT, CONTRADICTION, or NEUTRAL with confidence."""
        if self._hf_pipeline is not None:
            try:
                # Format for cross-encoder classification
                input_text = f"{text_a} </s> {text_b}"
                raw_preds = self._hf_pipeline(input_text)[0]
                # Expected format: [{'label': 'CONTRADICTION', 'score': 0.8}, ...]
                label_map = {
                    "CONTRADICTION": 0.0,
                    "ENTAILMENT": 0.0,
                    "NEUTRAL": 0.0,
                }
                for item in raw_preds:
                    l = item["label"].upper()
                    if "CONTRADIC" in l:
                        label_map["CONTRADICTION"] = item["score"]
                    elif "ENTAIL" in l:
                        label_map["ENTAILMENT"] = item["score"]
                    elif "NEUTRAL" in l:
                        label_map["NEUTRAL"] = item["score"]

                best_label = max(label_map, key=lambda k: label_map[k])
                best_conf = label_map[best_label]
                return best_label, best_conf, label_map
            except Exception as e:
                logger.warning("Transformer classification failed (%s), using rule-engine", e)

        # Deterministic semantic polarity & directional conflict engine
        return self._rule_based_classify(text_a, text_b, semantic_sim)

    def _rule_based_classify(
        self, text_a: str, text_b: str, semantic_sim: float
    ) -> Tuple[str, float, Dict[str, float]]:
        """
        Heuristic semantic engine evaluating:
        - Opposing polarities across shared metric/method context
        - Direct directional conflict (increase vs decrease, outperforming vs failing)
        - Negation asymmetry on semantically aligned finding
        """
        has_directional_conflict = False
        for pos_pat, neg_pat in DIRECTIONAL_CONFLICTS:
            if (pos_pat.search(text_a) and neg_pat.search(text_b)) or \
               (neg_pat.search(text_a) and pos_pat.search(text_b)):
                has_directional_conflict = True
                break

        has_negation_a = bool(NEGATION_PATTERNS.search(text_a))
        has_negation_b = bool(NEGATION_PATTERNS.search(text_b))
        negation_flip = has_negation_a != has_negation_b

        # High semantic overlap (>0.75) with direct directional conflict or negation mismatch
        if has_directional_conflict:
            # Strong candidate contradiction
            prob_contra = min(0.95, 0.65 + semantic_sim * 0.3)
            prob_neutral = (1.0 - prob_contra) * 0.7
            prob_entail = (1.0 - prob_contra) * 0.3
            return "CONTRADICTION", prob_contra, {
                "contradiction": prob_contra,
                "entailment": prob_entail,
                "neutral": prob_neutral,
            }

        if negation_flip and semantic_sim >= 0.70:
            prob_contra = min(0.90, 0.55 + semantic_sim * 0.35)
            prob_neutral = (1.0 - prob_contra) * 0.7
            prob_entail = (1.0 - prob_contra) * 0.3
            return "CONTRADICTION", prob_contra, {
                "contradiction": prob_contra,
                "entailment": prob_entail,
                "neutral": prob_neutral,
            }

        if semantic_sim >= 0.78 and not negation_flip:
            # High semantic similarity without opposing polarities indicates agreement
            prob_entail = min(0.92, 0.50 + semantic_sim * 0.45)
            prob_contra = 0.05
            prob_neutral = round(1.0 - prob_entail - prob_contra, 4)
            return "ENTAILMENT", prob_entail, {
                "entailment": prob_entail,
                "contradiction": prob_contra,
                "neutral": prob_neutral,
            }

        # Moderate semantic similarity without direct conflict or strong agreement
        prob_neutral = min(0.85, 0.40 + (1.0 - abs(semantic_sim - 0.6)) * 0.4)
        prob_contra = (1.0 - prob_neutral) * 0.4
        prob_entail = (1.0 - prob_neutral) * 0.6
        return "NEUTRAL", prob_neutral, {
            "neutral": prob_neutral,
            "contradiction": prob_contra,
            "entailment": prob_entail,
        }


nli_service = NLIService()
