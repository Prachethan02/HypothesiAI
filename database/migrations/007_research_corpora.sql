-- ==============================================================================
-- HypothesiAI Migration 007: Research Corpora & Multi-Paper Grouping
-- ==============================================================================

CREATE TABLE IF NOT EXISTS corpora (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    analysis_progress INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS corpus_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corpus_id UUID NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'upload',
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_corpus_paper UNIQUE (corpus_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_corpus_papers_corpus ON corpus_papers(corpus_id);
CREATE INDEX IF NOT EXISTS idx_corpus_papers_paper ON corpus_papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_corpora_user ON corpora(user_id);
