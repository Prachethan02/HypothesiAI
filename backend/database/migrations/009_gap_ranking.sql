-- Stage 15 – Research-Gap Ranking Engine
-- Creates tables for ranking run metadata and the ranked gap records.

CREATE TABLE IF NOT EXISTS gap_ranking_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status          TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'completed', 'failed')),
    weights_used    JSONB NOT NULL DEFAULT '{}',
    min_composite_score NUMERIC(5,4) NOT NULL DEFAULT 0.10,
    total_candidates    INTEGER,
    ranked_count        INTEGER,
    error_message       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ranked_research_gaps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id              TEXT NOT NULL UNIQUE,
    run_id              UUID REFERENCES gap_ranking_runs(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    composite_score     NUMERIC(6,4) NOT NULL CHECK (composite_score >= 0 AND composite_score <= 1),
    confidence          NUMERIC(6,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    rank                INTEGER NOT NULL,
    evidence_type       TEXT NOT NULL,
    why_identified      TEXT NOT NULL,
    dimensions          JSONB NOT NULL DEFAULT '[]',
    evidence_ids        JSONB NOT NULL DEFAULT '[]',
    source_papers       JSONB NOT NULL DEFAULT '[]',
    source_pages        JSONB NOT NULL DEFAULT '[]',
    source_statements   JSONB NOT NULL DEFAULT '[]',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ranked_gaps_run_id
    ON ranked_research_gaps(run_id);
CREATE INDEX IF NOT EXISTS idx_ranked_gaps_composite_score
    ON ranked_research_gaps(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_ranked_gaps_rank
    ON ranked_research_gaps(rank);
CREATE INDEX IF NOT EXISTS idx_ranked_gaps_evidence_type
    ON ranked_research_gaps(evidence_type);
