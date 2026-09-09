-- Migration 013: Research Gap Quality Score (RGQS)
-- Adds deterministic quality metrics to ranked_research_gaps

ALTER TABLE ranked_research_gaps
    ADD COLUMN IF NOT EXISTS rgqs NUMERIC(5,2) CHECK (rgqs >= 0 AND rgqs <= 100),
    ADD COLUMN IF NOT EXISTS gap_validity_score NUMERIC(5,4) CHECK (gap_validity_score >= 0 AND gap_validity_score <= 1),
    ADD COLUMN IF NOT EXISTS evidence_grounding_score NUMERIC(5,4) CHECK (evidence_grounding_score >= 0 AND evidence_grounding_score <= 1),
    ADD COLUMN IF NOT EXISTS traceability_score NUMERIC(5,4) CHECK (traceability_score >= 0 AND traceability_score <= 1),
    ADD COLUMN IF NOT EXISTS novelty_score NUMERIC(5,4) CHECK (novelty_score >= 0 AND novelty_score <= 1),
    ADD COLUMN IF NOT EXISTS consistency_score NUMERIC(5,4) CHECK (consistency_score >= 0 AND consistency_score <= 1),
    ADD COLUMN IF NOT EXISTS rgqs_breakdown JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ranked_gaps_rgqs
    ON ranked_research_gaps(rgqs DESC);
