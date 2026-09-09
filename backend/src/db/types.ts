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

// ─── Stage 11 – Evidence Clustering (HDBSCAN) ────────────────────────────────

export interface EvidenceClusterRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  min_cluster_size: number;
  min_samples?: number | null;
  algorithm: string;
  document_count?: number | null;
  cluster_count?: number | null;
  noise_count?: number | null;
  error_message?: string | null;
  created_at: Date;
  completed_at?: Date | null;
}

export interface EvidenceCluster {
  id: string;
  run_id: string;
  cluster_index: number;           // HDBSCAN label (>= 0 or -1 for noise)
  is_noise: boolean;
  statement_type: string;          // limitation | future_work | problem
  name: string;
  summary?: string | null;
  size: number;
  paper_count: number;
  paper_ids: string[];
  representative_statements: string[];
  top_terms: Array<{ word: string; score: number }>;
  signal_kind: string;             // always "evidence_cluster"
  created_at: Date;
}

export interface EvidenceClusterStatement {
  id: string;
  cluster_id: string;
  run_id: string;
  document_id: string;
  paper_id?: string | null;
  paper_title?: string | null;
  statement_type: string;
  text: string;
  similarity_to_centroid?: number | null;
  is_representative: boolean;
  created_at: Date;
}

// ─── Stage 12 – Research Pattern Mining (FP-Growth / Apriori) ────────────────

export interface PatternMiningRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  algorithm: string;              // fpgrowth | apriori
  min_support: number;
  min_confidence: number;
  n_papers?: number | null;
  frequent_pattern_count?: number | null;
  association_rule_count?: number | null;
  underexplored_candidate_count?: number | null;
  error_message?: string | null;
  created_at: Date;
  completed_at?: Date | null;
}

export interface ResearchPattern {
  id: string;
  run_id: string;
  pattern_label: string;
  items: string[];
  entity_types: string[];
  combo_type?: string | null;     // e.g. "Method + Dataset"
  support: number;
  paper_count: number;
  paper_ids: string[];
  algorithm: string;
  created_at: Date;
}

export interface PatternAssociationRule {
  id: string;
  run_id: string;
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
  paper_count: number;
  paper_ids: string[];
  created_at: Date;
}

export interface UnderexploredCandidate {
  id: string;
  run_id: string;
  combo_type?: string | null;
  items: string[];
  combo_label: string;
  observed_support?: number | null;   // null if never observed
  underexplored_score: number;        // heuristic [0-1], NOT a gap score
  paper_count: number;
  paper_ids: string[];
  label: string;                      // always "underexplored candidate"
  note?: string | null;
  created_at: Date;
}

// ─── Stage 13 – Contradiction Analysis (Natural Language Inference) ──────────

export type NLIRelationLabel = 'ENTAILMENT' | 'CONTRADICTION' | 'NEUTRAL';
export type ContradictionVerificationStatus = 'candidate_signal' | 'confirmed' | 'dismissed';

export interface NLIAnalysisRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  semantic_threshold: number;
  model_name: string;
  total_findings?: number | null;
  pairs_evaluated?: number | null;
  contradiction_count?: number | null;
  entailment_count?: number | null;
  neutral_count?: number | null;
  error_message?: string | null;
  created_at: Date;
  completed_at?: Date | null;
}

export interface NLIStatementComparison {
  id: string;
  run_id: string;
  statement_a_id: string;
  statement_a_text: string;
  statement_a_page?: number | null;
  statement_a_section?: string | null;
  paper_a_id: string;
  paper_a_title: string;

  statement_b_id: string;
  statement_b_text: string;
  statement_b_page?: number | null;
  statement_b_section?: string | null;
  paper_b_id: string;
  paper_b_title: string;

  nli_label: NLIRelationLabel;
  confidence: number;
  semantic_similarity: number;
  probabilities?: Record<string, number> | null;
  status: ContradictionVerificationStatus;
  is_candidate_signal: boolean;
  review_notes?: string | null;
  created_at: Date;
}

// ─── Stage 14 – Unified Evidence Aggregation ─────────────────────────────────

export interface ScoringWeightsConfig {
  recurring_limitations?: number;
  future_work_frequency?: number;
  limitation_clusters?: number;
  topic_trends?: number;
  underexplored_method_dataset?: number;
  contradiction_evidence?: number;
  kg_structural_gaps?: number;
  disconnected_research_areas?: number;
  temporal_decline_stagnation?: number;
  independent_paper_support?: number;
}

export interface SourcePaperRef {
  id: string;
  title: string;
  doi?: string | null;
  publication_year?: number | null;
}

export interface EvidenceAggregationRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  weights_used: Record<string, number>;
  min_score: number;
  candidate_evidence_count?: number | null;
  signals_evaluated?: number | null;
  error_message?: string | null;
  created_at: Date;
  completed_at?: Date | null;
}

export interface AggregatedEvidenceItem {
  id: string;
  evidence_id: string;
  run_id?: string | null;
  evidence_type: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  source_papers: SourcePaperRef[];
  source_pages: number[];
  source_statements: string[];
  metadata?: Record<string, any>;
  created_at: Date;
}

// ─── Stage 15 – Research-Gap Ranking ─────────────────────────────────────────

