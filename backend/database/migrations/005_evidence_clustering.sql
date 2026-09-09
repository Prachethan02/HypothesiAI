-- ============================================================
-- Stage 11 – Evidence Clustering (HDBSCAN)
-- Clusters are evidence signals, not research gaps.
-- ============================================================

-- 1. Clustering run metadata
CREATE TABLE IF NOT EXISTS evidence_cluster_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status            VARCHAR(20)   NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'completed', 'failed')),
    min_cluster_size  INTEGER       NOT NULL DEFAULT 3,
    min_samples       INTEGER,
    algorithm         VARCHAR(50)   NOT NULL DEFAULT 'hdbscan',
    document_count    INTEGER,
    cluster_count     INTEGER,
    noise_count       INTEGER,
    error_message     TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

-- 2. Individual clusters in a run
CREATE TABLE IF NOT EXISTS evidence_clusters (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                  UUID NOT NULL REFERENCES evidence_cluster_runs(id) ON DELETE CASCADE,
    cluster_index           INTEGER NOT NULL,          -- HDBSCAN label (>= 0, or -1 for noise)
    is_noise                BOOLEAN NOT NULL DEFAULT FALSE,
    statement_type          VARCHAR(50) NOT NULL,      -- limitation | future_work | problem
    name                    TEXT NOT NULL,
    summary                 TEXT,
    size                    INTEGER NOT NULL DEFAULT 0, -- number of member statements
    paper_count             INTEGER NOT NULL DEFAULT 0, -- distinct source papers
    paper_ids               JSONB   NOT NULL DEFAULT '[]'::jsonb,
    representative_statements JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_terms               JSONB   NOT NULL DEFAULT '[]'::jsonb,
    signal_kind             VARCHAR(30) NOT NULL DEFAULT 'evidence_cluster',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_clusters_run_id
    ON evidence_clusters (run_id);

CREATE INDEX IF NOT EXISTS idx_evidence_clusters_statement_type
    ON evidence_clusters (statement_type);

-- 3. Individual statements assigned to clusters (full source evidence)
CREATE TABLE IF NOT EXISTS evidence_cluster_statements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id              UUID NOT NULL REFERENCES evidence_clusters(id) ON DELETE CASCADE,
    run_id                  UUID NOT NULL REFERENCES evidence_cluster_runs(id) ON DELETE CASCADE,
    document_id             VARCHAR(255) NOT NULL,     -- original entity/statement ID
    paper_id                UUID,                      -- FK – kept nullable for docs without a paper
    paper_title             TEXT,
    statement_type          VARCHAR(50) NOT NULL,
    text                    TEXT NOT NULL,
    similarity_to_centroid  FLOAT,
    is_representative       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecstatements_cluster_id
    ON evidence_cluster_statements (cluster_id);

CREATE INDEX IF NOT EXISTS idx_ecstatements_run_id
    ON evidence_cluster_statements (run_id);

CREATE INDEX IF NOT EXISTS idx_ecstatements_paper_id
    ON evidence_cluster_statements (paper_id);
