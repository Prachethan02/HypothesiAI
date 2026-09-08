-- Stage 8: Entity Resolution Audit Table
-- Stores a full audit trail of every resolution decision (merged or rejected)

CREATE TABLE IF NOT EXISTS entity_resolution_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id VARCHAR(64) UNIQUE NOT NULL,
    original_text VARCHAR(500) NOT NULL,
    candidate_text VARCHAR(500),
    canonical_entity VARCHAR(500) NOT NULL,
    entity_type VARCHAR(100),
    similarity_score NUMERIC(6, 4) NOT NULL,
    resolution_method VARCHAR(50) NOT NULL,
    confidence NUMERIC(6, 4) NOT NULL DEFAULT 0.0,
    decision VARCHAR(30) NOT NULL CHECK (decision IN ('merged', 'rejected', 'new_canonical')),
    rationale TEXT,
    metrics JSONB DEFAULT '{}'::jsonb,
    paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resolution_decisions_paper_id
    ON entity_resolution_decisions(paper_id);

CREATE INDEX IF NOT EXISTS idx_resolution_decisions_canonical
    ON entity_resolution_decisions(canonical_entity);

CREATE INDEX IF NOT EXISTS idx_resolution_decisions_method
    ON entity_resolution_decisions(resolution_method);

CREATE INDEX IF NOT EXISTS idx_resolution_decisions_decision
    ON entity_resolution_decisions(decision);

-- Extend entity_aliases to store audit metadata per Stage 8
ALTER TABLE entity_aliases
    ADD COLUMN IF NOT EXISTS original_text VARCHAR(500),
    ADD COLUMN IF NOT EXISTS confidence NUMERIC(6, 4) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS audit_trail JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS paper_id UUID REFERENCES papers(id) ON DELETE SET NULL;