export interface RankingWeightsConfig {
  recurrence?: number;
  evidence_strength?: number;
  independent_paper_support?: number;
  contradiction_strength?: number;
  underexplored_combination_strength?: number;
  topic_relevance?: number;
  temporal_signal?: number;
  graph_evidence?: number;
  confidence?: number;
}

export interface RankedGapDimension {
  name: string;
  weight: number;
  raw_score: number;
  weighted_contribution: number;
  explanation: string;
}

export interface RGQSComponents {
  gapValidity: number;        // G in [0, 1] (30%)
  evidenceGrounding: number;  // E in [0, 1] (25%)
  traceability: number;       // T in [0, 1] (20%)
  novelty: number;            // N in [0, 1] (15%)
  consistency: number;        // C in [0, 1] (10%)
}

export interface RGQSWeights {
  gapValidity: number;        // 0.30
  evidenceGrounding: number;  // 0.25
  traceability: number;       // 0.20
  novelty: number;            // 0.15
  consistency: number;        // 0.10
}

export interface RGQSEvidenceQuality {
  unique_papers: number;
  total_statements: number;
  limitation_statements: number;
  future_work_statements: number;
  has_verbatim_quotes: boolean;
  has_page_provenance: boolean;
  diminishing_returns_factor: number;   // 0–1: log-diminishing scale of unique papers
  cross_paper_agreement: boolean;       // true if ≥2 unique papers share the limitation signal
}

export interface RGQSBreakdown {
  rgqs: number;               // [0, 100]
  components: RGQSComponents;
  weights: RGQSWeights;
  explanation: string;
  supportingEvidenceCount: number;
  supportingPaperCount: number;
  tier: 'Strong' | 'Moderate' | 'Weak' | 'Low-confidence';
  // Extended quality signals (new)
  evidence_quality?: RGQSEvidenceQuality;
  corroboration_level?: 'strong' | 'moderate' | 'weak' | 'single_source';
  contradiction_level?: 'none' | 'minor' | 'moderate' | 'high';
  provenance_completeness?: number;   // 0–1
  scoring_notes?: string[];           // per-dimension rationale
}

export interface RankedResearchGap {
  id?: string;
  gap_id: string;
  run_id?: string | null;
  title: string;
  description: string;
  composite_score: number;
  confidence: number;
  rank: number;
  evidence_type: string;
  why_identified: string;
  dimensions: RankedGapDimension[];
  evidence_ids: string[];
  source_papers: SourcePaperRef[];
  source_pages: number[];
  source_statements: string[];
  rgqs?: number;
  gap_validity_score?: number;
  evidence_grounding_score?: number;
  traceability_score?: number;
  novelty_score?: number;
  consistency_score?: number;
  rgqs_breakdown?: RGQSBreakdown;
  metadata?: Record<string, any>;
  created_at?: Date;
  // Extended provenance signals for improved RGQS (new)
  unique_paper_ids?: string[];
  limitation_statement_count?: number;
  future_work_statement_count?: number;
  contradiction_count?: number;
  corpus_paper_count?: number;
  topic_coverage_fraction?: number;
}

export interface GapRankingRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  weights_used: Record<string, number>;
  min_composite_score: number;
  total_candidates?: number | null;
  ranked_count?: number | null;
  error_message?: string | null;
  created_at: Date;
  completed_at?: Date | null;
}

// ─── Stage 16 – Evidence-Grounded Hypotheses ─────────────────────────────────

export interface HypothesisVariable {
  name: string;
  type: 'independent' | 'dependent' | 'control';
  description: string;
}

export interface SupportingEvidenceItem {
  evidence_id: string;
  type: string;
  description: string;
  source_paper_title?: string | null;
}

export interface GroundedHypothesisRecord {
  id?: string;
  hypothesis_id: string;
  gap_id: string;
  title: string;
  hypothesis: string;
  research_question: string;
  rationale: string;
  expected_relationship: string;
  variables: HypothesisVariable[];
  possible_methodology: string;
  expected_contribution: string;
  supporting_evidence: SupportingEvidenceItem[];
  limitations_uncertainty: string;
  evidence_bundle: Record<string, any>;
  confidence_score: number;
  llm_provider?: string | null;
  llm_model?: string | null;
  regeneration_count: number;
  created_at?: Date;
  updated_at?: Date;
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

// 10. Research Pattern (Extended)
export interface ExtendedResearchPattern {
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

// 16. Research Corpus
export type CorpusStatus = 'draft' | 'created' | 'uploading' | 'parsing' | 'ready' | 'analyzing' | 'analyzed' | 'completed' | 'failed';

export interface Corpus {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  status: CorpusStatus;
  analysis_progress: number;
  metadata?: Record<string, any>;
  paper_count?: number;
  created_at: Date;
  updated_at: Date;
}

// 17. Corpus Paper Mapping
export interface CorpusPaper {
  id: string;
  corpus_id: string;
  paper_id: string;
  source: 'upload' | 'academic_search';
  added_at: Date;
  paper?: Paper;
}

export const CORE_TABLE_NAMES = [
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

export const ALL_TABLE_NAMES = [
  ...CORE_TABLE_NAMES,
  'corpora',
  'corpus_papers',
] as const;

export type TableName = (typeof ALL_TABLE_NAMES)[number];
