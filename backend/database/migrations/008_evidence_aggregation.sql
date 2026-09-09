-- ============================================================
-- Stage 14 – Unified Evidence Aggregation Engine
-- Turns multi-signal analytical outputs into structured candidate research-gap evidence.
-- Does not generate hypotheses.
-- ============================================================

-- 1. Evidence aggregation runs
CREATE TABLE IF NOT EXISTS evidence_aggregation_runs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status                      VARCHAR(20) NOT NULL DEFAULT 'running'
                                    CHECK (status IN ('running', 'completed', 'failed')),
    weights_used                JSONB NOT NULL DEFAULT '{}'::jsonb,
    min_score                   NUMERIC(4, 3) NOT NULL DEFAULT 0.200,
    candidate_evidence_count    INTEGER DEFAULT 0,
    signals_evaluated           INTEGER DEFAULT 0,
    error_message               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at                TIMESTAMPTZ
);

-- 2. Aggregated candidate evidence items with full provenance
CREATE TABLE IF NOT EXISTS aggregated_candidate_evidence (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id         VARCHAR(255) NOT NULL UNIQUE,
    run_id              UUID REFERENCES evidence_aggregation_runs(id) ON DELETE CASCADE,
    evidence_type       VARCHAR(60) NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    score               NUMERIC(5, 4) NOT NULL,
    confidence          NUMERIC(5, 4) NOT NULL,
    source_papers       JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_pages        JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_statements   JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agg_evidence_run_id
    ON aggregated_candidate_evidence (run_id);

CREATE INDEX IF NOT EXISTS idx_agg_evidence_type
    ON aggregated_candidate_evidence (evidence_type);

CREATE INDEX IF NOT EXISTS idx_agg_evidence_score
    ON aggregated_candidate_evidence (score DESC);
