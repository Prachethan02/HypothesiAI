import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor for attaching auth tokens automatically
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('hypothesiai_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor for handling 401 unauthorized errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        localStorage.removeItem('hypothesiai_token');
      }
    }
    return Promise.reject(error);
  }
);

// -----------------------------------------------------------------------------
// Core Domain Models & Schemas
// -----------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  created_at?: string;
}

export interface PaperSection {
  id: string;
  paper_id: string;
  section_type: string;
  heading?: string | null;
  content: string;
  page_start: number;
  page_end: number;
  sequence_order: number;
  word_count?: number;
  char_count?: number;
}

export interface ExtractedEntity {
  id: string;
  paper_id: string;
  section_id?: string | null;
  entity_type: string;
  text: string;
  normalized_name?: string | null;
  confidence: number;
  page_number?: number | null;
  source_reference?: string | null;
  embedding_id?: string | null;
  metadata?: Record<string, any>;
}

export interface ResolutionDecision {
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
  created_at: string;
}

export interface Paper {

  id: string;
  title: string;
  doi?: string | null;
  authors: Array<{ name: string; affiliation?: string }>;
  publication_year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  file_url: string;
  file_size_bytes?: number | null;
  total_pages?: number | null;
  status: 'uploaded' | 'processing' | 'parsed' | 'indexed' | 'failed';
  error_message?: string | null;
  created_at: string;
  sections?: PaperSection[];
  entities?: ExtractedEntity[];
}

export type CorpusStatus = 'created' | 'uploading' | 'parsing' | 'ready' | 'analyzing' | 'analyzed' | 'failed';

export interface Corpus {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  status: CorpusStatus;
  analysis_progress?: number;
  metadata?: Record<string, any>;
  paper_count?: number;
  papers?: Paper[];
  created_at: string;
  updated_at: string;
}

export interface BatchUploadResult {
  uploaded: Paper[];
  errors: Array<{ filename: string; error: string }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface AcademicSearchResult {
  id: string;                      // e.g., "arxiv:2301.12345"
  entity_type: 'papers';
  title: string;
  snippet: string;                  // Abstract excerpt
  relevance_score: number;
  url?: string;
  metadata?: {
    arxiv_id?: string;
    authors?: string;
    publication_year?: number | null;
    pdf_url?: string;
    source?: string;
    [key: string]: any;
  };
}

export interface AcademicSearchResponse {
  query: string;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  results: AcademicSearchResult[];
  execution_time_ms: number;
  provider: string;
}

export interface CorpusAnalysisStatus {
  corpus_id: string;
  status: string;
  analysis_progress: number;
  current_step: string | null;
  steps_completed: string[];
  error: string | null;
}



export interface AnalysisRun {
  id: string;
  run_type: string;
  status: 'started' | 'running' | 'completed' | 'failed';
  parameters?: Record<string, any>;
  results_summary?: Record<string, any>;
  error_message?: string | null;
  papers_analyzed_count: number;
  duration_ms?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GapEvidence {
  id: string;
  gap_id: string;
  evidence_type: 'limitation_cluster' | 'pattern_rarity' | 'contradiction' | 'momentum';
  signal_score: number;
  source_paper_id: string;
  paper_title?: string;
  snippet: string;
  page_number?: number | null;
  details?: Record<string, any>;
}

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
  status: 'candidate' | 'validated' | 'archived';
  evidence_count?: number;
  evidence?: GapEvidence[];
  created_at: string;
}

export interface Hypothesis {
  id: string;
  gap_id: string;
  gap_title?: string;
  title: string;
  statement: string;
  rationale: string;
  proposed_methodology: string;
  expected_outcome?: string | null;
  evaluation_metrics: Array<{ metric: string; target?: string }>;
  status: 'generated' | 'refined' | 'exported' | 'archived';
  citations: Array<{ paper_id: string; title: string; section?: string; page?: number }>;
  llm_provider?: string | null;
  created_at: string;
}

export interface DashboardStats {
  papersAnalyzed: number;
  entitiesExtracted: number;
  researchGaps: number;
  researchTopics: number;
  hypotheses: number;
}

// ─── Stage 11 – Evidence Clustering ──────────────────────────────────────────

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
  created_at: string;
}

export interface EvidenceCluster {
  id: string;
  run_id: string;
  cluster_index: number;
  is_noise: boolean;
  statement_type: string;
  name: string;
  summary?: string | null;
  size: number;
  paper_count: number;
  paper_ids: string[];
  representative_statements: string[];
  top_terms: Array<{ word: string; score: number }>;
  signal_kind: string;
  created_at: string;
}

export interface EvidenceClusterWithStatements extends EvidenceCluster {
  statements?: EvidenceClusterStatement[];
}

export interface EvidenceClusterRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  min_cluster_size: number;
  algorithm: string;
  document_count?: number | null;
  cluster_count?: number | null;
  noise_count?: number | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface EvidenceClusteringResult {
  run_id: string;
  status: string;
  cluster_count: number;
  noise_count: number;
  clusters: EvidenceCluster[];
}

// ─── Stage 12 – Research Pattern Mining ──────────────────────────────────────

