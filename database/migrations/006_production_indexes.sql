-- ==============================================================================
-- Migration 006: Production Performance Indexes & Query Optimizations
-- ==============================================================================

-- Enable pg_trgm extension for fast text similarity and pattern search if available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Papers Indexes
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_pub_year ON papers(publication_year) WHERE publication_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_created_at_desc ON papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_title_trgm ON papers USING gin (title gin_trgm_ops);

-- 2. Paper Sections Indexes
CREATE INDEX IF NOT EXISTS idx_paper_sections_paper_id ON paper_sections(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_sections_type ON paper_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_paper_sections_sequence ON paper_sections(paper_id, sequence_order);

-- 3. Extracted Entities Indexes
CREATE INDEX IF NOT EXISTS idx_extracted_entities_paper_id ON extracted_entities(paper_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type ON extracted_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_confidence ON extracted_entities(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_normalized ON extracted_entities(normalized_name) WHERE normalized_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_extracted_entities_section ON extracted_entities(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_extracted_entities_text_trgm ON extracted_entities USING gin (text gin_trgm_ops);

-- 4. Entity Resolution Decisions Indexes
CREATE INDEX IF NOT EXISTS idx_resolution_decisions_paper ON entity_resolution_decisions(paper_id);
CREATE INDEX IF NOT EXISTS idx_resolution_decisions_canonical ON entity_resolution_decisions(canonical_entity);
CREATE INDEX IF NOT EXISTS idx_resolution_decisions_decision ON entity_resolution_decisions(decision);

-- 5. Topics & Topic Documents Indexes
CREATE INDEX IF NOT EXISTS idx_topics_run_id ON topics(run_id);
CREATE INDEX IF NOT EXISTS idx_topics_frequency ON topics(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_topic_documents_paper_id ON topic_documents(paper_id);
CREATE INDEX IF NOT EXISTS idx_topic_documents_topic_id ON topic_documents(topic_id);

-- 6. Contradictions Indexes
CREATE INDEX IF NOT EXISTS idx_contradictions_run_id ON contradictions(run_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_label ON contradictions(nli_label);
CREATE INDEX IF NOT EXISTS idx_contradictions_status ON contradictions(status);
CREATE INDEX IF NOT EXISTS idx_contradictions_confidence ON contradictions(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_contradictions_paper_a ON contradictions(paper_a_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_paper_b ON contradictions(paper_b_id);

-- 7. Research Gaps & Evidence Indexes
CREATE INDEX IF NOT EXISTS idx_research_gaps_status ON research_gaps(status);
CREATE INDEX IF NOT EXISTS idx_research_gaps_score_desc ON research_gaps(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_research_gaps_created_at ON research_gaps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gap_evidence_gap_id ON gap_evidence(gap_id);
CREATE INDEX IF NOT EXISTS idx_gap_evidence_type ON gap_evidence(evidence_type);

-- 8. Hypotheses Indexes
CREATE INDEX IF NOT EXISTS idx_hypotheses_gap_id ON hypotheses(gap_id);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_hypotheses_created_at ON hypotheses(created_at DESC);

-- 9. Analysis Runs Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_runs_type ON analysis_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_status ON analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at DESC);
