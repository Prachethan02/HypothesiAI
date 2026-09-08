import logging
import uuid
from typing import List, Dict, Any, Tuple
from app.schemas.topics import TopicGenerationRequest, TopicResult, TopicRepresentation

logger = logging.getLogger(__name__)

class TopicModelingFallback:
    """Fallback mock topic modeler if bertopic isn't installed or fails."""
    def fit_transform(self, texts: List[str], min_topic_size: int = 3) -> Tuple[List[int], Any]:
        logger.info(f"Using fallback topic modeling for {len(texts)} texts")
        # Simple dummy logic: cluster every 3 items into a topic
        topics = []
        for i in range(len(texts)):
            topics.append(i // min_topic_size)
        return topics, None
        
    def get_topic_info(self):
        import pandas as pd
        # Return a dummy dataframe
        return pd.DataFrame([
            {"Topic": 0, "Count": 3, "Name": "0_dummy_topic_model", "Representation": ["dummy", "topic", "model"]}
        ])

    def get_topic(self, topic_id: int):
        return [("dummy", 0.9), ("topic", 0.8), ("model", 0.7)]

    def get_representative_docs(self, topic_id: int):
        return ["Dummy doc 1", "Dummy doc 2"]

class BERTopicService:
    def __init__(self):
        self._is_active = False
        
    def _init_model(self, nr_topics="auto", min_topic_size=3):
        try:
            from bertopic import BERTopic
            from hdbscan import HDBSCAN
            from umap import UMAP
            from sklearn.feature_extraction.text import CountVectorizer

            # We use a simple config suitable for small/medium sets
            umap_model = UMAP(n_neighbors=min(15, min_topic_size), n_components=5, min_dist=0.0, metric='cosine', random_state=42)
            hdbscan_model = HDBSCAN(min_cluster_size=min_topic_size, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
            vectorizer_model = CountVectorizer(stop_words="english", min_df=1, ngram_range=(1, 2))

            model = BERTopic(
                umap_model=umap_model,
                hdbscan_model=hdbscan_model,
                vectorizer_model=vectorizer_model,
                nr_topics=nr_topics if nr_topics != "auto" else None, # "auto" will reduce automatically
                language="english",
                calculate_probabilities=False
            )
            self._is_active = True
            return model
        except Exception as e:
            logger.warning(f"Failed to initialize BERTopic. Using fallback. Error: {e}")
            self._is_active = False
            return TopicModelingFallback()

    def generate_topics(self, request: TopicGenerationRequest) -> Tuple[List[TopicResult], Dict[str, int], str]:
        """
        Takes a list of document objects and generates topics.
        Returns: topics, document_mapping, model_id
        """
        texts = [doc.text for doc in request.documents]
        doc_ids = [doc.id for doc in request.documents]
        
        # If very few docs, adjust min_topic_size
        actual_min_size = min(request.min_topic_size, max(2, len(texts) // 3))
        
        nr_topics = request.nr_topics
        if nr_topics and nr_topics != "auto":
            try:
                nr_topics = int(nr_topics)
            except:
                nr_topics = "auto"
                
        model = self._init_model(nr_topics=nr_topics, min_topic_size=actual_min_size)
        
        topics, _ = model.fit_transform(texts)
        
        # document_mapping
        doc_mapping = {doc_id: topic_id for doc_id, topic_id in zip(doc_ids, topics)}
        
        # Topic metadata
        topic_info = model.get_topic_info()
        
        topic_results = []
        for _, row in topic_info.iterrows():
            tid = int(row['Topic'])
            if tid == -1:
                continue # Skip outlier topic
                
            freq = int(row['Count'])
            name = str(row['Name'])
            
            # Representation
            raw_rep = model.get_topic(tid)
            representation = []
            if raw_rep:
                representation = [TopicRepresentation(word=str(w), score=float(s)) for w, s in raw_rep]
                
            # Representative docs
            rep_docs = model.get_representative_docs(tid)
            if not rep_docs:
                # Fallback if bertopic didn't extract representative docs properly
                rep_docs = [t for t, t_id in zip(texts, topics) if t_id == tid][:3]
                
            topic_results.append(TopicResult(
                topic_id=tid,
                name=name,
                representation=representation,
                frequency=freq,
                representative_docs=rep_docs
            ))
            
        model_id = str(uuid.uuid4())
        return topic_results, doc_mapping, model_id

topic_service = BERTopicService()
