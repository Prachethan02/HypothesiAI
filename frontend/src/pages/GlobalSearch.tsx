import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Sliders,
  FileText,
  Cpu,
  Database,
  BarChart,
  Tag,
  Globe,
  AlertCircle,
  Compass,
  Lightbulb,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  SearchEntityType,
  SearchSortBy,
  SearchResultItem,
  SearchResponse,
} from '../services/api';

const ENTITY_TYPE_CONFIG: Record<
  SearchEntityType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  all: { label: 'All Results', icon: Layers, color: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)' },
  papers: { label: 'Papers', icon: FileText, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  methods: { label: 'Methods', icon: Cpu, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  datasets: { label: 'Datasets', icon: Database, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  metrics: { label: 'Metrics', icon: BarChart, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  concepts: { label: 'Concepts', icon: Tag, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' },
  topics: { label: 'Topics', icon: Globe, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  limitations: { label: 'Limitations', icon: AlertCircle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  research_gaps: { label: 'Research Gaps', icon: Compass, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
  hypotheses: { label: 'Hypotheses', icon: Lightbulb, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
};

export const GlobalSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlQuery = searchParams.get('q') || '';
  const urlType = (searchParams.get('type') || 'all') as SearchEntityType;
  const urlPage = parseInt(searchParams.get('page') || '1', 10);
  const urlSort = (searchParams.get('sort') || 'relevance') as SearchSortBy;

  const [inputQuery, setInputQuery] = useState<string>(urlQuery);
  const [activeType, setActiveType] = useState<SearchEntityType>(urlType);
  const [activeSort, setActiveSort] = useState<SearchSortBy>(urlSort);
  const [currentPage, setCurrentPage] = useState<number>(urlPage);
  const pageSize = 15;

  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.searchGlobal({
        query: inputQuery.trim(),
        entity_type: activeType,
        page: currentPage,
        limit: pageSize,
        sort_by: activeSort,
      });
      setSearchData(res);
    } catch (err: any) {
      setError(err.message || 'Search execution failed.');
    } finally {
      setLoading(false);
    }
  }, [inputQuery, activeType, currentPage, activeSort]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchParams({
      q: inputQuery.trim(),
      type: activeType,
      page: '1',
      sort: activeSort,
    });
  };

  const handleTypeTabChange = (type: SearchEntityType) => {
    setActiveType(type);
    setCurrentPage(1);
    setSearchParams({
      q: inputQuery.trim(),
      type,
      page: '1',
      sort: activeSort,
    });
  };

  const handleSortChange = (sort: SearchSortBy) => {
    setActiveSort(sort);
    setCurrentPage(1);
    setSearchParams({
      q: inputQuery.trim(),
      type: activeType,
      page: '1',
      sort,
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (searchData && newPage > searchData.total_pages)) return;
    setCurrentPage(newPage);
    setSearchParams({
      q: inputQuery.trim(),
      type: activeType,
      page: String(newPage),
      sort: activeSort,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const counts = searchData?.counts_by_type || ({} as Record<string, number>);

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Search size={24} color="#818cf8" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Global Research Search Engine
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Unified search across papers, methods, datasets, metrics, concepts, topics, limitations, research gaps, and hypotheses.
          </p>
        </div>

        {/* Pluggable Architecture Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.8rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            color: '#6ee7b7',
          }}
        >
          <CheckCircle2 size={14} color="#10b981" />
          <span>Search Engine: Native PostgreSQL (Elasticsearch / OpenSearch Pluggable)</span>
        </div>
      </div>

      {/* Main Search Input Form */}
      <form
        onSubmit={handleFormSubmit}
        style={{
          display: 'flex',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.625rem',
          padding: '0.625rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, paddingLeft: '0.75rem', gap: '0.6rem' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Search all research entities (e.g. 'transformer', 'imagenet', 'accuracy', 'stagnation')…"
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
            }}
          />
          {inputQuery && (
            <button
              type="button"
              onClick={() => {
                setInputQuery('');
                setCurrentPage(1);
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="submit"
          style={{
            padding: '0.6rem 1.5rem',
            backgroundColor: '#4f46e5',
            border: 'none',
            borderRadius: '0.5rem',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>Search</span>
        </button>
      </form>

      {/* Entity Type Filter Tabs with Match Counters */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.35rem',
          scrollbarWidth: 'thin',
        }}
      >
        {(
          [
            'all',
            'papers',
            'methods',
            'datasets',
            'metrics',
            'concepts',
            'topics',
            'limitations',
            'research_gaps',
            'hypotheses',
          ] as SearchEntityType[]
        ).map((type) => {
          const cfg = ENTITY_TYPE_CONFIG[type];
          const Icon = cfg.icon;
          const isActive = activeType === type;
          const count = counts[type] || 0;

          return (
            <button
              key={type}
              onClick={() => handleTypeTabChange(type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.5rem',
                backgroundColor: isActive ? cfg.color : 'var(--bg-secondary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? `1px solid ${cfg.color}` : '1px solid var(--border-color)',
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              <span>{cfg.label}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-bar: Result Statistics and Sort Order Dropdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.6rem 1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Found <strong style={{ color: 'var(--text-primary)' }}>{searchData?.total || 0}</strong> results
          {searchData?.execution_time_ms ? ` in ${searchData.execution_time_ms}ms` : ''}
          {inputQuery && ` for query "${inputQuery}"`}
        </div>

        {/* Sorting Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sort by:</span>
          <select
            value={activeSort}
            onChange={(e) => handleSortChange(e.target.value as SearchSortBy)}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.3rem 0.6rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
            }}
          >
            <option value="relevance">Best Relevance</option>
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="title_asc">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', color: '#f87171', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Executing search across all 9 research entity indices…
          </div>
        ) : !searchData || searchData.results.length === 0 ? (
          <div
            style={{
              padding: '3.5rem 2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.75rem',
              border: '1px dashed var(--border-color)',
            }}
          >
            <Search size={40} color="#6b7280" style={{ margin: '0 auto 1rem', opacity: 0.7 }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              No Matching Research Entities Found
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Try searching with broader keywords, clearing specific entity filters, or exploring all results.
            </p>
          </div>
        ) : (
          searchData.results.map((item: SearchResultItem) => {
            const cfg = ENTITY_TYPE_CONFIG[item.entity_type] || ENTITY_TYPE_CONFIG.papers;
            const Icon = cfg.icon;

            return (
              <div
                key={`${item.entity_type}-${item.id}`}
                onClick={() => item.url && navigate(item.url)}
                style={{
                  padding: '1.125rem 1.25rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '0.625rem',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  cursor: item.url ? 'pointer' : 'default',
                  transition: 'border-color 0.15s ease, transform 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = cfg.color;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Header: Entity Type Badge + Title + Relevance Score */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        backgroundColor: cfg.bg,
                        color: cfg.color,
                      }}
                    >
                      <Icon size={13} />
                      <span>{cfg.label}</span>
                    </span>

                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.35' }}>
                      {item.title}
                    </h3>
                  </div>

                  {/* Relevance Score Indicator */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexShrink: 0,
                      fontSize: '0.725rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>Match:</span>
                    <span style={{ color: cfg.color, fontWeight: 700 }}>
                      {Math.round(item.relevance_score * 100)}%
                    </span>
                    {item.url && <ExternalLink size={13} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Matched Snippet */}
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {item.snippet}
                </p>

                {/* Metadata & Source Provenance Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                  {item.source_paper_title && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FileText size={12} color="#38bdf8" />
                      <span>Source: {item.source_paper_title}</span>
                    </span>
                  )}

                  {item.created_at && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} />
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </span>
                  )}

                  {item.metadata?.rank && (
                    <span>Rank: #{item.metadata.rank}</span>
                  )}

                  {item.metadata?.composite_score && (
                    <span>Score: {Number(item.metadata.composite_score).toFixed(3)}</span>
                  )}

                  {item.metadata?.confidence && (
                    <span>Confidence: {(Number(item.metadata.confidence) * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {searchData && searchData.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
            }}
          >
            <ChevronLeft size={15} />
            <span>Previous</span>
          </button>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Page <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{searchData.total_pages}</strong>
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= searchData.total_pages}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: currentPage >= searchData.total_pages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: currentPage >= searchData.total_pages ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
            }}
          >
            <span>Next</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}

    </div>
  );
};

export default GlobalSearch;
