/**
 * HypothesiAI Strongly Typed Database Entity Models
 * Corresponding to PostgreSQL / Supabase Schema
 */

export type PaperStatus = 'uploaded' | 'processing' | 'parsed' | 'indexed' | 'failed';
export type SectionType =
  | 'abstract'
  | 'introduction'
  | 'related_work'
  | 'methods'
  | 'results'
  | 'limitations'
  | 'future_work'
  | 'conclusion'
  | 'other';

export type EntityType =
  | 'problem'
  | 'method'
  | 'dataset'
  | 'metric'
  | 'limitation'
  | 'future_work'
  | 'finding'
  | 'claim'
  | 'concept'
  | 'objective'
  | 'population_domain';

export type RelationshipType =
  | 'cites'
  | 'extends'
  | 'evaluates_on'
  | 'contradicts'
  | 'compares_with';

export type ContradictionStatus = 'unresolved' | 'confirmed' | 'dismissed';
export type GapStatus = 'candidate' | 'validated' | 'archived';
export type HypothesisStatus = 'generated' | 'refined' | 'exported' | 'archived';
export type AnalysisRunType =
  | 'ingestion'
  | 'extraction'
  | 'topic_modeling'
  | 'clustering'
  | 'pattern_mining'
  | 'nli_contradiction'
  | 'gap_discovery'
  | 'hypothesis_generation';
export type AnalysisRunStatus = 'started' | 'running' | 'completed' | 'failed';

