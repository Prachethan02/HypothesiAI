"""
HypothesiAI Modular AI & NLP Pipeline Architecture

Stages:
- parsers: PyMuPDF PDF parser and section extractor
- extractors: DistilBERT entity and limitation extractor
- embeddings: Sentence-Transformers (MiniLM) dense semantic embeddings
- clustering: BERTopic and HDBSCAN limitation/future-work clustering
- patterns: FP-Growth / Apriori frequent research-pattern mining
- nli: Cross-Encoder NLI contradiction detector
- ranking: Multi-signal evidence fusion and research-gap ranker
- llm: Strictly grounded hypothesis generator
"""

__all__ = [
    "parsers",
    "extractors",
    "embeddings",
    "clustering",
    "patterns",
    "nli",
    "ranking",
    "llm",
]
