-- ==============================================================================
-- HypothesiAI Canonical PostgreSQL Database Schema (Stage 2 Complete)
-- Compatible with Supabase and self-hosted PostgreSQL 15+
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Users Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'researcher',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. Papers Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    doi VARCHAR(255),
    authors JSONB DEFAULT '[]'::jsonb,
    publication_year INT,
    venue VARCHAR(255),
    abstract TEXT,
    file_url TEXT NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    total_pages INT,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. Paper Sections Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paper_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    section_type VARCHAR(100) NOT NULL,
    heading VARCHAR(255),
    content TEXT NOT NULL,
    page_start INT NOT NULL,
    page_end INT NOT NULL,
    sequence_order INT NOT NULL,
    bounding_boxes JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. Extracted Entities Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extracted_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    normalized_name VARCHAR(255),
    confidence NUMERIC(5, 4) DEFAULT 1.0000,
    page_number INT,
    bounding_box JSONB,
    embedding_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. Entity Aliases Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES extracted_entities(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,
    alias_name VARCHAR(255) NOT NULL,
    similarity_score NUMERIC(5, 4) NOT NULL,
    resolution_method VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. Paper Relationships Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paper_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    target_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,
    confidence NUMERIC(5, 4) DEFAULT 1.0000,
    evidence_snippet TEXT,
    source_section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_distinct_papers CHECK (source_paper_id != target_paper_id)
);

-- ------------------------------------------------------------------------------
-- 7. Topics Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_number INT NOT NULL,
    label VARCHAR(255) NOT NULL,
    representation JSONB NOT NULL DEFAULT '[]'::jsonb,
    coherence_score NUMERIC(5, 4),
    count_docs INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 8. Limitation Clusters Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS limitation_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_label VARCHAR(255) NOT NULL,
    representative_summary TEXT NOT NULL,
    hdbscan_cluster_id INT NOT NULL,
    density_score NUMERIC(5, 4),
    paper_count INT DEFAULT 0,
    exemplar_ids JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 9. Future Work Clusters Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS future_work_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_label VARCHAR(255) NOT NULL,
    representative_summary TEXT NOT NULL,
    hdbscan_cluster_id INT NOT NULL,
    density_score NUMERIC(5, 4),
    paper_count INT DEFAULT 0,
    exemplar_ids JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 10. Research Patterns Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(100) NOT NULL,
    antecedent_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    consequent_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    support NUMERIC(7, 6) NOT NULL,
    confidence NUMERIC(7, 6) NOT NULL,
    lift NUMERIC(7, 4) NOT NULL,
    rarity_score NUMERIC(5, 4) NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'fpgrowth',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 11. Contradictions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contradictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    premise_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    premise_section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    premise_text TEXT NOT NULL,
    hypothesis_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    hypothesis_section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    hypothesis_text TEXT NOT NULL,
    contradiction_probability NUMERIC(5, 4) NOT NULL,
    nli_model VARCHAR(100) NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'unresolved',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_distinct_contradiction_papers CHECK (premise_paper_id != hypothesis_paper_id)
);

