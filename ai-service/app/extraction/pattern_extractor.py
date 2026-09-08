"""
HypothesiAI — Stage 6: Pattern and Heuristic Scientific Extractor
================================================================
Extracts structured research artifacts using scientific linguistic patterns,
domain taxonomies, and section-conditioned syntactic rules.
Never fabricates data — all spans originate directly from source text segments.
"""
from __future__ import annotations

import re
import logging
from typing import Optional
from app.schemas.pipeline import TextSegment
from app.schemas.extraction import ExtractedEntitySchema
from app.extraction.base import BaseExtractor, build_source_reference, normalize_entity_name

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lexical & Syntactic Dictionaries
# ---------------------------------------------------------------------------

KNOWN_METRICS = [
    "accuracy", "precision", "recall", "f1-score", "f1 score", "f1", "bleu",
    "rouge", "rouge-1", "rouge-2", "rouge-l", "auc-roc", "auc", "roc",
    "perplexity", "rmse", "mse", "mae", "exact match", "em", "top-1 accuracy",
    "top-5 accuracy", "map", "ndcg", "mrr", "spearman correlation",
    "pearson correlation", "latency", "throughput", "parameter count", "flops",
]

KNOWN_METHODS = [
    "transformer", "convolutional neural network", "cnn", "recurrent neural network",
    "rnn", "lstm", "gru", "graph neural network", "gnn", "graph attention network",
    "gat", "graph convolutional network", "gcn", "bert", "distilbert", "roberta",
    "t5", "gpt", "large language model", "llm", "random forest", "support vector machine",
    "svm", "gradient boosting", "xgboost", "lightgbm", "markov chain monte carlo",
    "mcmc", "reinforcement learning", "deep reinforcement learning", "actor-critic",
    "ppo", "q-learning", "contrastive learning", "self-supervised learning",
    "variational autoencoder", "vae", "generative adversarial network", "gan",
    "diffusion model", "attention mechanism", "multi-head attention",
    "cross-attention", "feed-forward network", "encoder-decoder",
]

KNOWN_DATASETS = [
    "imagenet", "cifar-10", "cifar-100", "mnist", "wmt", "wmt 2014", "wmt 2016",
    "glue", "superglue", "squad", "squad 2.0", "mimic-iii", "mimic-iv", "pubmed",
    "arxiv", "pile", "common crawl", "coco", "ms-coco", "voc", "pascal voc",
    "wikipedia", "wikitext-103", "snli", "mnli", "qnli", "sst-2", "mrpc",
    "cola", "imdb", "trec", "triviaqa", "gsm8k", "math", "humaneval",
]

KNOWN_DOMAINS = [
    "biomedical", "healthcare", "clinical", "oncology", "genomics", "neuroscience",
    "computer vision", "natural language processing", "nlp", "speech recognition",
    "robotics", "autonomous systems", "cybersecurity", "quantum computing",
    "materials science", "climate science", "bioinformatics", "pharmacology",
    "software engineering", "astrophysics", "cognitive science",
]

# ---------------------------------------------------------------------------
# Compiled Extraction Regexes
# ---------------------------------------------------------------------------

RE_OBJECTIVE = re.compile(
    r"(?:(?:our|the)\s+(?:primary\s+|main\s+)?(?:objective|goal|aim|purpose)\s+(?:is|was)\s+to\s+([^.;]+)|"
    r"we\s+(?:aim|seek|attempt)\s+to\s+([^.;]+)|"
    r"this\s+(?:paper|work|study|research)\s+(?:presents|proposes|investigates|addresses|aims\s+to)\s+([^.;]+))",
    re.IGNORECASE,
)

RE_LIMITATION = re.compile(
    r"(?:(?:a|one|the|key|main|primary)\s+(?:limitation|weakness|shortcoming|constraint)\s+(?:is|was|of)\s+([^.;]+)|"
    r"(?:our|this)\s+(?:approach|model|method|framework)\s+(?:struggles\s+with|is\s+limited\s+by|fails\s+to)\s+([^.;]+)|"
    r"(?:a\s+potential|notable)\s+drawback\s+(?:is|involves)\s+([^.;]+))",
    re.IGNORECASE,
)

RE_FUTURE_WORK = re.compile(
    r"(?:in\s+future\s+work[,\s]+we\s+(?:plan|intend|hope|aim)\s+to\s+([^.;]+)|"
    r"an\s+(?:open\s+direction|promising\s+direction|open\s+problem)\s+(?:is|remains)\s+([^.;]+)|"
    r"we\s+leave\s+([^.;]+)\s+(?:for|to)\s+future\s+(?:work|research|investigation)|"
    r"future\s+(?:work|research|extensions)\s+(?:will|could|should|may)\s+(?:explore|investigate|focus\s+on)\s+([^.;]+))",
    re.IGNORECASE,
)