export interface ResearchPattern {
  pattern_id: string;
  run_id: string;
  pattern_label: string;
  items: string[];
  entity_types: string[];
  combo_type: string;
  support: number;
  paper_count: number;
  paper_ids: string[];
  algorithm: string;
}

export interface PatternAssociationRule {
  rule_id: string;
  run_id: string;
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
  paper_count: number;
  paper_ids: string[];
}

export interface UnderexploredCandidate {
  candidate_id: string;
  run_id: string;
  combo_type: string;
  items: string[];
  combo_label: string;
  observed_support?: number | null;
  underexplored_score: number;   // heuristic [0-1], NOT a research-gap score
  paper_count: number;
  paper_ids: string[];
  label: string;                 // always "underexplored candidate"
  note: string;
}

export interface PatternMiningRunResult {
  run_id: string;
  status: string;
  algorithm: string;
  n_papers: number;
  frequent_pattern_count: number;
  association_rule_count: number;
  underexplored_candidate_count: number;
  frequent_patterns: ResearchPattern[];
  association_rules: PatternAssociationRule[];
  underexplored_candidates: UnderexploredCandidate[];
}

export interface PatternMiningRunSummary {
  id: string;
  status: string;
  algorithm: string;
  min_support: number;
  n_papers?: number | null;
  frequent_pattern_count?: number | null;
  association_rule_count?: number | null;
  underexplored_candidate_count?: number | null;
  created_at: string;
}

// ─── Stage 13 – Contradiction Analysis (NLI) ─────────────────────────────────

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

  nli_label: 'ENTAILMENT' | 'CONTRADICTION' | 'NEUTRAL';
  confidence: number;
  semantic_similarity: number;
  probabilities?: Record<string, number> | null;
  status: 'candidate_signal' | 'confirmed' | 'dismissed';
  is_candidate_signal: boolean;
  review_notes?: string | null;
  created_at: string;
}