-- ------------------------------------------------------------------------------
-- 12. Research Gaps Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    domain VARCHAR(255),
    confidence_score NUMERIC(5, 4) NOT NULL,
    limitation_signal_weight NUMERIC(5, 4) DEFAULT 0.0000,
    pattern_rarity_weight NUMERIC(5, 4) DEFAULT 0.0000,
    contradiction_weight NUMERIC(5, 4) DEFAULT 0.0000,
    momentum_weight NUMERIC(5, 4) DEFAULT 0.0000,
    status VARCHAR(50) DEFAULT 'candidate',
    signal_summary JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 13. Gap Evidence Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gap_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID NOT NULL REFERENCES research_gaps(id) ON DELETE CASCADE,
    evidence_type VARCHAR(100) NOT NULL,
    signal_score NUMERIC(5, 4) NOT NULL,
    source_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    source_section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    snippet TEXT NOT NULL,
    page_number INT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 14. Hypotheses Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hypotheses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID NOT NULL REFERENCES research_gaps(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    statement TEXT NOT NULL,
    rationale TEXT NOT NULL,
    proposed_methodology TEXT NOT NULL,
    expected_outcome TEXT,
    evaluation_metrics JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'generated',
    citations JSONB DEFAULT '[]'::jsonb,
    llm_provider VARCHAR(50),
    llm_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 15. Analysis Runs Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    parameters JSONB DEFAULT '{}'::jsonb,
    results_summary JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    papers_analyzed_count INT DEFAULT 0,
    duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
CREATE INDEX IF NOT EXISTS idx_papers_publication_year ON papers(publication_year);

CREATE INDEX IF NOT EXISTS idx_paper_sections_paper_id ON paper_sections(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_sections_type ON paper_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_paper_sections_sequence ON paper_sections(paper_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_extracted_entities_paper_id ON extracted_entities(paper_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_section_id ON extracted_entities(section_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type ON extracted_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_norm_name ON extracted_entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_confidence ON extracted_entities(confidence DESC);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_canonical ON entity_aliases(canonical_name);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON entity_aliases(alias_name);

CREATE INDEX IF NOT EXISTS idx_paper_rel_source ON paper_relationships(source_paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_rel_target ON paper_relationships(target_paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_rel_type ON paper_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_topics_topic_number ON topics(topic_number);
CREATE INDEX IF NOT EXISTS idx_limitation_clusters_hdbscan ON limitation_clusters(hdbscan_cluster_id);
CREATE INDEX IF NOT EXISTS idx_future_work_clusters_hdbscan ON future_work_clusters(hdbscan_cluster_id);
CREATE INDEX IF NOT EXISTS idx_research_patterns_type ON research_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_research_patterns_rarity ON research_patterns(rarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_contradictions_premise ON contradictions(premise_paper_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_hypothesis ON contradictions(hypothesis_paper_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_status ON contradictions(status);
CREATE INDEX IF NOT EXISTS idx_contradictions_prob ON contradictions(contradiction_probability DESC);

CREATE INDEX IF NOT EXISTS idx_research_gaps_confidence ON research_gaps(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_research_gaps_status ON research_gaps(status);
CREATE INDEX IF NOT EXISTS idx_research_gaps_domain ON research_gaps(domain);

CREATE INDEX IF NOT EXISTS idx_gap_evidence_gap_id ON gap_evidence(gap_id);
CREATE INDEX IF NOT EXISTS idx_gap_evidence_source_paper ON gap_evidence(source_paper_id);
CREATE INDEX IF NOT EXISTS idx_gap_evidence_type ON gap_evidence(evidence_type);

CREATE INDEX IF NOT EXISTS idx_hypotheses_gap_id ON hypotheses(gap_id);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_type ON analysis_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_status ON analysis_runs(status);

CREATE INDEX IF NOT EXISTS idx_papers_authors_gin ON papers USING GIN (authors);
CREATE INDEX IF NOT EXISTS idx_research_patterns_antecedent_gin ON research_patterns USING GIN (antecedent_entities);
CREATE INDEX IF NOT EXISTS idx_research_patterns_consequent_gin ON research_patterns USING GIN (consequent_entities);
CREATE INDEX IF NOT EXISTS idx_hypotheses_citations_gin ON hypotheses USING GIN (citations);

-- ------------------------------------------------------------------------------
-- Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_papers_updated_at ON papers;
CREATE TRIGGER trg_papers_updated_at BEFORE UPDATE ON papers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_topics_updated_at ON topics;
CREATE TRIGGER trg_topics_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_limitation_clusters_updated_at ON limitation_clusters;
CREATE TRIGGER trg_limitation_clusters_updated_at BEFORE UPDATE ON limitation_clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_future_work_clusters_updated_at ON future_work_clusters;
CREATE TRIGGER trg_future_work_clusters_updated_at BEFORE UPDATE ON future_work_clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_research_gaps_updated_at ON research_gaps;
CREATE TRIGGER trg_research_gaps_updated_at BEFORE UPDATE ON research_gaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hypotheses_updated_at ON hypotheses;
CREATE TRIGGER trg_hypotheses_updated_at BEFORE UPDATE ON hypotheses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_analysis_runs_updated_at ON analysis_runs;
CREATE TRIGGER trg_analysis_runs_updated_at BEFORE UPDATE ON analysis_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
