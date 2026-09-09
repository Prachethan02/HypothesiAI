-- ============================================================
-- Stage 12 – Research Pattern Mining (FP-Growth / Apriori)
-- Results are labelled "underexplored candidate", not gaps.
-- ============================================================

-- 1. Pattern mining runs
CREATE TABLE IF NOT EXISTS pattern_mining_runs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status                      VARCHAR(20)  NOT NULL DEFAULT 'running'
                                    CHECK (status IN ('running', 'completed', 'failed')),
    algorithm                   VARCHAR(20)  NOT NULL DEFAULT 'fpgrowth',
    min_support                 FLOAT        NOT NULL DEFAULT 0.02,
    min_confidence              FLOAT        NOT NULL DEFAULT 0.3,
    n_papers                    INTEGER,
    frequent_pattern_count      INTEGER,
    association_rule_count      INTEGER,
    underexplored_candidate_count INTEGER,
    error_message               TEXT,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at                TIMESTAMPTZ
);

-- 2. Frequent patterns
CREATE TABLE IF NOT EXISTS research_patterns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES pattern_mining_runs(id) ON DELETE CASCADE,
    pattern_label   TEXT NOT NULL,
    items           JSONB NOT NULL DEFAULT '[]'::jsonb,
    entity_types    JSONB NOT NULL DEFAULT '[]'::jsonb,
    combo_type      VARCHAR(100),
    support         FLOAT NOT NULL,
    paper_count     INTEGER NOT NULL DEFAULT 0,
    paper_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
    algorithm       VARCHAR(20) NOT NULL DEFAULT 'fpgrowth',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_patterns_run_id
    ON research_patterns (run_id);

CREATE INDEX IF NOT EXISTS idx_research_patterns_support
    ON research_patterns (support DESC);

-- 3. Association rules
CREATE TABLE IF NOT EXISTS pattern_association_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES pattern_mining_runs(id) ON DELETE CASCADE,
    antecedent      JSONB NOT NULL,
    consequent      JSONB NOT NULL,
    support         FLOAT NOT NULL,
    confidence      FLOAT NOT NULL,
    lift            FLOAT NOT NULL DEFAULT 1.0,
    paper_count     INTEGER NOT NULL DEFAULT 0,
    paper_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assoc_rules_run_id
    ON pattern_association_rules (run_id);

CREATE INDEX IF NOT EXISTS idx_assoc_rules_confidence
    ON pattern_association_rules (confidence DESC);

-- 4. Underexplored candidates
--    label is always 'underexplored candidate' — never 'research gap'
CREATE TABLE IF NOT EXISTS underexplored_candidates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES pattern_mining_runs(id) ON DELETE CASCADE,
    combo_type          VARCHAR(100),
    items               JSONB NOT NULL DEFAULT '[]'::jsonb,
    combo_label         TEXT NOT NULL,
    observed_support    FLOAT,              -- NULL if never observed
    underexplored_score FLOAT NOT NULL,     -- heuristic [0-1], NOT a gap score
    paper_count         INTEGER NOT NULL DEFAULT 0,
    paper_ids           JSONB NOT NULL DEFAULT '[]'::jsonb,
    label               VARCHAR(50)  NOT NULL DEFAULT 'underexplored candidate',
    note                TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_underexplored_run_id
    ON underexplored_candidates (run_id);

CREATE INDEX IF NOT EXISTS idx_underexplored_score
    ON underexplored_candidates (underexplored_score DESC);
