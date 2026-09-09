/**
 * Pluggable Search Contracts – Stage 17 Global Research Search
 * ==============================================================
 * Defines the unified interfaces for search queries, search results,
 * and search providers. Designed so Elasticsearch or OpenSearch can be
 * plugged in later without altering the API contract or rewriting any frontend code.
 */

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
  query: string;
  entity_type?: SearchEntityType;
  page?: number;
  limit?: number;
  sort_by?: SearchSortBy;
  paper_id?: string;
  min_score?: number;
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

export interface ISearchProvider {
  name: string;
  search(params: SearchQueryParams): Promise<SearchResponse>;
  suggest?(query: string): Promise<string[]>;
}
