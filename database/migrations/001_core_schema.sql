-- ==============================================================================
-- HypothesiAI Database Migration: 001_core_schema.sql
-- Core Relational Tables Foundation (Supabase & PostgreSQL 15+ compatible)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Users Table (Authentication and user profile metadata)
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
-- 2. Papers Table (Metadata, ingestion provenance, and processing status)
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
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'processing', 'parsed', 'indexed', 'failed'
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. Paper Sections Table (Fine-grained section segmentation with bounding boxes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paper_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    section_type VARCHAR(100) NOT NULL, -- 'abstract', 'introduction', 'related_work', 'methods', 'results', 'limitations', 'future_work', 'conclusion', 'other'
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
-- 4. Extracted Entities Table (Problems, methods, datasets, claims, limitations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extracted_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL, -- 'problem', 'method', 'dataset', 'metric', 'limitation', 'future_work', 'finding', 'claim'
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
-- 5. Entity Aliases Table (Entity resolution & canonical name mappings)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES extracted_entities(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,
    alias_name VARCHAR(255) NOT NULL,
    similarity_score NUMERIC(5, 4) NOT NULL,
    resolution_method VARCHAR(50) NOT NULL, -- 'rapidfuzz', 'cosine_embedding', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. Paper Relationships Table (Citations, methodology extensions, conflicts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paper_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    target_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- 'cites', 'extends', 'evaluates_on', 'contradicts', 'compares_with'
    confidence NUMERIC(5, 4) DEFAULT 1.0000,
    evidence_snippet TEXT,
    source_section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_distinct_papers CHECK (source_paper_id != target_paper_id)
);

-- ------------------------------------------------------------------------------
-- 7. Topics Table (Topic modeling outputs from BERTopic)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_number INT NOT NULL,
    label VARCHAR(255) NOT NULL,
    representation JSONB NOT NULL DEFAULT '[]'::jsonb, -- Top keywords and c-TF-IDF scores
    coherence_score NUMERIC(5, 4),
    count_docs INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 8. Limitation Clusters Table (HDBSCAN clusters of limitation statements)
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
-- 9. Future Work Clusters Table (HDBSCAN clusters of future-work statements)
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
-- 10. Research Patterns Table (Frequent research-pattern & rarity mining)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(100) NOT NULL, -- 'co_occurrence', 'rare_combination', 'method_gap'
    antecedent_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    consequent_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    support NUMERIC(7, 6) NOT NULL,
    confidence NUMERIC(7, 6) NOT NULL,
    lift NUMERIC(7, 4) NOT NULL,
    rarity_score NUMERIC(5, 4) NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'fpgrowth', -- 'fpgrowth', 'apriori'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 11. Contradictions Table (Cross-Encoder NLI detected literature conflicts)
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
    status VARCHAR(50) DEFAULT 'unresolved', -- 'unresolved', 'confirmed', 'dismissed'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_distinct_contradiction_papers CHECK (premise_paper_id != hypothesis_paper_id)
);

-- ------------------------------------------------------------------------------
-- 12. Research Gaps Table (Multi-signal evidence aggregated research gaps)
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
    status VARCHAR(50) DEFAULT 'candidate', -- 'candidate', 'validated', 'archived'
    signal_summary JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 13. Gap Evidence Table (Granular provenance linking gaps to source papers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gap_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID NOT NULL REFERENCES research_gaps(id) ON DELETE CASCADE,
    evidence_type VARCHAR(100) NOT NULL, -- 'limitation_cluster', 'pattern_rarity', 'contradiction', 'momentum'
    signal_score NUMERIC(5, 4) NOT NULL,
    source_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    source_section_id UUID REFERENCES paper_sections(id) ON DELETE SET NULL,
    snippet TEXT NOT NULL,
    page_number INT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 14. Hypotheses Table (LLM generated hypotheses grounded by evidence)
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
    status VARCHAR(50) DEFAULT 'generated', -- 'generated', 'refined', 'exported', 'archived'
    citations JSONB DEFAULT '[]'::jsonb,
    llm_provider VARCHAR(50),
    llm_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 15. Analysis Runs Table (Execution audit, telemetry, and pipeline tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type VARCHAR(100) NOT NULL, -- 'ingestion', 'extraction', 'topic_modeling', 'clustering', 'pattern_mining', 'nli_contradiction', 'gap_discovery', 'hypothesis_generation'
    status VARCHAR(50) NOT NULL DEFAULT 'started', -- 'started', 'running', 'completed', 'failed'
    parameters JSONB DEFAULT '{}'::jsonb,
    results_summary JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    papers_analyzed_count INT DEFAULT 0,
    duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