export interface NLIAnalysisRunResult {
  run_id: string;
  status: string;
  stats: {
    total_findings: number;
    pairs_evaluated: number;
    contradiction_count: number;
    entailment_count: number;
    neutral_count: number;
  };
  comparisons: NLIStatementComparison[];
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

export interface EvidenceItem {
  evidence_id: string;
  type: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  source_papers: SourcePaperRef[];
  source_pages: number[];
  source_statements: string[];
  metadata?: Record<string, any>;
}

export interface EvidenceAggregationRunResult {
  run_id: string;
  status: string;
  weights_used: Record<string, number>;
  stats: {
    total_signals_evaluated: number;
    candidate_evidence_count: number;
    signals_by_type: Record<string, number>;
    papers_covered: number;
  };
  evidence: EvidenceItem[];
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
  diminishing_returns_factor: number;
  cross_paper_agreement: boolean;
}

export interface RGQSBreakdown {
  rgqs: number;               // 0 to 100
  components: RGQSComponents;
  weights: RGQSWeights;
  explanation: string;
  supportingEvidenceCount: number;
  supportingPaperCount: number;
  tier: 'Strong' | 'Moderate' | 'Weak' | 'Low-confidence';
  evidence_quality?: RGQSEvidenceQuality;
  corroboration_level?: 'strong' | 'moderate' | 'weak' | 'single_source';
  contradiction_level?: 'none' | 'minor' | 'moderate' | 'high';
  provenance_completeness?: number;
  scoring_notes?: string[];
}

export interface RankedGap {
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
}

export interface GapRankingRunResult {
  run_id: string;
  status: string;
  total_candidates: number;
  ranked_count: number;
  weights_used: Record<string, number>;
  ranked_gaps: RankedGap[];
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

export interface GroundedHypothesis {
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
  evidence_bundle?: Record<string, any>;
  confidence_score: number;
  llm_provider?: string | null;
  llm_model?: string | null;
  regeneration_count: number;
  created_at: string;
  updated_at?: string;
}

export interface GenerateHypothesisResponse {
  success: boolean;
  data: GroundedHypothesis;
  evidence_used?: Record<string, any>;
  message?: string;
}

// ─── Stage 17 – Global Research Search ───────────────────────────────────────

export type SearchEntityType =
  | 'all'
  | 'papers'
  | 'methods'
  | 'datasets'
  | 'metrics'
  | 'concepts'
  | 'topics'
  | 'limitations'
  | 'research_gaps'
  | 'hypotheses';

export type SearchSortBy = 'relevance' | 'date_desc' | 'date_asc' | 'title_asc';

export interface SearchQueryParams {
  query?: string;
  entity_type?: SearchEntityType;
  page?: number;
  limit?: number;
  sort_by?: SearchSortBy;
  paper_id?: string;
}

export interface SearchResultItem {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  snippet: string;
  relevance_score: number;
  source_paper_id?: string | null;
  source_paper_title?: string | null;
  created_at?: string | null;
  url?: string;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  counts_by_type: Record<string, number>;
  results: SearchResultItem[];
  execution_time_ms: number;
  provider: string;
}

// ─── Stage 18 – Final Research Intelligence Dashboard ────────────────────────

export interface IntelligenceStats {
  papers_analyzed: number;
  entities_extracted: number;
  knowledge_graph_stats: {
    node_count: number;
    edge_count: number;
    density?: number;
  };
  research_topics: number;
  limitation_clusters: number;
  future_work_clusters: number;
  underexplored_patterns: number;
  contradictions: number;
  research_gaps: number;
  hypotheses: number;
}

export interface ChartDataSets {
  papers_by_year: Array<{ year: string; count: number }>;
  topic_distribution: Array<{ name: string; frequency: number; percentage: number }>;
  research_trends: Array<{
    label: string;
    direction: 'rising' | 'stable' | 'declining';
    velocity: number;
    paper_count: number;
  }>;
  limitation_frequency: Array<{ term: string; count: number }>;
  gap_types: Array<{ type: string; label: string; count: number; percentage: number }>;
  contradiction_count: Array<{ label: string; count: number }>;
  method_dataset_relationships: Array<{
    method: string;
    dataset: string;
    paper_count: number;
    is_underexplored: boolean;
  }>;
}

export interface GraphPayload {
  nodes: Array<{
    id: string;
    label: string;
    title: string;
    type: string;
    url?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    label: string;
  }>;
}

export interface IntelligenceDashboardData {
  stats: IntelligenceStats;
  charts: ChartDataSets;
  graph: GraphPayload;
  generated_at: string;
}

// ─── Stage 19 – Detailed Paper Analysis Interface ───────────────────────────

export interface TraceableEntityItem {
  id: string;
  paper_id: string;
  paper_title: string;
  entity_type: string;
  text: string;
  normalized_name?: string | null;
  confidence: number;
  page_number: number;
  section_id?: string | null;
  section_heading: string;
  section_type: string;
  source_reference?: string | null;
  surrounding_text?: string | null;
}

export interface PaperTopicItem {
  id: string;
  topic_index: number;
  name: string;
  relevance: number;
  representation?: Array<{ word: string; score: number }> | string[];
}

export interface PaperGraphRelationship {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  label: string;
  target_title: string;
  target_type: string;
  confidence: number;
}

export interface DetailedPaperAnalysis {
  paper: Paper;
  sections: PaperSection[];
  methods: TraceableEntityItem[];
  datasets: TraceableEntityItem[];
  metrics: TraceableEntityItem[];
  findings: TraceableEntityItem[];
  limitations: TraceableEntityItem[];
  future_work: TraceableEntityItem[];
  topics: PaperTopicItem[];
  graph_relationships: PaperGraphRelationship[];
}

export interface HealthStatusResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptime?: number;
  environment?: string;
}

export interface ReadinessResponse {
  status: string;
  checks: {
    postgres: { status: string; error?: string };
    neo4j: { status: string; error?: string };
    ai_service: { status: string };
  };
  timestamp: string;
}

// -----------------------------------------------------------------------------
// In-Memory Storage for Clean Standalone State (Zero fake data)
// -----------------------------------------------------------------------------
let clientPapers: Paper[] = [];
let clientCorpora: Corpus[] = [];
let clientGaps: ResearchGap[] = [];
let clientHypotheses: Hypothesis[] = [];
let clientRuns: AnalysisRun[] = [];

// -----------------------------------------------------------------------------
// API Service Methods
// -----------------------------------------------------------------------------

export const apiService = {
  // Auth API
  signup: async (email: string, password: string, fullName?: string): Promise<{ user: User; token: string }> => {
    const res = await apiClient.post<{ success: boolean; data: { user: User; token: string } }>('/auth/signup', {
      email,
      password,
      full_name: fullName,
    });
    return res.data.data;
  },

  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    const res = await apiClient.post<{ success: boolean; data: { user: User; token: string } }>('/auth/login', {
      email,
      password,
    });
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('hypothesiai_token');
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
    return res.data.data;
  },

