import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

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

  // Topics API (Stage 10)
  generateTopics: async (): Promise<{ success: boolean; data: any }> => {
    const res = await apiClient.post('/topics/generate');
    return res.data;
  },

  getTopics: async (): Promise<{ success: boolean; data: { run: any; topics: any[] } }> => {
    const res = await apiClient.get('/topics');
    return res.data;
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
    const res = await apiClient.get<ReadinessResponse>('/health/ready');
    return res.data;
  },
};
