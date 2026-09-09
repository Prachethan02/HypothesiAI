-- 005_stage11_hdbscan_clusters.sql
-- Stage 11: HDBSCAN clustering of limitation / future-work / problem embeddings.
-- Clusters are evidence signals (not research gaps). Preserves per-statement source evidence.
-- Resolves the Stage-2 `topics` column shape vs 004_topic_modeling.sql conflict.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'topics'
          AND column_name = 'topic_number'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'topics'
          AND column_name = 'run_id'
    ) THEN
        ALTER TABLE topics RENAME TO topics_legacy_v1;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_topics_topic_number;

CREATE TABLE IF NOT EXISTS topic_modeling_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    model_id VARCHAR(255),
    algorithm VARCHAR(50) NOT NULL DEFAULT 'hdbscan',
    min_cluster_size INTEGER NOT NULL DEFAULT 3,
    parameters JSONB DEFAULT '{}'::jsonb,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES topic_modeling_runs(id) ON DELETE CASCADE,
    topic_index INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    statement_type VARCHAR(50) NOT NULL DEFAULT 'mixed',
    summary TEXT,
    representation JSONB NOT NULL DEFAULT '[]'::jsonb,
    frequency INTEGER NOT NULL DEFAULT 0,
    paper_count INTEGER NOT NULL DEFAULT 0,
    is_noise BOOLEAN NOT NULL DEFAULT FALSE,
    signal_kind VARCHAR(50) NOT NULL DEFAULT 'evidence_cluster',
    paper_ids JSONB DEFAULT '[]'::jsonb,
    representative_docs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (run_id, topic_index, statement_type)
);

CREATE TABLE IF NOT EXISTS topic_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    document_id VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    similarity_to_centroid NUMERIC(6, 4),
    is_representative BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE topic_modeling_runs ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'hdbscan';
ALTER TABLE topic_modeling_runs ADD COLUMN IF NOT EXISTS min_cluster_size INTEGER DEFAULT 3;
ALTER TABLE topic_modeling_runs ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb;

ALTER TABLE topics ADD COLUMN IF NOT EXISTS statement_type VARCHAR(50) DEFAULT 'mixed';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS paper_count INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_noise BOOLEAN DEFAULT FALSE;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS signal_kind VARCHAR(50) DEFAULT 'evidence_cluster';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS paper_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE topic_documents ADD COLUMN IF NOT EXISTS similarity_to_centroid NUMERIC(6, 4);
ALTER TABLE topic_documents ADD COLUMN IF NOT EXISTS is_representative BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_topics_run_id ON topics(run_id);
CREATE INDEX IF NOT EXISTS idx_topics_statement_type ON topics(statement_type);
CREATE INDEX IF NOT EXISTS idx_topics_is_noise ON topics(is_noise);
CREATE INDEX IF NOT EXISTS idx_topic_documents_topic_id ON topic_documents(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_documents_paper_id ON topic_documents(paper_id);
CREATE INDEX IF NOT EXISTS idx_topic_modeling_runs_status ON topic_modeling_runs(status);
