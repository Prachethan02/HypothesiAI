import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Sparkles,
  Cpu,
  GitMerge,
  Eye,
  ShieldCheck,
  Search,
  Tag,
} from 'lucide-react';
import {
  apiService,
  PaperSection,
  DetailedPaperAnalysis,
  TraceableEntityItem,
  ResolutionDecision,
} from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  BadgeVariant,
  LoadingState,
  EmptyState,
  Modal,
} from '../components/ui';

type AnalysisTab =
  | 'overview'
  | 'sections'
  | 'methods'
  | 'datasets'
  | 'metrics'
  | 'findings'
  | 'limitations'
  | 'future_work'
  | 'topics'
  | 'graph';

export const PaperDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [analysis, setAnalysis] = useState<DetailedPaperAnalysis | null>(null);
  const [auditTrail, setAuditTrail] = useState<ResolutionDecision[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [embedding, setEmbedding] = useState<boolean>(false);
  const [resolving, setResolving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Evidence Inspector Modal state
  const [inspectedEntity, setInspectedEntity] = useState<TraceableEntityItem | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async (paperId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analysisData, auditData] = await Promise.all([
        apiService.getDetailedPaperAnalysis(paperId),
        apiService.getResolutionAudit(paperId),
      ]);

      if (analysisData) {
        setAnalysis(analysisData);
      } else {
        // Fallback for offline or legacy endpoint
        const [paperData, sectionsData, entitiesData] = await Promise.all([
          apiService.getPaperById(paperId),
          apiService.getPaperSections(paperId),
          apiService.getPaperEntities(paperId),
        ]);

        if (paperData) {
          const sectionMap = new Map<string, PaperSection>();
          for (const s of sectionsData) {
            sectionMap.set(s.id, s);
          }

          const traceable: TraceableEntityItem[] = entitiesData.map((e) => {
            const sec = e.section_id ? sectionMap.get(e.section_id) : undefined;
            return {
              id: e.id,
              paper_id: paperData.id,
              paper_title: paperData.title,
              entity_type: e.entity_type,
              text: e.text,
              normalized_name: e.normalized_name,
              confidence: e.confidence,
              page_number: e.page_number ?? (sec ? sec.page_start : 1),
              section_id: e.section_id ?? (sec ? sec.id : null),
              section_heading: sec ? (sec.heading || sec.section_type) : 'Document Body',
              section_type: sec ? sec.section_type : 'general',
              source_reference: e.source_reference,
              surrounding_text: sec ? sec.content.slice(0, 250) : null,
            };
          });

          setAnalysis({
            paper: paperData,
            sections: sectionsData,
            methods: traceable.filter((e) => e.entity_type === 'method'),
            datasets: traceable.filter((e) => e.entity_type === 'dataset'),
            metrics: traceable.filter((e) => e.entity_type === 'metric'),
            findings: traceable.filter((e) => e.entity_type === 'finding'),
            limitations: traceable.filter((e) => e.entity_type === 'limitation'),
            future_work: traceable.filter((e) => e.entity_type === 'future_work'),
            topics: [],
            graph_relationships: [],
          });
        }
      }
      setAuditTrail(auditData);
    } catch (err) {
      console.warn('Failed to load detailed paper analysis:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  // Polling if paper is still processing
  useEffect(() => {
    if (id && analysis?.paper && (analysis.paper.status === 'uploaded' || analysis.paper.status === 'processing')) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          loadData(id, true);
        }, 3000);
      }
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [id, analysis?.paper]);

  const handleExtractEntities = async () => {
    if (!id) return;
    setExtracting(true);
    try {
      await apiService.triggerPaperExtraction(id);
      await loadData(id, true);
      setActiveTab('methods');
    } catch (err) {
      console.error('Failed to trigger extraction', err);
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    if (!id) return;
    setEmbedding(true);
    try {
      await apiService.embedPaperEntities(id);
      await loadData(id, true);
    } catch (err) {
      console.error('Failed to generate embeddings', err);
    } finally {
      setEmbedding(false);
    }
  };

  const handleNormalizeEntities = async () => {
    if (!id) return;
    setResolving(true);
    try {
      await apiService.resolvePaperEntities(id);
      await loadData(id, true);
    } catch (err) {
      console.error('Failed to normalize entities', err);
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Assembling detailed paper analysis, empirical traceability & knowledge graph..." />;
  }

  if (!analysis || !analysis.paper) {
    return (
      <EmptyState
        icon={<FileText size={40} />}
        title="Paper Not Found"
        description={`No ingested research paper matches ID "${id}".`}
        action={
          <Link to="/papers">
            <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
              Back to Library
            </Button>
          </Link>
        }
      />
    );
  }

  const { paper, sections, methods, datasets, metrics, findings, limitations, future_work, topics, graph_relationships } = analysis;

  const totalExtractedCount =
    methods.length + datasets.length + metrics.length + findings.length + limitations.length + future_work.length;

  // Filter items helper for entity tabs
  const filterTraceableList = (list: TraceableEntityItem[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        (item.normalized_name && item.normalized_name.toLowerCase().includes(q)) ||
        item.section_heading.toLowerCase().includes(q)
    );
  };

  // Render an individual traceable entity card with strict epistemic demarcation
  const renderEntityCard = (item: TraceableEntityItem, categoryLabel: string, badgeVariant: BadgeVariant) => {
    return (
      <Card
        key={item.id}
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          position: 'relative',
        }}
      >
        {/* Top: Header & Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge variant={badgeVariant}>
              {categoryLabel}
            </Badge>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              VERBATIM PUBLISHED EXTRACT
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Sparkles size={11} />
              AI-EXTRACTED ({Math.round(item.confidence * 100)}% CONFIDENCE)
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Eye size={14} />}
            onClick={() => setInspectedEntity(item)}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
          >
            Inspect Evidence
          </Button>
        </div>

        {/* Verbatim Text Section - Clearly labeled and visually distinct */}
        <div
          style={{
            padding: '0.85rem 1.1rem',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '0 0.375rem 0.375rem 0',
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#f59e0b',
              marginBottom: '0.35rem',
            }}
          >
            Original Verbatim Text from Paper
          </div>
          <div
            style={{
              fontSize: '0.95rem',
              color: '#f1f5f9',
              lineHeight: 1.55,
              fontFamily: 'serif',
              fontStyle: 'italic',
            }}
          >
            "{item.text}"
          </div>
        </div>

        {/* AI Interpretation / Canonical Form - Explicitly labeled as AI interpretation */}
        {item.normalized_name && (
          <div
            style={{
              padding: '0.6rem 0.85rem',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              borderLeft: '4px solid #6366f1',
              borderRadius: '0 0.375rem 0.375rem 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>
                AI Canonical Concept:
              </span>
              <code style={{ fontSize: '0.85rem', color: '#c7d2fe', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                {item.normalized_name}
              </code>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Canonicalized representation across corpus
            </span>
          </div>
        )}

        {/* 4-Point Source Traceability Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileText size={13} style={{ color: '#94a3b8' }} />
            <span>Paper: <strong style={{ color: '#e2e8f0' }}>{item.paper_title.slice(0, 32)}…</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>Page:</span>
            <strong style={{ color: '#e2e8f0' }}>{item.page_number}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600, color: '#34d399' }}>Section:</span>
            <span style={{ color: '#e2e8f0' }}>{item.section_heading}</span>
          </div>
          {item.source_reference && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontWeight: 600, color: '#fbbf24' }}>Ref:</span>
              <code style={{ color: '#cbd5e1' }}>{item.source_reference}</code>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Breadcrumb & Action Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/papers">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
              Back to Library
            </Button>
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Detailed Paper Intelligence</span>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <code style={{ fontSize: '0.8rem', color: '#818cf8' }}>{paper.id.slice(0, 8)}</code>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {sections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles size={14} />}
              onClick={handleExtractEntities}
              isLoading={extracting}
            >
              {totalExtractedCount > 0 ? 'Re-extract Entities' : 'Extract Entities'}
            </Button>
          )}
          {totalExtractedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Cpu size={14} />}
              onClick={handleGenerateEmbeddings}
              isLoading={embedding}
            >
              Generate Vectors
            </Button>
          )}
          {totalExtractedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<GitMerge size={14} />}
              onClick={handleNormalizeEntities}
              isLoading={resolving}
            >
              Normalize Concepts
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => loadData(paper.id, false)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Epistemic Demarcation Guardrail Banner */}
      <div
        style={{
          padding: '1.1rem 1.4rem',
          borderRadius: '0.5rem',
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        <ShieldCheck size={24} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem', fontSize: '0.88rem' }}>
            Empirical Source Traceability & Epistemic Guardrail
          </strong>
          Every analytical finding in this dashboard is partitioned into two distinct categories:
          <span style={{ display: 'inline-block', margin: '0.3rem 0.6rem 0 0', color: '#f59e0b', fontWeight: 600 }}>
            [1] Verbatim Published Extracts
          </span>{' '}
          (exact quotations from specific pages and sections of the PDF document), and
          <span style={{ display: 'inline-block', margin: '0.3rem 0.6rem 0 0.4rem', color: '#818cf8', fontWeight: 600 }}>
            [2] AI-Derived Interpretations
          </span>{' '}
          (canonical cluster names, categorizations, and model inferences). Never mistake AI canonical summaries for peer-reviewed published text.
        </div>
      </div>

      {/* Paper Hero Card */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <Badge variant="info">Peer-Reviewed Paper</Badge>
              <Badge
                variant={
                  paper.status === 'parsed' || paper.status === 'indexed'
                    ? 'success'
                    : paper.status === 'failed'
                    ? 'danger'
                    : 'warning'
                }
              >
                {paper.status.toUpperCase()}
              </Badge>
              {paper.total_pages && (
                <Badge variant="outline">
                  {paper.total_pages} {paper.total_pages === 1 ? 'Page' : 'Pages'}
                </Badge>
              )}
              {totalExtractedCount > 0 && (
                <Badge variant="success">
                  {totalExtractedCount} Extracted Signals
                </Badge>
              )}
              {topics.length > 0 && (
                <Badge variant="default">
                  {topics.length} Assigned Topics
                </Badge>
              )}
            </div>

            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.3,
                marginBottom: '0.85rem',
              }}
            >
              {paper.title}
            </h1>

            {/* Authors */}
            {paper.authors && paper.authors.length > 0 && (
              <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Authors: </strong>
                {paper.authors.map((a) => a.name).join(', ')}
              </div>
            )}

            {/* Metadata Badges & Links */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.25rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                alignItems: 'center',
              }}
            >
              {paper.publication_year && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} style={{ color: '#38bdf8' }} />
                  <span>Year: <strong style={{ color: '#ffffff' }}>{paper.publication_year}</strong></span>
                </div>
              )}
              {paper.venue && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BookOpen size={14} style={{ color: '#a78bfa' }} />
                  <span>Venue: <strong style={{ color: '#ffffff' }}>{paper.venue}</strong></span>
                </div>
              )}
              {paper.doi && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>DOI: </span>
                  <a
                    href={paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#818cf8', textDecoration: 'underline' }}
                  >
                    {paper.doi}
                  </a>
                </div>
              )}
              {paper.file_size_bytes ? (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Size: </span>
                  <span style={{ color: '#e2e8f0' }}>{(paper.file_size_bytes / 1024).toFixed(0)} KB</span>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
            {paper.file_url && (
              <a href={paper.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                  View Published PDF
                </Button>
              </a>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              Ingested: {new Date(paper.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Quick Analytical Metric Counters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginTop: '1.75rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            onClick={() => setActiveTab('sections')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'sections' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'sections' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sections</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>{sections.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('methods')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'methods' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'methods' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Methods</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>{methods.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('datasets')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'datasets' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'datasets' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Datasets</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>{datasets.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('metrics')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'metrics' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'metrics' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Metrics</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{metrics.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('findings')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'findings' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'findings' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Findings</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{findings.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('limitations')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'limitations' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'limitations' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Limitations</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171' }}>{limitations.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('future_work')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'future_work' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'future_work' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Future Work</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24' }}>{future_work.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('graph')}
            style={{
              padding: '0.75rem',
              backgroundColor: activeTab === 'graph' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              border: activeTab === 'graph' ? '1px solid #6366f1' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>KG Edges</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c084fc' }}>{graph_relationships.length}</div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.5rem',
          overflowX: 'auto',
        }}
      >
        <Button
          variant={activeTab === 'overview' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
        >
          Abstract & Overview
        </Button>
        <Button
          variant={activeTab === 'sections' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('sections')}
        >
          Extracted Sections ({sections.length})
        </Button>
        <Button
          variant={activeTab === 'methods' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('methods')}
        >
          Methods ({methods.length})
        </Button>
        <Button
          variant={activeTab === 'datasets' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('datasets')}
        >
          Datasets ({datasets.length})
        </Button>
        <Button
          variant={activeTab === 'metrics' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('metrics')}
        >
          Metrics ({metrics.length})
        </Button>
        <Button
          variant={activeTab === 'findings' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('findings')}
        >
          Findings ({findings.length})
        </Button>
        <Button
          variant={activeTab === 'limitations' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('limitations')}
        >
          Limitations ({limitations.length})
        </Button>
        <Button
          variant={activeTab === 'future_work' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('future_work')}
        >
          Future Work ({future_work.length})
        </Button>
        <Button
          variant={activeTab === 'topics' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('topics')}
        >
          Topics ({topics.length})
        </Button>
        <Button
          variant={activeTab === 'graph' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('graph')}
        >
          Graph Relationships ({graph_relationships.length})
        </Button>
      </div>

      {/* Tab: Abstract & Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Abstract (Verbatim Published Text)</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                  padding: '1rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  borderLeft: '4px solid #38bdf8',
                  borderRadius: '0 0.375rem 0.375rem 0',
                }}
              >
                {paper.abstract ||
                  sections.find((s) => s.section_type === 'abstract')?.content ||
                  'Abstract text was not detected as an isolated section in the PDF.'}
              </div>
            </CardContent>
          </Card>

          {/* Analytical Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Top Methods Summary */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle>Core Methods ({methods.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('methods')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {methods.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No methods extracted yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {methods.slice(0, 4).map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 500 }}>
                          {m.normalized_name || m.text}
                        </span>
                        <Badge variant="outline">P.{m.page_number}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Datasets Summary */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle>Evaluation Datasets ({datasets.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('datasets')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {datasets.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No datasets extracted yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {datasets.slice(0, 4).map((d) => (
                      <div
                        key={d.id}
                        style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 500 }}>
                          {d.normalized_name || d.text}
                        </span>
                        <Badge variant="outline">P.{d.page_number}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Findings Summary */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle>Empirical Findings ({findings.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('findings')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {findings.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No findings extracted yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {findings.slice(0, 3).map((f) => (
                      <div
                        key={f.id}
                        style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '0.375rem',
                          fontSize: '0.85rem',
                          color: '#e2e8f0',
                        }}
                      >
                        <div style={{ fontStyle: 'italic', marginBottom: '0.25rem' }}>"{f.text}"</div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Page {f.page_number} • {f.section_heading}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stated Limitations Summary */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle>Stated Limitations ({limitations.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('limitations')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {limitations.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No limitations extracted yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {limitations.slice(0, 3).map((l) => (
                      <div
                        key={l.id}
                        style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.05)',
                          borderLeft: '2px solid #ef4444',
                          borderRadius: '0.375rem',
                          fontSize: '0.85rem',
                          color: '#e2e8f0',
                        }}
                      >
                        <div style={{ fontStyle: 'italic', marginBottom: '0.25rem' }}>"{l.text}"</div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Page {l.page_number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Extracted Sections */}
      {activeTab === 'sections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sections.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={32} style={{ color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
                  {paper.status === 'processing'
                    ? 'Extracting Structural Sections...'
                    : 'No Sections Recorded Yet'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '480px' }}>
                  PyMuPDF structural segmenter segments the PDF text into classified sections (Introduction, Methods, Results, Discussion, Limitations).
                </p>
              </div>
            </Card>
          ) : (
            sections.map((sec, idx) => (
              <Card key={sec.id || idx}>
                <CardHeader>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CardTitle>{sec.heading || sec.section_type.toUpperCase()}</CardTitle>
                      <Badge variant="info">{sec.section_type}</Badge>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant="outline">
                        {sec.page_start === sec.page_end
                          ? `Page ${sec.page_start}`
                          : `Pages ${sec.page_start}–${sec.page_end}`}
                      </Badge>
                      <Badge variant="default">
                        {sec.word_count || sec.content.split(/\s+/).length} words
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      maxHeight: '350px',
                      overflowY: 'auto',
                      padding: '0.5rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '0.375rem',
                    }}
                  >
                    {sec.content}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab: Methods */}
      {activeTab === 'methods' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {filterTraceableList(methods).length} of {methods.length} research methods identified in publication.
            </div>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter methods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>

          {methods.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No methods extracted for this paper yet.</p>
              <Button variant="outline" size="sm" onClick={handleExtractEntities} isLoading={extracting} style={{ marginTop: '0.75rem' }}>
                Run Information Extraction
              </Button>
            </Card>
          ) : filterTraceableList(methods).length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No methods match your search filter.</p>
            </Card>
          ) : (
            filterTraceableList(methods).map((item) => renderEntityCard(item, 'Method', 'info'))
          )}
        </div>
      )}

      {/* Tab: Datasets */}
      {activeTab === 'datasets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {filterTraceableList(datasets).length} of {datasets.length} empirical datasets referenced.
            </div>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>

          {datasets.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No datasets extracted for this paper yet.</p>
            </Card>
          ) : filterTraceableList(datasets).length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No datasets match your search filter.</p>
            </Card>
          ) : (
            filterTraceableList(datasets).map((item) => renderEntityCard(item, 'Dataset', 'success'))
          )}
        </div>
      )}

      {/* Tab: Metrics */}
      {activeTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {filterTraceableList(metrics).length} of {metrics.length} experimental metrics and evaluation standards.
            </div>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter metrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>

          {metrics.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No metrics extracted for this paper yet.</p>
            </Card>
          ) : filterTraceableList(metrics).length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No metrics match your search filter.</p>
            </Card>
          ) : (
            filterTraceableList(metrics).map((item) => renderEntityCard(item, 'Metric', 'default'))
          )}
        </div>
      )}

      {/* Tab: Findings */}
      {activeTab === 'findings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {filterTraceableList(findings).length} of {findings.length} empirical findings and conclusions.
            </div>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>

          {findings.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No findings extracted for this paper yet.</p>
            </Card>
          ) : filterTraceableList(findings).length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No findings match your search filter.</p>
            </Card>
          ) : (
            filterTraceableList(findings).map((item) => renderEntityCard(item, 'Finding', 'success'))
          )}
        </div>
      )}

      {/* Tab: Limitations */}
      {activeTab === 'limitations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {filterTraceableList(limitations).length} of {limitations.length} author-stated limitations.
            </div>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter limitations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>

          {limitations.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No limitations extracted for this paper yet.</p>
            </Card>
          ) : filterTraceableList(limitations).length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No limitations match your search filter.</p>
            </Card>
          ) : (
            filterTraceableList(limitations).map((item) => renderEntityCard(item, 'Limitation', 'danger'))
          )}
        </div>
      )}

      {/* Tab: Future Work */}
      {activeTab === 'future_work' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {filterTraceableList(future_work).length} of {future_work.length} forward-looking research directions.
            </div>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter future work..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>

          {future_work.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No future work statements extracted for this paper yet.</p>
            </Card>
          ) : filterTraceableList(future_work).length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No future work statements match your search filter.</p>
            </Card>
          ) : (
            filterTraceableList(future_work).map((item) => renderEntityCard(item, 'Future Work', 'warning'))
          )}
        </div>
      )}

      {/* Tab: Topics */}
      {activeTab === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            BERTopic models and representations assigned to this research paper.
          </div>

          {topics.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <Tag size={32} style={{ color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
                  No Topic Models Assigned
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '480px' }}>
                  Topic discovery runs across the global paper library. Visit the Topic Models tab to cluster documents and assign topics.
                </p>
                <Link to="/topics">
                  <Button variant="primary" size="sm">
                    Open Topic Models
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {topics.map((top) => (
                <Card key={top.id} style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                      Topic #{top.topic_index}: {top.name}
                    </div>
                    <Badge variant="info">{Math.round(top.relevance * 100)}% Match</Badge>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Top Semantic Keywords:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {Array.isArray(top.representation) ? (
                      top.representation.map((rep: any, rIdx: number) => {
                        const word = typeof rep === 'string' ? rep : rep.word || rep[0];
                        return (
                          <span
                            key={rIdx}
                            style={{
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: '#c7d2fe',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                          >
                            {word}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{top.name}</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Graph Relationships */}
      {activeTab === 'graph' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Knowledge graph relationships rooted at this paper ({graph_relationships.length} relationships mapped).
          </div>

          {graph_relationships.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No graph edges linked yet.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {graph_relationships.map((rel) => (
                <Card
                  key={rel.id}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.6rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                    >
                      {paper.title.slice(0, 32)}…
                    </span>

                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                      }}
                    >
                      —[{rel.relationship_type}]→
                    </span>

                    <span
                      style={{
                        padding: '0.25rem 0.6rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#34d399',
                        fontWeight: 600,
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {rel.target_title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Badge variant="outline">{rel.target_type}</Badge>
                    <Badge variant="success">{Math.round(rel.confidence * 100)}% conf</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Evidence Inspector Modal */}
      {inspectedEntity && (
        <Modal
          isOpen={true}
          onClose={() => setInspectedEntity(null)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={18} style={{ color: '#818cf8' }} />
              <span>Evidence Traceability Inspector</span>
            </div>
          }
          maxWidth="700px"
          footer={
            <Button variant="primary" size="sm" onClick={() => setInspectedEntity(null)}>
              Close Inspector
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Epistemic Alert */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.8rem',
                color: '#fbbf24',
              }}
            >
              <strong>Scientific Evidence Guarantee:</strong> This inspection panel presents the verbatim source context directly from the PDF layout tree to verify model extraction truthfulness.
            </div>

            {/* 4-Point Traceability Table */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>PAPER</span>
                <strong style={{ color: '#ffffff' }}>{inspectedEntity.paper_title}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>PAGE NUMBER</span>
                <strong style={{ color: '#38bdf8' }}>Page {inspectedEntity.page_number}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>SECTION HEADING</span>
                <strong style={{ color: '#ffffff' }}>{inspectedEntity.section_heading}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>SECTION TYPE</span>
                <Badge variant="info">{inspectedEntity.section_type}</Badge>
              </div>
              {inspectedEntity.source_reference && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>PROVENANCE REFERENCE</span>
                  <code style={{ color: '#a5b4fc' }}>{inspectedEntity.source_reference}</code>
                </div>
              )}
            </div>

            {/* Verbatim Published Extract */}
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#f59e0b',
                  marginBottom: '0.4rem',
                }}
              >
                1. Verbatim Published Text (Original PDF Extraction)
              </div>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderLeft: '4px solid #f59e0b',
                  borderRadius: '0 0.375rem 0.375rem 0',
                  fontSize: '0.95rem',
                  color: '#ffffff',
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                  lineHeight: 1.6,
                }}
              >
                "{inspectedEntity.text}"
              </div>
            </div>

            {/* Surrounding Context in Document Section */}
            {inspectedEntity.surrounding_text && (
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.4rem',
                  }}
                >
                  2. Surrounding Context in Section
                </div>
                <div
                  style={{
                    padding: '0.85rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    color: '#94a3b8',
                    lineHeight: 1.6,
                  }}
                >
                  {inspectedEntity.surrounding_text}
                </div>
              </div>
            )}

            {/* AI Canonical Interpretation Details */}
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#818cf8',
                  marginBottom: '0.4rem',
                }}
              >
                3. AI Inferred Canonical Form & Resolution
              </div>
              <div
                style={{
                  padding: '0.85rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  borderLeft: '4px solid #6366f1',
                  borderRadius: '0 0.375rem 0.375rem 0',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Canonical Label:</span>
                  <strong style={{ color: '#c7d2fe' }}>{inspectedEntity.normalized_name || inspectedEntity.text}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Extraction Confidence:</span>
                  <strong style={{ color: '#34d399' }}>{Math.round(inspectedEntity.confidence * 100)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Entity Category:</span>
                  <strong style={{ color: '#ffffff', textTransform: 'capitalize' }}>
                    {inspectedEntity.entity_type.replace('_', ' ')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Entity Resolution Audit Matches */}
            {auditTrail.filter((a) => a.original_text === inspectedEntity.text || a.canonical_entity === inspectedEntity.normalized_name).length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#34d399',
                    marginBottom: '0.4rem',
                  }}
                >
                  4. Entity Resolution Audit Trail
                </div>
                {auditTrail
                  .filter((a) => a.original_text === inspectedEntity.text || a.canonical_entity === inspectedEntity.normalized_name)
                  .map((audit) => (
                    <div
                      key={audit.id}
                      style={{
                        padding: '0.6rem 0.75rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.06)',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span>Method: <strong>{audit.resolution_method}</strong></span>
                        <Badge variant="success">{(audit.confidence * 100).toFixed(0)}% match</Badge>
                      </div>
                      {audit.rationale && <div style={{ color: 'var(--text-secondary)' }}><em>{audit.rationale}</em></div>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
