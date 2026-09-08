-- ==============================================================================
-- HypothesiAI Database Migration: 002_indexes_and_triggers.sql
-- Indexes, Full-Text Search, GIN JSONB, and Update Triggers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Performance Indexes for Papers & Sections
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
CREATE INDEX IF NOT EXISTS idx_papers_publication_year ON papers(publication_year);

CREATE INDEX IF NOT EXISTS idx_paper_sections_paper_id ON paper_sections(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_sections_type ON paper_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_paper_sections_sequence ON paper_sections(paper_id, sequence_order);

-- ------------------------------------------------------------------------------
-- 2. Performance Indexes for Extracted Entities & Resolution Aliases
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_extracted_entities_paper_id ON extracted_entities(paper_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_section_id ON extracted_entities(section_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type ON extracted_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_norm_name ON extracted_entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_confidence ON extracted_entities(confidence DESC);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_canonical ON entity_aliases(canonical_name);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON entity_aliases(alias_name);

-- ------------------------------------------------------------------------------
-- 3. Performance Indexes for Cross-Paper Relationships
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_paper_rel_source ON paper_relationships(source_paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_rel_target ON paper_relationships(target_paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_rel_type ON paper_relationships(relationship_type);

-- ------------------------------------------------------------------------------
-- 4. Performance Indexes for Analytical Models (Topics, Clusters, Patterns)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_topics_topic_number ON topics(topic_number);
CREATE INDEX IF NOT EXISTS idx_limitation_clusters_hdbscan ON limitation_clusters(hdbscan_cluster_id);
CREATE INDEX IF NOT EXISTS idx_future_work_clusters_hdbscan ON future_work_clusters(hdbscan_cluster_id);
CREATE INDEX IF NOT EXISTS idx_research_patterns_type ON research_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_research_patterns_rarity ON research_patterns(rarity_score DESC);

-- ------------------------------------------------------------------------------
-- 5. Performance Indexes for Contradictions, Gaps, and Evidence
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 6. GIN Indexes for JSONB fields
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_papers_authors_gin ON papers USING GIN (authors);
CREATE INDEX IF NOT EXISTS idx_research_patterns_antecedent_gin ON research_patterns USING GIN (antecedent_entities);
CREATE INDEX IF NOT EXISTS idx_research_patterns_consequent_gin ON research_patterns USING GIN (consequent_entities);
CREATE INDEX IF NOT EXISTS idx_hypotheses_citations_gin ON hypotheses USING GIN (citations);

-- ------------------------------------------------------------------------------
-- 7. Automatic timestamp trigger function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_papers_updated_at ON papers;
CREATE TRIGGER trg_papers_updated_at
BEFORE UPDATE ON papers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_topics_updated_at ON topics;
CREATE TRIGGER trg_topics_updated_at
BEFORE UPDATE ON topics
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_limitation_clusters_updated_at ON limitation_clusters;
CREATE TRIGGER trg_limitation_clusters_updated_at
BEFORE UPDATE ON limitation_clusters
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_future_work_clusters_updated_at ON future_work_clusters;
CREATE TRIGGER trg_future_work_clusters_updated_at
BEFORE UPDATE ON future_work_clusters
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_research_gaps_updated_at ON research_gaps;
CREATE TRIGGER trg_research_gaps_updated_at
BEFORE UPDATE ON research_gaps
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hypotheses_updated_at ON hypotheses;
CREATE TRIGGER trg_hypotheses_updated_at
BEFORE UPDATE ON hypotheses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_analysis_runs_updated_at ON analysis_runs;
CREATE TRIGGER trg_analysis_runs_updated_at
BEFORE UPDATE ON analysis_runs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
