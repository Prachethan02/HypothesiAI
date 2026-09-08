-- 004_topic_modeling.sql
-- Migration to store BERTopic topic modeling results

CREATE TABLE IF NOT EXISTS topic_modeling_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    model_id VARCHAR(255),
    parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES topic_modeling_runs(id) ON DELETE CASCADE,
    topic_index INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    representation JSONB NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 0,
    representative_docs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (run_id, topic_index)
);

CREATE TABLE IF NOT EXISTS topic_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    document_id VARCHAR(255) NOT NULL, -- Either an entity_id or a paper_id
    document_type VARCHAR(50) NOT NULL, -- 'entity', 'abstract', etc.
    paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_run_id ON topics(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_documents_topic_id ON topic_documents(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_documents_paper_id ON topic_documents(paper_id);
