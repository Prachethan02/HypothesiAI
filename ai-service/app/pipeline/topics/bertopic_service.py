"""
Stage 11 compatibility wrapper.

Topic generation is implemented as HDBSCAN clustering over MiniLM embeddings.
BERTopic is not required; this module keeps the previous import path working.
"""
from app.pipeline.clustering.hdbscan_service import clustering_service as topic_service
from app.pipeline.clustering.hdbscan_service import HDBSCANClusteringService as BERTopicService

__all__ = ["topic_service", "BERTopicService"]