RE_FINDING = re.compile(
    r"(?:our\s+(?:results|findings|experiments|evaluations)\s+(?:show|demonstrate|reveal|indicate|suggest)\s+that\s+([^.;]+)|"
    r"we\s+(?:find|observe|discover)\s+that\s+([^.;]+)|"
    r"(?:achieves|achieved|attained)\s+(?:state-of-the-art|superior|competitive|promising)\s+(?:results|performance)\s*(?:on\s+[^.;]+)?)",
    re.IGNORECASE,
)

RE_POPULATION = re.compile(
    r"(?:(?:evaluated|tested|trained|conducted)\s+(?:on|with)\s+(\d+(?:,\d+)?\s+(?:patients|participants|subjects|individuals|cohorts|users|cases|samples|records))|"
    r"cohort\s+of\s+(\d+(?:,\d+)?\s+[^.;,]+)|"
    r"(?:human\s+subjects|clinical\s+trials?|patient\s+population|survey\s+respondents))",
    re.IGNORECASE,
)

RE_DATASET_PATTERN = re.compile(
    r"(?:(?:evaluated|benchmarked|tested|trained|validated)\s+on\s+(?:the\s+)?([A-Z0-9][A-Za-z0-9\-_]+(?:\s+[A-Z0-9][A-Za-z0-9\-_]+)?(?:\s+(?:dataset|benchmark|corpus|collection))?)|"
    r"([A-Z0-9][A-Za-z0-9\-_]+(?:\s+[A-Z0-9][A-Za-z0-9\-_]+)?)\s+(?:benchmark|dataset|corpus|collection))"
)