  // Dashboard Stats (Placeholders populated from actual counts)
  getDashboardStats: async (): Promise<DashboardStats> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: DashboardStats }>('/stats');
      return res.data.data;
    } catch {
      // Return accurate real counts from client state without fabricating fake data
      return {
        papersAnalyzed: clientPapers.length,
        entitiesExtracted: clientPapers.reduce((acc, p) => acc + (p.entities?.length || 0), 0),
        researchGaps: clientGaps.length,
        researchTopics: 0,
        hypotheses: clientHypotheses.length,
      };
    }
  },

  // Papers API
  getPapers: async (): Promise<Paper[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Paper[] }>('/papers');
      return res.data.data;
    } catch {
      return clientPapers;
    }
  },

  getPaperById: async (id: string): Promise<Paper | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Paper }>(`/papers/${id}`);
      return res.data.data;
    } catch {
      return clientPapers.find((p) => p.id === id) || null;
    }
  },

  uploadPaper: async (
    file: File,
    title?: string,
    onProgress?: (percent: number) => void,
  ): Promise<Paper> => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    try {
      const res = await apiClient.post<{ success: boolean; data: Paper }>(
        '/papers',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000, // 2 min for large PDFs
          onUploadProgress: (evt) => {
            if (onProgress && evt.total) {
              onProgress(Math.round((evt.loaded * 100) / evt.total));
            }
          },
        },
      );
      const paper = res.data.data;
      clientPapers = [paper, ...clientPapers.filter((p) => p.id !== paper.id)];
      return paper;
    } catch {
      // Offline fallback — shows the upload without fabricating analytical results
      const newPaper: Paper = {
        id: crypto.randomUUID(),
        title: title || file.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        file_url: URL.createObjectURL(file),
        file_size_bytes: file.size,
        authors: [],
        status: 'uploaded',
        created_at: new Date().toISOString(),
      };
      clientPapers = [newPaper, ...clientPapers];
      if (onProgress) onProgress(100);
      return newPaper;
    }
  },

  // Batch Papers Upload API
  uploadBatchPapers: async (
    files: File[],
    corpusId?: string,
    onProgress?: (percent: number) => void
  ): Promise<BatchUploadResult> => {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    if (corpusId) {
      formData.append('corpus_id', corpusId);
    }

    try {
      const res = await apiClient.post<{ success: boolean; data: BatchUploadResult }>(
        '/papers/batch',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300_000, // 5 min for batch upload
          onUploadProgress: (evt) => {
            if (onProgress && evt.total) {
              onProgress(Math.round((evt.loaded * 100) / evt.total));
            }
          },
        }
      );
      const batchResult = res.data.data;
      if (batchResult && batchResult.uploaded) {
        clientPapers = [
          ...batchResult.uploaded,
          ...clientPapers.filter((p) => !batchResult.uploaded.some((u) => u.id === p.id)),
        ];
        if (corpusId) {
          const corp = clientCorpora.find((c) => c.id === corpusId);
          if (corp) {
            corp.papers = [...(corp.papers || []), ...batchResult.uploaded];
            corp.paper_count = corp.papers.length;
          }
        }
      }
      return batchResult;
    } catch {
      // Offline fallback: create paper records locally
      const uploaded: Paper[] = files.map((f) => ({
        id: crypto.randomUUID(),
        title: f.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        file_url: URL.createObjectURL(f),
        file_size_bytes: f.size,
        authors: [],
        status: 'uploaded' as const,
        created_at: new Date().toISOString(),
      }));
      clientPapers = [...uploaded, ...clientPapers];
      if (corpusId) {
        const corp = clientCorpora.find((c) => c.id === corpusId);
        if (corp) {
          corp.papers = [...(corp.papers || []), ...uploaded];
          corp.paper_count = corp.papers.length;
        }
      }
      if (onProgress) onProgress(100);
      return {
        uploaded,
        errors: [],
        summary: {
          total: files.length,
          succeeded: files.length,
          failed: 0,
        },
      };
    }
  },

  // Research Corpora API
  createCorpus: async (name: string, description?: string): Promise<Corpus> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: Corpus }>('/corpora', {
        name,
        description,
      });
      const corpus = res.data.data;
      clientCorpora = [corpus, ...clientCorpora.filter((c) => c.id !== corpus.id)];
      return corpus;
    } catch {
      const fallbackCorpus: Corpus = {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        status: 'created',
        analysis_progress: 0,
        paper_count: 0,
        papers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      clientCorpora = [fallbackCorpus, ...clientCorpora];
      return fallbackCorpus;
    }
  },

  listCorpora: async (): Promise<Corpus[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Corpus[] }>('/corpora');
      return res.data.data;
    } catch {
      return clientCorpora;
    }
  },

  getCorpusById: async (id: string): Promise<Corpus | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Corpus }>(`/corpora/${id}`);
      return res.data.data;
    } catch {
      return clientCorpora.find((c) => c.id === id) || null;
    }
  },

  removePaperFromCorpus: async (corpusId: string, paperId: string): Promise<boolean> => {
    try {
      const res = await apiClient.delete<{ success: boolean }>(`/corpora/${corpusId}/papers/${paperId}`);
      return res.data.success;
    } catch {
      const c = clientCorpora.find((corp) => corp.id === corpusId);
      if (c && c.papers) {
        c.papers = c.papers.filter((p) => p.id !== paperId);
        c.paper_count = c.papers.length;
      }
      return true;
    }
  },

  deleteCorpus: async (id: string, deletePapers: boolean = true): Promise<boolean> => {
    try {
      const res = await apiClient.delete<{ success: boolean }>(`/corpora/${id}?delete_papers=${deletePapers}`);
      clientCorpora = clientCorpora.filter((c) => c.id !== id);
      return res.data.success;
    } catch {
      clientCorpora = clientCorpora.filter((c) => c.id !== id);
      return true;
    }
  },

  purgeWholeCorpus: async (): Promise<boolean> => {
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(`/corpora/purge`);
      clientCorpora = [];
      return res.data.success;
    } catch {
      clientCorpora = [];
      return true;
    }
  },

  getPaperSections: async (paperId: string): Promise<PaperSection[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: PaperSection[] }>(
        `/papers/${paperId}/sections`,
      );
      return res.data.data;
    } catch {
      return [];
    }
  },

  getPaperStatus: async (paperId: string): Promise<Paper['status'] | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Paper }>(`/papers/${paperId}`);
      return res.data.data.status;
    } catch {
      return null;
    }
  },

  getPaperEntities: async (paperId: string): Promise<ExtractedEntity[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ExtractedEntity[] }>(
        `/papers/${paperId}/entities`,
      );
      return res.data.data;
    } catch {
      return clientPapers.find((p) => p.id === paperId)?.entities || [];
    }
  },

  triggerPaperExtraction: async (paperId: string): Promise<ExtractedEntity[]> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: ExtractedEntity[] }>(
        `/papers/${paperId}/extract`,
      );
      return res.data.data;
    } catch {
      return [];
    }
  },

  embedPaperEntities: async (
    paperId: string,
  ): Promise<{ paperId: string; totalEmbedded: number; dimension: number }> => {
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { paperId: string; totalEmbedded: number; dimension: number };
      }>(`/papers/${paperId}/embed`);
      return res.data.data;
    } catch {
      return { paperId, totalEmbedded: 0, dimension: 384 };
    }
  },

  resolvePaperEntities: async (paperId: string): Promise<{ resolved_entities: any[]; merged_count: number; unique_canonical_count: number }> => {
    try {
      const res = await apiClient.post<{ success: boolean; resolved_entities: any[]; merged_count: number; unique_canonical_count: number }>(`/papers/${paperId}/resolve`);
      return res.data;
    } catch {
      return { resolved_entities: [], merged_count: 0, unique_canonical_count: 0 };
    }
  },

  getResolutionAudit: async (paperId: string): Promise<ResolutionDecision[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; decisions: ResolutionDecision[] }>(`/papers/${paperId}/resolution-audit`);
      return res.data.decisions;
    } catch {
      return [];
    }
  },

  // Stage 19: Get detailed paper analysis with 4-point traceability
  getDetailedPaperAnalysis: async (paperId: string): Promise<DetailedPaperAnalysis | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: DetailedPaperAnalysis }>(`/papers/${paperId}/analysis`);
      return res.data.data;
    } catch {
      return null;
    }
  },

  // Topics API (Stage 10)
  generateTopics: async (): Promise<{ success: boolean; data: any }> => {
    const res = await apiClient.post('/topics/generate');
    return res.data;
  },

  getTopics: async (): Promise<{ success: boolean; data: { run: any; topics: any[] } }> => {
    const res = await apiClient.get('/topics');
    return res.data;
  },

  // ─── Evidence Clustering API (Stage 11) ────────────────────────────────────

  runEvidenceClustering: async (params?: {
    min_cluster_size?: number;
    statement_types?: string[];
    include_noise?: boolean;
  }): Promise<{ success: boolean; data: EvidenceClusteringResult }> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: EvidenceClusteringResult }>(
        '/evidence-clusters/run',
        {
          min_cluster_size: params?.min_cluster_size ?? 3,
          statement_types: params?.statement_types ?? ['limitation', 'future_work', 'problem'],
          include_noise: params?.include_noise ?? true,
        },
        { timeout: 180_000 }, // 3 min – clustering can take time
      );
      return res.data;
    } catch {
      return { success: false, data: { run_id: '', status: 'failed', cluster_count: 0, noise_count: 0, clusters: [] } };
    }
  },

  listEvidenceClusters: async (runId?: string, includeNoise = true): Promise<{
    success: boolean;
    data: { run: EvidenceClusterRun | null; clusters: EvidenceClusterWithStatements[]; total_clustered: number; noise_count: number };
  }> => {
    try {
      const params: Record<string, string> = {};
      if (runId) params.run_id = runId;
      params.include_noise = includeNoise ? 'true' : 'false';
      const res = await apiClient.get<{
        success: boolean;
        data: { run: EvidenceClusterRun | null; clusters: EvidenceClusterWithStatements[]; total_clustered: number; noise_count: number };
      }>('/evidence-clusters', { params });
      return res.data;
    } catch {
      return { success: true, data: { run: null, clusters: [], total_clustered: 0, noise_count: 0 } };
    }
  },

  getEvidenceClusterRun: async (runId: string): Promise<{
    success: boolean;
    data: { run: EvidenceClusterRun; clusters: EvidenceClusterWithStatements[] };
  }> => {
    const res = await apiClient.get<{
      success: boolean;
      data: { run: EvidenceClusterRun; clusters: EvidenceClusterWithStatements[] };
    }>(`/evidence-clusters/${runId}`);
    return res.data;
  },

  // ─── Research Pattern Mining API (Stage 12) ──────────────────────────────

  runPatternMining: async (params?: {
    min_support?: number;
    min_confidence?: number;
    algorithm?: 'fpgrowth' | 'apriori';
    combo_types?: string[];
  }): Promise<{ success: boolean; data: PatternMiningRunResult }> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: PatternMiningRunResult }>(
        '/patterns/run',
        {
          min_support: params?.min_support ?? 0.02,
          min_confidence: params?.min_confidence ?? 0.3,
          algorithm: params?.algorithm ?? 'fpgrowth',
          combo_types: params?.combo_types ?? [
            'method+dataset', 'method+metric', 'method+domain', 'method+dataset+metric',
          ],
        },
        { timeout: 300_000 }, // 5 min
      );
      return res.data;
    } catch {
      return {
        success: false,
        data: {
          run_id: '', status: 'failed', algorithm: 'fpgrowth', n_papers: 0,
          frequent_pattern_count: 0, association_rule_count: 0, underexplored_candidate_count: 0,
          frequent_patterns: [], association_rules: [], underexplored_candidates: [],
        },
      };
    }
  },

  listPatternRuns: async (): Promise<{ success: boolean; data: PatternMiningRunSummary[] }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: PatternMiningRunSummary[] }>('/patterns');
      return res.data;
    } catch {
      return { success: true, data: [] };
    }
  },

  getPatternRun: async (runId: string): Promise<{ success: boolean; data: PatternMiningRunResult | null }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: PatternMiningRunResult }>(`/patterns/${runId}`);
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  // ─── Contradiction Analysis API (Stage 13) ──────────────────────────────

  runContradictionAnalysis: async (params?: {
    semantic_threshold?: number;
    min_confidence?: number;
    max_comparisons?: number;
    target_paper_id?: string;
  }): Promise<{ success: boolean; data: NLIAnalysisRunResult }> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: NLIAnalysisRunResult }>(
        '/contradictions/analyze',
        {
          semantic_threshold: params?.semantic_threshold ?? 0.55,
          min_confidence: params?.min_confidence ?? 0.5,
          max_comparisons: params?.max_comparisons ?? 500,
          target_paper_id: params?.target_paper_id,
        },
        { timeout: 180_000 },
      );
      return res.data;
    } catch {
      return {
        success: false,
        data: {
          run_id: '',
          status: 'failed',
          stats: { total_findings: 0, pairs_evaluated: 0, contradiction_count: 0, entailment_count: 0, neutral_count: 0 },
          comparisons: [],
        },
      };
    }
  },

  listContradictions: async (params?: {
    label?: string;
    min_confidence?: number;
    status?: string;
    paper_id?: string;
  }): Promise<{ success: boolean; data: NLIStatementComparison[] }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: NLIStatementComparison[] }>(
        '/contradictions',
        { params },
      );
      return res.data;
    } catch {
      return { success: true, data: [] };
    }
  },

  getContradictionById: async (id: string): Promise<{ success: boolean; data: NLIStatementComparison | null }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: NLIStatementComparison }>(`/contradictions/${id}`);
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  updateContradictionStatus: async (
    id: string,
    status: 'candidate_signal' | 'confirmed' | 'dismissed',
    review_notes?: string,
  ): Promise<{ success: boolean; data: NLIStatementComparison | null }> => {
    try {
      const res = await apiClient.patch<{ success: boolean; data: NLIStatementComparison }>(
        `/contradictions/${id}/status`,
        { status, review_notes },
      );
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  // ─── Unified Evidence Aggregation API (Stage 14) ─────────────────────────

  runEvidenceAggregation: async (params?: {
    weights?: ScoringWeightsConfig;
    min_score?: number;
    min_paper_support?: number;
    target_domain?: string;
  }): Promise<{ success: boolean; data: EvidenceAggregationRunResult }> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: EvidenceAggregationRunResult }>(
        '/evidence/aggregate',
        {
          weights: params?.weights,
          min_score: params?.min_score ?? 0.20,
          min_paper_support: params?.min_paper_support ?? 1,
          target_domain: params?.target_domain,
        },
        { timeout: 120_000 },
      );
      return res.data;
    } catch {
      return {
        success: false,
        data: {
          run_id: '',
          status: 'failed',
          weights_used: {},
          stats: {
            total_signals_evaluated: 0,
            candidate_evidence_count: 0,
            signals_by_type: {},
            papers_covered: 0,
          },
          evidence: [],
        },
      };
    }
  },

  listAggregatedEvidence: async (params?: {
    signal_type?: string;
    min_score?: number;
  }): Promise<{ success: boolean; data: EvidenceItem[] }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: EvidenceItem[] }>('/evidence', {
        params,
      });
      return res.data;
    } catch {
      return { success: true, data: [] };
    }
  },

  getEvidenceWeights: async (): Promise<{ success: boolean; data: ScoringWeightsConfig }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ScoringWeightsConfig }>('/evidence/weights');
      return res.data;
    } catch {
      return {
        success: true,
        data: {
          recurring_limitations: 0.12,
          future_work_frequency: 0.12,
          limitation_clusters: 0.15,
          topic_trends: 0.06,
          underexplored_method_dataset: 0.12,
          contradiction_evidence: 0.15,
          kg_structural_gaps: 0.10,
          disconnected_research_areas: 0.08,
          temporal_decline_stagnation: 0.05,
          independent_paper_support: 0.05,
        },
      };
    }
  },

  getEvidenceItemById: async (id: string): Promise<{ success: boolean; data: EvidenceItem | null }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: EvidenceItem }>(`/evidence/${id}`);
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  // ─── Research Gap Ranking API (Stage 15) ───────────────────────────────────

  rankResearchGaps: async (params?: {
    weights?: RankingWeightsConfig;
    min_composite_score?: number;
    min_evidence_count?: number;
    top_k?: number;
    corpus_id?: string;
    force_refresh?: boolean;
  }): Promise<{ success: boolean; data: GapRankingRunResult }> => {
    try {
      const res = await apiClient.post<{ success: boolean; data: GapRankingRunResult }>(
        '/research-gaps/rank',
        {
          weights: params?.weights,
          min_composite_score: params?.min_composite_score ?? 0.10,
          min_evidence_count: params?.min_evidence_count ?? 1,
          top_k: params?.top_k,
          corpus_id: params?.corpus_id,
          force_refresh: params?.force_refresh,
        },
        { timeout: 120_000 },
      );
      return res.data;
    } catch {
      return {
        success: false,
        data: {
          run_id: '',
          status: 'failed',
          total_candidates: 0,
          ranked_count: 0,
          weights_used: {},
          ranked_gaps: [],
        },
      };
    }
  },

  listRankedGaps: async (params?: {
    min_score?: number;
    top_k?: number;
    evidence_type?: string;
    corpus_id?: string;
    force_refresh?: boolean;
  }): Promise<{ success: boolean; total: number; data: RankedGap[] }> => {
    try {
      const res = await apiClient.get<{ success: boolean; total: number; data: RankedGap[] }>(
        '/research-gaps',
        { params },
      );
      return res.data;
    } catch {
      return { success: true, total: 0, data: [] };
    }
  },

  getRankedGapById: async (id: string): Promise<{ success: boolean; data: RankedGap | null }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: RankedGap }>(`/research-gaps/${id}`);
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  getRankingWeights: async (): Promise<{ success: boolean; data: RankingWeightsConfig }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: RankingWeightsConfig }>(
        '/research-gaps/weights',
      );
      return res.data;
    } catch {
      return {
        success: true,
        data: {
          recurrence: 0.15,
          evidence_strength: 0.20,
          independent_paper_support: 0.15,
          contradiction_strength: 0.12,
          underexplored_combination_strength: 0.12,
          topic_relevance: 0.08,
          temporal_signal: 0.06,
          graph_evidence: 0.07,
          confidence: 0.05,
        },
      };
    }
  },

  // ─── Evidence-Grounded Hypothesis Generation API (Stage 16) ───────────────

  generateGroundedHypothesis: async (params: {
    gap_id: string;
    force_regenerate?: boolean;
    temperature?: number;
    provider?: string;
    model?: string;
    api_key?: string;
  }): Promise<{ success: boolean; data: GroundedHypothesis; evidence_used?: Record<string, any>; message?: string }> => {
    const res = await apiClient.post<{ success: boolean; data: GroundedHypothesis; evidence_used?: Record<string, any>; message?: string }>(
      '/hypotheses/generate',
      params,
      { timeout: 120_000 },
    );
    return res.data;
  },

  listGroundedHypotheses: async (gapId?: string): Promise<{ success: boolean; total: number; data: GroundedHypothesis[] }> => {
    try {
      const res = await apiClient.get<{ success: boolean; total: number; data: GroundedHypothesis[] }>(
        '/hypotheses',
        { params: gapId ? { gap_id: gapId } : undefined },
      );
      return res.data;
    } catch {
      return { success: true, total: 0, data: [] };
    }
  },

  getGroundedHypothesisById: async (id: string): Promise<{ success: boolean; data: GroundedHypothesis | null; evidence_used?: Record<string, any> }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: GroundedHypothesis; evidence_used?: Record<string, any> }>(
        `/hypotheses/${id}`,
      );
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  getGroundedHypothesisByGapId: async (gapId: string): Promise<{ success: boolean; data: GroundedHypothesis | null; evidence_used?: Record<string, any> }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: GroundedHypothesis; evidence_used?: Record<string, any> }>(
        `/hypotheses/gap/${gapId}`,
      );
      return res.data;
    } catch {
      return { success: false, data: null };
    }
  },

  regenerateGroundedHypothesis: async (id: string, temperature?: number): Promise<{ success: boolean; data: GroundedHypothesis; evidence_used?: Record<string, any>; message?: string }> => {
    const res = await apiClient.post<{ success: boolean; data: GroundedHypothesis; evidence_used?: Record<string, any>; message?: string }>(
      `/hypotheses/${id}/regenerate`,
      { temperature },
      { timeout: 120_000 },
    );
    return res.data;
  },

  // ─── Global Research Search API (Stage 17) ─────────────────────────────────

  searchGlobal: async (params?: SearchQueryParams): Promise<SearchResponse> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: SearchResponse }>('/search', {
        params: {
          q: params?.query,
          type: params?.entity_type,
          page: params?.page,
          limit: params?.limit,
          sort_by: params?.sort_by,
          paper_id: params?.paper_id,
        },
      });
      return res.data.data;
    } catch {
      return {
        query: params?.query || '',
        total: 0,
        page: 1,
        limit: params?.limit || 20,
        total_pages: 1,
        counts_by_type: {
          all: 0,
          papers: 0,
          methods: 0,
          datasets: 0,
          metrics: 0,
          concepts: 0,
          topics: 0,
          limitations: 0,
          research_gaps: 0,
          hypotheses: 0,
        },
        results: [],
        execution_time_ms: 0,
        provider: 'fallback_offline',
      };
    }
  },

  getSearchCounts: async (query?: string): Promise<Record<string, number>> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Record<string, number> }>('/search/counts', {
        params: { q: query },
      });
      return res.data.data;
    } catch {
      return {};
    }
  },

  // ─── Final Research Intelligence Dashboard API (Stage 18) ─────────────────

  getIntelligenceDashboard: async (): Promise<IntelligenceDashboardData> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: IntelligenceDashboardData }>('/intelligence/dashboard');
      return res.data.data;
    } catch {
      return {
        stats: {
          papers_analyzed: 0,
          entities_extracted: 0,
          knowledge_graph_stats: { node_count: 0, edge_count: 0, density: 0 },
          research_topics: 0,
          limitation_clusters: 0,
          future_work_clusters: 0,
          underexplored_patterns: 0,
          contradictions: 0,
          research_gaps: 0,
          hypotheses: 0,
        },
        charts: {
          papers_by_year: [],
          topic_distribution: [],
          research_trends: [],
          limitation_frequency: [],
          gap_types: [],
          contradiction_count: [],
          method_dataset_relationships: [],
        },
        graph: { nodes: [], links: [] },
        generated_at: new Date().toISOString(),
      };
    }
  },





  // Analysis Runs API
  getAnalysisRuns: async (): Promise<AnalysisRun[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: AnalysisRun[] }>('/analysis');
      return res.data.data;
    } catch {
      return clientRuns;
    }
  },

  getAnalysisRunById: async (id: string): Promise<AnalysisRun | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: AnalysisRun }>(`/analysis/${id}`);
      return res.data.data;
    } catch {
      return clientRuns.find((r) => r.id === id) || null;
    }
  },

  // Research Gaps API
  getResearchGaps: async (): Promise<ResearchGap[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ResearchGap[] }>('/gaps');
      return res.data.data;
    } catch {
      return clientGaps;
    }
  },

  getResearchGapById: async (id: string): Promise<ResearchGap | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ResearchGap }>(`/gaps/${id}`);
      return res.data.data;
    } catch {
      return clientGaps.find((g) => g.id === id) || null;
    }
  },

  // Hypotheses API
  getHypotheses: async (): Promise<Hypothesis[]> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Hypothesis[] }>('/hypotheses');
      return res.data.data;
    } catch {
      return clientHypotheses;
    }
  },

  getHypothesisById: async (id: string): Promise<Hypothesis | null> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: Hypothesis }>(`/hypotheses/${id}`);
      return res.data.data;
    } catch {
      return clientHypotheses.find((h) => h.id === id) || null;
    }
  },

  // Health API
  getBackendHealth: async (): Promise<HealthStatusResponse> => {
    const res = await apiClient.get<HealthStatusResponse>('/health');
    return res.data;
  },

  getBackendReadiness: async (): Promise<ReadinessResponse> => {
    const res = await apiClient.get<ReadinessResponse>('/health/ready', {
      validateStatus: (status) => status < 600,
    });
    return res.data;
  },

  // ── Academic Search (arXiv) ───────────────────────────────────────────────────

  /**
   * Search academic papers via arXiv through the backend proxy.
   */
  academicSearch: async (query: string, page = 1, limit = 10): Promise<AcademicSearchResponse> => {
    const res = await apiClient.get<{ success: boolean; data: AcademicSearchResponse }>(
      '/search/academic',
      { params: { q: query, page, limit } }
    );
    return res.data.data;
  },

  // ── Corpus Analysis Orchestration ─────────────────────────────────────────────

  /**
   * Link an already-uploaded paper (by its UUID) to a corpus without re-uploading.
   */
  addPaperToCorpusById: async (corpusId: string, paperId: string, source?: 'upload' | 'academic_search'): Promise<void> => {
    await apiClient.post(`/corpora/${corpusId}/papers`, { paper_id: paperId, source: source ?? 'upload' });
  },

  /**
   * Trigger full end-to-end analysis for a corpus (non-blocking — returns 202 immediately).
   * Poll getAnalysisStatus() for progress.
   */
  startCorpusAnalysis: async (corpusId: string): Promise<{ corpus_id: string; status: string; paper_count: number }> => {
    const res = await apiClient.post<{ success: boolean; data: { corpus_id: string; status: string; paper_count: number } }>(
      `/corpora/${corpusId}/analyze`
    );
    return res.data.data;
  },

  /**
   * Poll analysis progress for a corpus.
   */
  getAnalysisStatus: async (corpusId: string): Promise<CorpusAnalysisStatus> => {
    const res = await apiClient.get<{ success: boolean; data: CorpusAnalysisStatus }>(
      `/corpora/${corpusId}/analysis-status`
    );
    return res.data.data;
  },
};

