-- Stage 16 – Evidence-Grounded Hypothesis Generation
-- Creates tables for persisting structured 9-dimension scientific hypotheses
-- and their full underlying empirical evidence bundles.

CREATE TABLE IF NOT EXISTS grounded_hypotheses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hypothesis_id           TEXT NOT NULL UNIQUE,
    gap_id                  TEXT NOT NULL,
    title                   TEXT NOT NULL,
    hypothesis              TEXT NOT NULL,
    research_question       TEXT NOT NULL,
    rationale               TEXT NOT NULL,
    expected_relationship   TEXT NOT NULL,
    variables               JSONB NOT NULL DEFAULT '[]',
    possible_methodology    TEXT NOT NULL,
    expected_contribution   TEXT NOT NULL,
    supporting_evidence     JSONB NOT NULL DEFAULT '[]',
    limitations_uncertainty TEXT NOT NULL,
    evidence_bundle         JSONB NOT NULL DEFAULT '{}',
    confidence_score        NUMERIC(6,4) NOT NULL DEFAULT 0.85,
    llm_provider            TEXT,
    llm_model               TEXT,
    regeneration_count      INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_grounded_hypotheses_gap_id
    ON grounded_hypotheses(gap_id);
CREATE INDEX IF NOT EXISTS idx_grounded_hypotheses_created_at
    ON grounded_hypotheses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grounded_hypotheses_confidence
    ON grounded_hypotheses(confidence_score DESC);