class PatternHeuristicExtractor(BaseExtractor):
    """
    Precision extractor using linguistic patterns, scientific regexes,
    and domain dictionaries. Guarantees 100% provenance retention.
    """

    @property
    def name(self) -> str:
        return "pattern_heuristic_extractor"

    def extract(self, segments: list[TextSegment]) -> list[ExtractedEntitySchema]:
        entities: list[ExtractedEntitySchema] = []

        for seg in segments:
            text = seg.text
            paper_id = seg.paper_id
            page_num = seg.page_number
            sec = seg.section_type
            heading = seg.heading
            source_ref = build_source_reference(sec, page_num, heading)

            # 1. Research Objectives
            if sec in ("introduction", "abstract", "other"):
                for m in RE_OBJECTIVE.finditer(text):
                    captured = (m.group(1) or m.group(2) or m.group(3) or m.group(0)).strip()
                    if len(captured) >= 10:
                        span = m.group(0).strip()
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=span,
                            entity_type="objective",
                            confidence=0.88,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(captured[:80]),
                            metadata={"matched_pattern": "objective_verb_phrase"},
                        ))

            # 2. Limitations
            # Higher prior if inside limitation section
            is_limit_section = sec == "limitations"
            if is_limit_section:
                # If the entire segment is in the limitations section, extract sentence-level statements
                sentences = re.split(r"(?<=[.!?])\s+", text)
                for s in sentences:
                    s_clean = s.strip()
                    if len(s_clean) >= 20:
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=s_clean,
                            entity_type="limitation",
                            confidence=0.92,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(s_clean[:80]),
                            metadata={"section_context": "limitations_section"},
                        ))
            else:
                for m in RE_LIMITATION.finditer(text):
                    captured = (m.group(1) or m.group(2) or m.group(3) or m.group(0)).strip()
                    if len(captured) >= 10:
                        span = m.group(0).strip()
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=span,
                            entity_type="limitation",
                            confidence=0.85,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(captured[:80]),
                            metadata={"matched_pattern": "limitation_phrase"},
                        ))

            # 3. Future Work
            is_future_section = sec == "future_work"
            if is_future_section:
                sentences = re.split(r"(?<=[.!?])\s+", text)
                for s in sentences:
                    s_clean = s.strip()
                    if len(s_clean) >= 20:
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=s_clean,
                            entity_type="future_work",
                            confidence=0.92,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(s_clean[:80]),
                            metadata={"section_context": "future_work_section"},
                        ))
            else:
                for m in RE_FUTURE_WORK.finditer(text):
                    captured = (m.group(1) or m.group(2) or m.group(3) or m.group(4) or m.group(0)).strip()
                    if len(captured) >= 10:
                        span = m.group(0).strip()
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=span,
                            entity_type="future_work",
                            confidence=0.87,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(captured[:80]),
                            metadata={"matched_pattern": "future_work_phrase"},
                        ))

            # 4. Findings
            if sec in ("results", "abstract", "conclusion", "other"):
                for m in RE_FINDING.finditer(text):
                    captured = (m.group(1) or m.group(2) or m.group(0)).strip()
                    if len(captured) >= 10:
                        span = m.group(0).strip()
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=span,
                            entity_type="finding",
                            confidence=0.84,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(captured[:80]),
                            metadata={"matched_pattern": "finding_claim"},
                        ))

            # 5. Study Population / Domain
            for m in RE_POPULATION.finditer(text):
                span = m.group(0).strip()
                if len(span) >= 5:
                    entities.append(ExtractedEntitySchema(
                        paper_id=paper_id,
                        page_number=page_num,
                        section=sec,
                        text=span,
                        entity_type="population_domain",
                        confidence=0.86,
                        source_reference=source_ref,
                        normalized_name=normalize_entity_name(span),
                        metadata={"type": "population_cohort"},
                    ))

            # Check domain keywords in abstract/introduction
            if sec in ("abstract", "introduction", "other"):
                text_lower = text.lower()
                for dom in KNOWN_DOMAINS:
                    # Match full word boundary
                    if re.search(rf"\b{re.escape(dom)}\b", text_lower):
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=dom.title(),
                            entity_type="population_domain",
                            confidence=0.80,
                            source_reference=source_ref,
                            normalized_name=dom.lower(),
                            metadata={"type": "research_domain"},
                        ))

            # 6. Research Methods (Dictionary & Contextual Mentions)
            text_lower = text.lower()
            for method in KNOWN_METHODS:
                pattern = rf"\b{re.escape(method)}\b"
                match = re.search(pattern, text_lower)
                if match:
                    # Get the original case slice from text
                    start, end = match.span()
                    original_span = text[start:end]
                    # Higher confidence if found in methods section
                    conf = 0.92 if sec == "methods" else 0.82
                    entities.append(ExtractedEntitySchema(
                        paper_id=paper_id,
                        page_number=page_num,
                        section=sec,
                        text=original_span,
                        entity_type="method",
                        confidence=conf,
                        source_reference=source_ref,
                        normalized_name=normalize_entity_name(original_span),
                        metadata={"dictionary": "known_methods"},
                    ))

            # 7. Datasets
            # A. Dictionary-based
            for ds in KNOWN_DATASETS:
                pattern = rf"\b{re.escape(ds)}\b"
                match = re.search(pattern, text_lower)
                if match:
                    start, end = match.span()
                    original_span = text[start:end]
                    entities.append(ExtractedEntitySchema(
                        paper_id=paper_id,
                        page_number=page_num,
                        section=sec,
                        text=original_span,
                        entity_type="dataset",
                        confidence=0.90,
                        source_reference=source_ref,
                        normalized_name=normalize_entity_name(original_span),
                        metadata={"dictionary": "known_datasets"},
                    ))

            # B. Regex pattern-based (e.g. "evaluated on WMT 2014 benchmark", "on SQuAD dataset")
            for m in RE_DATASET_PATTERN.finditer(text):
                captured = (m.group(1) or m.group(2) or "").strip()
                if 2 <= len(captured) <= 40 and not captured.lower().startswith("the "):
                    # Avoid capturing generic words like "Figure 1", "Table 2"
                    if not re.match(r"^(figure|table|section|page|ref|eq)\b", captured, re.IGNORECASE):
                        entities.append(ExtractedEntitySchema(
                            paper_id=paper_id,
                            page_number=page_num,
                            section=sec,
                            text=captured,
                            entity_type="dataset",
                            confidence=0.82,
                            source_reference=source_ref,
                            normalized_name=normalize_entity_name(captured),
                            metadata={"matched_pattern": "dataset_phrase"},
                        ))

            # 8. Metrics
            for metric in KNOWN_METRICS:
                pattern = rf"\b{re.escape(metric)}\b"
                match = re.search(pattern, text_lower)
                if match:
                    start, end = match.span()
                    original_span = text[start:end]
                    conf = 0.90 if sec == "results" else 0.80
                    entities.append(ExtractedEntitySchema(
                        paper_id=paper_id,
                        page_number=page_num,
                        section=sec,
                        text=original_span,
                        entity_type="metric",
                        confidence=conf,
                        source_reference=source_ref,
                        normalized_name=normalize_entity_name(original_span),
                        metadata={"dictionary": "known_metrics"},
                    ))

            # 9. Key Scientific Concepts
            # Extract capitalized multi-word noun phrases that occur in abstract/methods
            if sec in ("abstract", "methods", "introduction"):
                concept_matches = re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b", text)
                for cm in concept_matches:
                    c_text = cm.group(1).strip()
                    # Filter out stopwords / structural terms
                    if not re.match(r"^(This Paper|The Author|Our Method|Figure|Table|Section|In Order|As Shown)\b", c_text):
                        if 4 <= len(c_text) <= 50:
                            entities.append(ExtractedEntitySchema(
                                paper_id=paper_id,
                                page_number=page_num,
                                section=sec,
                                text=c_text,
                                entity_type="concept",
                                confidence=0.75,
                                source_reference=source_ref,
                                normalized_name=normalize_entity_name(c_text),
                                metadata={"type": "scientific_concept_phrase"},
                            ))

        logger.debug("PatternHeuristicExtractor generated %d candidate entities", len(entities))
        return entities
