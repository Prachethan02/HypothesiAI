/**
 * Discover Papers — Priority 2: Academic Search Integration
 * ==========================================================
 * Allows users to search academic papers via arXiv and add them
 * to any research corpus. Uses the backend GET /api/v1/search/academic proxy.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  BookOpen,
  ExternalLink,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Folders,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  apiService,
  AcademicSearchResult,
  AcademicSearchResponse,
  Corpus,
} from '../services/api';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  LoadingState,
} from '../components/ui';

type AddStatus = 'idle' | 'adding' | 'done' | 'error';

interface ResultState {
  data: AcademicSearchResponse | null;
  loading: boolean;
  error: string | null;
}

export const DiscoverPapers: React.FC = () => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [result, setResult] = useState<ResultState>({ data: null, loading: false, error: null });

  // Corpus state for "Add to Corpus"
  const [corpora, setCorpora] = useState<Corpus[]>([]);
  const [corporaLoaded, setCorporaLoaded] = useState(false);
  const [selectedCorpusId, setSelectedCorpusId] = useState('');

  // Per-result add-to-corpus status
  const [addStatus, setAddStatus] = useState<Record<string, AddStatus>>({});
  const [addError, setAddError] = useState<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load corpora list once (on first interaction) ──────────────────────────
  const loadCorpora = useCallback(async () => {
    if (corporaLoaded) return;
    try {
      const list = await apiService.listCorpora();
      setCorpora(list);
      if (list.length > 0) setSelectedCorpusId(list[0].id);
    } catch (err: any) {
      console.warn('Could not load corpora:', err.message);
    } finally {
      setCorporaLoaded(true);
    }
  }, [corporaLoaded]);

  // ── Search handler ─────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (searchPage = 1) => {
    const q = query.trim();
    if (!q) return;

    setResult({ data: null, loading: true, error: null });
    setPage(searchPage);
    setAddStatus({});
    setAddError({});

    try {
      const data = await apiService.academicSearch(q, searchPage, limit);
      setResult({ data, loading: false, error: null });
    } catch (err: any) {
      setResult({
        data: null,
        loading: false,
        error: err.response?.data?.error?.message || err.message || 'Search failed',
      });
    }
  }, [query, limit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      handleSearch(1);
      loadCorpora();
    }
  };

  // ── Add to Corpus ─────────────────────────────────────────────────────────
  const handleAddToCorpus = async (paper: AcademicSearchResult) => {
    if (!selectedCorpusId) {
      alert('Please select a corpus first.');
      return;
    }

    setAddStatus((prev) => ({ ...prev, [paper.id]: 'adding' }));
    setAddError((prev) => ({ ...prev, [paper.id]: '' }));

    try {
      // First: does this arXiv paper already exist in the local DB?
      // We search locally for it; if not found, we inform the user they need to
      // upload the PDF manually (arXiv PDF download would require a separate ingestion step).
      // For now: add a note in the UI about manual PDF upload.
      // NOTE: We cannot auto-ingest the PDF here without a backend download+process step.
      // This implementation adds a placeholder entry to the corpus and advises the user.
      // A future enhancement would trigger backend PDF download from arxiv_id.

      // Search local DB to find if we already have this paper
      const localSearch = await apiService.searchGlobal({ query: paper.title, entity_type: 'papers', limit: 3 });
      const localMatch = localSearch.results?.find(
        (r: any) =>
          r.title?.toLowerCase().includes(paper.title.toLowerCase().substring(0, 30))
      );

      if (localMatch?.id) {
        // Found locally — link it
        await apiService.addPaperToCorpusById(selectedCorpusId, localMatch.id, 'academic_search');
        setAddStatus((prev) => ({ ...prev, [paper.id]: 'done' }));
      } else {
        // Not in local DB yet — show guidance
        setAddStatus((prev) => ({ ...prev, [paper.id]: 'error' }));
        setAddError((prev) => ({
          ...prev,
          [paper.id]: 'Paper not yet in your library. Download the PDF from arXiv and upload it to your corpus.',
        }));
      }
    } catch (err: any) {
      setAddStatus((prev) => ({ ...prev, [paper.id]: 'error' }));
      setAddError((prev) => ({
        ...prev,
        [paper.id]: err.response?.data?.error?.message || err.message || 'Failed to add',
      }));
    }
  };

  const { data, loading, error } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: '0.375rem', color: '#818cf8', fontSize: '0.75rem', fontWeight: 600 }}>
            Priority 2 — Academic Search
          </span>
        </div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BookOpen size={28} style={{ color: '#818cf8' }} />
          Discover Academic Papers
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '800px', marginTop: '0.25rem' }}>
          Search academic papers from <strong style={{ color: '#a5b4fc' }}>arXiv</strong> (free, no API key required).
          Find relevant papers and add them to your research corpus for analysis.
        </p>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <Card style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
              <Search size={18} />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search academic papers (e.g. 'transformer attention mechanism hallucination')"
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.75rem',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <Button
            variant="primary"
            leftIcon={loading ? <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Search size={16} />}
            onClick={() => { setPage(1); handleSearch(1); loadCorpora(); }}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching…' : 'Search arXiv'}
          </Button>
        </div>

        {/* Corpus Selector */}
        {corporaLoaded && corpora.length > 0 && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Folders size={15} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Add results to:</span>
            </div>
            <select
              value={selectedCorpusId}
              onChange={(e) => setSelectedCorpusId(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                minWidth: '220px',
              }}
            >
              {corpora.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.paper_count ?? 0} papers)
                </option>
              ))}
            </select>
            <Link to="/corpus">
              <Button variant="ghost" size="sm" leftIcon={<FolderPlus size={14} />}>
                New Corpus
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && <LoadingState message="Searching arXiv…" />}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {!loading && data && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Found <strong style={{ color: '#ffffff' }}>{data.total.toLocaleString()}</strong> papers for&nbsp;
              <strong style={{ color: '#a5b4fc' }}>"{data.query}"</strong>
              &nbsp;·&nbsp;<span style={{ color: 'var(--text-muted)' }}>{data.execution_time_ms}ms via {data.provider}</span>
            </div>
            {data.total_pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ChevronLeft size={14} />}
                  onClick={() => handleSearch(page - 1)}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Page {page} of {data.total_pages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ChevronRight size={14} />}
                  onClick={() => handleSearch(page + 1)}
                  disabled={page >= data.total_pages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          {data.results.length === 0 ? (
            <EmptyState
              title="No Results Found"
              description={`No arXiv papers matched "${data.query}". Try broader search terms.`}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.results.map((paper) => {
                const status = addStatus[paper.id] ?? 'idle';
                const errMsg = addError[paper.id];
                const arxivId = paper.metadata?.arxiv_id;
                const authors = paper.metadata?.authors;
                const year = paper.metadata?.publication_year;

                return (
                  <Card key={paper.id} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        {/* Title */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <FileText size={16} style={{ color: '#818cf8', flexShrink: 0, marginTop: '0.15rem' }} />
                          <h3 style={{ fontSize: '0.975rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.4 }}>
                            {paper.title}
                          </h3>
                        </div>

                        {/* Meta */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {authors && <span><strong style={{ color: 'var(--text-secondary)' }}>Authors:</strong> {authors}</span>}
                          {year && <span>{year}</span>}
                          {arxivId && (
                            <span>
                              arXiv: <code style={{ color: '#818cf8' }}>{arxivId}</code>
                            </span>
                          )}
                        </div>

                        {/* Snippet */}
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '0.5rem', maxWidth: '800px' }}>
                          {paper.snippet}
                        </p>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {paper.url && (
                            <a href={paper.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" rightIcon={<ExternalLink size={13} />}>
                                View
                              </Button>
                            </a>
                          )}
                          {paper.metadata?.pdf_url && (
                            <a href={paper.metadata.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                PDF
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={
                              status === 'adding' ? <RefreshCw size={13} style={{ animation: 'spin 1.5s linear infinite' }} /> :
                              status === 'done' ? <CheckCircle2 size={13} /> :
                              status === 'error' ? <X size={13} /> :
                              <FolderPlus size={13} />
                            }
                            onClick={() => handleAddToCorpus(paper)}
                            disabled={status === 'adding' || status === 'done' || !selectedCorpusId}
                          >
                            {status === 'done' ? 'Added' : status === 'adding' ? 'Adding…' : 'Add to Corpus'}
                          </Button>
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <Badge variant="info">arXiv</Badge>
                          {status === 'done' && <Badge variant="success">In Corpus</Badge>}
                          {status === 'error' && <Badge variant="danger">Not Linked</Badge>}
                        </div>
                      </div>
                    </div>

                    {/* Per-result error message */}
                    {status === 'error' && errMsg && (
                      <div style={{ fontSize: '0.75rem', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: '0.35rem', backgroundColor: 'rgba(239,68,68,0.08)', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                        <span>{errMsg}</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination bottom */}
          {data.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', paddingTop: '1rem' }}>
              <Button
                variant="ghost"
                leftIcon={<ChevronLeft size={15} />}
                onClick={() => handleSearch(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Page {page} / {data.total_pages}
              </span>
              <Button
                variant="ghost"
                rightIcon={<ChevronRight size={15} />}
                onClick={() => handleSearch(page + 1)}
                disabled={page >= data.total_pages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Empty / Initial State ────────────────────────────────────────────── */}
      {!loading && !data && !error && (
        <Card style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <EmptyState
            title="Search Academic Literature"
            description="Enter keywords above to search arXiv for relevant papers. Add discovered papers to your research corpus for automated gap analysis."
            action={
              <Link to="/corpus">
                <Button variant="ghost" leftIcon={<Folders size={16} />}>
                  Go to Research Corpora
                </Button>
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
};

export default DiscoverPapers;
