-- ============================================================
-- Stage 13 – Contradiction Analysis using Natural Language Inference (NLI)
-- Contradictions are candidate signals, not scientific truth.
-- ============================================================

-- 1. NLI analysis runs
CREATE TABLE IF NOT EXISTS nli_analysis_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status              VARCHAR(20) NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'completed', 'failed')),
    semantic_threshold  NUMERIC(4, 3) NOT NULL DEFAULT 0.550,
    model_name          VARCHAR(100) NOT NULL DEFAULT 'cross-encoder/nli-deberta-v3-small',
    total_findings      INTEGER DEFAULT 0,
    pairs_evaluated     INTEGER DEFAULT 0,
    contradiction_count INTEGER DEFAULT 0,
    entailment_count    INTEGER DEFAULT 0,
    neutral_count       INTEGER DEFAULT 0,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

-- 2. Statement pair comparisons with full provenance
CREATE TABLE IF NOT EXISTS nli_statement_comparisons (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID REFERENCES nli_analysis_runs(id) ON DELETE CASCADE,
    statement_a_id      VARCHAR(255) NOT NULL,
    statement_a_text    TEXT NOT NULL,
    statement_a_page    INTEGER,
    statement_a_section TEXT,
    paper_a_id          UUID REFERENCES papers(id) ON DELETE CASCADE,
    paper_a_title       TEXT NOT NULL,

    statement_b_id      VARCHAR(255) NOT NULL,
    statement_b_text    TEXT NOT NULL,
    statement_b_page    INTEGER,
    statement_b_section TEXT,
    paper_b_id          UUID REFERENCES papers(id) ON DELETE CASCADE,
    paper_b_title       TEXT NOT NULL,

    nli_label           VARCHAR(30) NOT NULL
                            CHECK (nli_label IN ('ENTAILMENT', 'CONTRADICTION', 'NEUTRAL')),
    confidence          NUMERIC(5, 4) NOT NULL,
    semantic_similarity NUMERIC(5, 4) NOT NULL,
    probabilities       JSONB DEFAULT '{}'::jsonb,
    status              VARCHAR(30) NOT NULL DEFAULT 'candidate_signal'
                            CHECK (status IN ('candidate_signal', 'confirmed', 'dismissed')),
    is_candidate_signal BOOLEAN NOT NULL DEFAULT TRUE,
    review_notes        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT check_distinct_comparison_papers CHECK (paper_a_id != paper_b_id)
);

CREATE INDEX IF NOT EXISTS idx_nli_comparisons_run_id
    ON nli_statement_comparisons (run_id);

CREATE INDEX IF NOT EXISTS idx_nli_comparisons_label
    ON nli_statement_comparisons (nli_label);

CREATE INDEX IF NOT EXISTS idx_nli_comparisons_status
    ON nli_statement_comparisons (status);

CREATE INDEX IF NOT EXISTS idx_nli_comparisons_conf
    ON nli_statement_comparisons (confidence DESC);

CREATE INDEX IF NOT EXISTS idx_nli_comparisons_paper_a
    ON nli_statement_comparisons (paper_a_id);

CREATE INDEX IF NOT EXISTS idx_nli_comparisons_paper_b
    ON nli_statement_comparisons (paper_b_id);