// 1. User
export interface User {
  id: string;
  email: string;
  password_hash?: string | null;
  full_name?: string | null;
  role: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 2. Paper
export interface Paper {
  id: string;
  user_id?: string | null;
  title: string;
  doi?: string | null;
  authors: Array<{ name: string; affiliation?: string }>;
  publication_year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  file_url: string;
  storage_key: string;
  file_size_bytes?: number | null;
  mime_type: string;
  total_pages?: number | null;
  status: PaperStatus;
  error_message?: string | null;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 3. Paper Section
export interface PaperSection {
  id: string;
  paper_id: string;
  section_type: SectionType;
  heading?: string | null;
  content: string;
  page_start: number;
  page_end: number;
  sequence_order: number;
  bounding_boxes: Array<{ page: number; box: [number, number, number, number] }>;
  metadata?: Record<string, any>;
  created_at: Date;
}

// 4. Extracted Entity
export interface ExtractedEntity {
  id: string;
  paper_id: string;
  section_id?: string | null;
  entity_type: EntityType;
  text: string;
  normalized_name?: string | null;
  confidence: number;
  page_number?: number | null;
  bounding_box?: Record<string, any> | null;
  embedding_id?: string | null;
  metadata?: Record<string, any>;
  created_at: Date;
}

// 5. Entity Alias (extended in Stage 8)
export interface EntityAlias {
  id: string;
  entity_id: string;
  canonical_name: string;
  alias_name: string;
  similarity_score: number;
  resolution_method: 'exact' | 'abbreviation' | 'rapidfuzz' | 'cosine_embedding' | 'hybrid' | 'manual' | 'none';
  original_text?: string | null;
  confidence?: number;
  audit_trail?: Record<string, any>;
  paper_id?: string | null;
  created_at: Date;
}

// 5b. Entity Resolution Decision (Stage 8 audit trail)
export interface EntityResolutionDecision {
  id: string;
  decision_id: string;
  original_text: string;
  candidate_text?: string | null;
  canonical_entity: string;
  entity_type?: string | null;
  similarity_score: number;
  resolution_method: string;
  confidence: number;
  decision: 'merged' | 'rejected' | 'new_canonical';
  rationale?: string | null;
  metrics?: Record<string, any>;
  paper_id?: string | null;
  created_at: Date;
}

export interface TopicModelingRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  model_id?: string | null;
  parameters?: Record<string, any>;
  created_at: Date;
}

export interface TopicRecord {
  id: string;
  run_id: string;
  topic_index: number;
  name: string;
  representation: Array<{ word: string; score: number }>;
  frequency: number;
  representative_docs?: string[] | null;
  created_at: Date;
}

export interface TopicDocumentRecord {
  id: string;
  topic_id: string;
  document_id: string;
  document_type: string;
  paper_id?: string | null;
  text: string;
  created_at: Date;
}

// 6. Paper Relationship
export interface PaperRelationship {
  id: string;
  source_paper_id: string;
  target_paper_id: string;
  relationship_type: RelationshipType;
  confidence: number;
  evidence_snippet?: string | null;
  source_section_id?: string | null;
  metadata?: Record<string, any>;
  created_at: Date;
}

// 7. Topic
export interface Topic {
  id: string;
  topic_number: number;
  label: string;
  representation: Array<{ word: string; score: number }>;
  coherence_score?: number | null;
  count_docs: number;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 8. Limitation Cluster
export interface LimitationCluster {
  id: string;
  cluster_label: string;
  representative_summary: string;
  hdbscan_cluster_id: number;
  density_score?: number | null;
  paper_count: number;
  exemplar_ids: string[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 9. Future Work Cluster
export interface FutureWorkCluster {
  id: string;
  cluster_label: string;
  representative_summary: string;
  hdbscan_cluster_id: number;
  density_score?: number | null;
  paper_count: number;
  exemplar_ids: string[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 10. Research Pattern
export interface ResearchPattern {
  id: string;
  pattern_type: 'co_occurrence' | 'rare_combination' | 'method_gap';
  antecedent_entities: string[];
  consequent_entities: string[];
  support: number;
  confidence: number;
  lift: number;
  rarity_score: number;
  algorithm: 'fpgrowth' | 'apriori';
  metadata?: Record<string, any>;
  created_at: Date;
}

// 11. Contradiction
export interface Contradiction {
  id: string;
  premise_paper_id: string;
  premise_section_id?: string | null;
  premise_text: string;
  hypothesis_paper_id: string;
  hypothesis_section_id?: string | null;
  hypothesis_text: string;
  contradiction_probability: number;
  nli_model: string;
  topic_id?: string | null;
  status: ContradictionStatus;
  metadata?: Record<string, any>;
  created_at: Date;
}

// 12. Research Gap
export interface ResearchGap {
  id: string;
  title: string;
  description: string;
  domain?: string | null;
  confidence_score: number;
  limitation_signal_weight: number;
  pattern_rarity_weight: number;
  contradiction_weight: number;
  momentum_weight: number;
  status: GapStatus;
  signal_summary?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 13. Gap Evidence
export interface GapEvidence {
  id: string;
  gap_id: string;
  evidence_type: 'limitation_cluster' | 'pattern_rarity' | 'contradiction' | 'momentum';
  signal_score: number;
  source_paper_id: string;
  source_section_id?: string | null;
  snippet: string;
  page_number?: number | null;
  details?: Record<string, any>;
  created_at: Date;
}

// 14. Hypothesis
export interface Hypothesis {
  id: string;
  gap_id: string;
  title: string;
  statement: string;
  rationale: string;
  proposed_methodology: string;
  expected_outcome?: string | null;
  evaluation_metrics: Array<{ metric: string; target?: string }>;
  status: HypothesisStatus;
  citations: Array<{ paper_id: string; title: string; section_id?: string; page?: number }>;
  llm_provider?: string | null;
  llm_metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// 15. Analysis Run
export interface AnalysisRun {
  id: string;
  run_type: AnalysisRunType;
  status: AnalysisRunStatus;
  parameters?: Record<string, any>;
  results_summary?: Record<string, any>;
  error_message?: string | null;
  papers_analyzed_count: number;
  duration_ms?: number | null;
  created_at: Date;
  updated_at: Date;
}

export const ALL_TABLE_NAMES = [
  'users',
  'papers',
  'paper_sections',
  'extracted_entities',
  'entity_aliases',
  'paper_relationships',
  'topics',
  'limitation_clusters',
  'future_work_clusters',
  'research_patterns',
  'contradictions',
  'research_gaps',
  'gap_evidence',
  'hypotheses',
  'analysis_runs',
] as const;

export type TableName = (typeof ALL_TABLE_NAMES)[number];
