import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Cpu,
  GitMerge,
} from 'lucide-react';
import { apiService, Paper, PaperSection, ExtractedEntity, ResolutionDecision } from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  LoadingState,
  EmptyState,
} from '../components/ui';

export const PaperDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [auditTrail, setAuditTrail] = useState<ResolutionDecision[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [embedding, setEmbedding] = useState<boolean>(false);
  const [resolving, setResolving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'entities' | 'resolution'>('sections');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPaperData = async (paperId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [paperData, sectionsData, entitiesData, auditData] = await Promise.all([
        apiService.getPaperById(paperId),
        apiService.getPaperSections(paperId),
        apiService.getPaperEntities(paperId),
        apiService.getResolutionAudit(paperId),
      ]);
      setPaper(paperData);
      setSections(sectionsData);
      setEntities(entitiesData);
      setAuditTrail(auditData);
    } catch (err) {
      console.warn('Failed to load paper details', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadPaperData(id);
    }
  }, [id]);

  // Polling if paper is still processing
  useEffect(() => {
    if (id && paper && (paper.status === 'uploaded' || paper.status === 'processing')) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          loadPaperData(id, true);
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
  }, [id, paper]);

  const handleExtractEntities = async () => {
    if (!id) return;
    setExtracting(true);
    try {
      const extracted = await apiService.triggerPaperExtraction(id);
      setEntities(extracted);
      setActiveTab('entities');
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
      await loadPaperData(id, true);
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
      await loadPaperData(id, true);
      setActiveTab('resolution');
    } catch (err) {
      console.error('Failed to normalize entities', err);
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading paper metadata, sections & entities..." />;
  }

  if (!paper) {
    return (
      <EmptyState
        icon={<FileText size={36} />}
        title="Research Paper Not Found"
        description={`No ingested paper matches ID: ${id}. It may have been removed or has not yet been processed.`}
        action={
          <Link to="/papers">
            <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
              Back to Paper Library
            </Button>
          </Link>
        }
      />
    );
  }

  const filteredEntities = entityFilter === 'all'
    ? entities
    : entities.filter((e) => e.entity_type === entityFilter);

  const entityTypeCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
    return acc;
  }, {});

  const getEntityTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'method':
        return 'info';
      case 'dataset':
        return 'success';
      case 'metric':
        return 'default';
      case 'limitation':
        return 'danger';
      case 'future_work':
        return 'warning';
      case 'finding':
        return 'success';
      case 'objective':
        return 'info';
      case 'population_domain':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Back Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/papers">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
              Back to Library
            </Button>
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paper Details</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {sections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles size={14} />}
              onClick={handleExtractEntities}
              isLoading={extracting}
            >
              {entities.length > 0 ? 'Re-extract Information' : 'Extract Information'}
            </Button>
          )}
          {entities.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Cpu size={14} />}
              onClick={handleGenerateEmbeddings}
              isLoading={embedding}
            >
              Generate Embeddings
            </Button>
          )}
          {entities.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<GitMerge size={14} />}
              onClick={handleNormalizeEntities}
              isLoading={resolving}
            >
              Normalize Entities
            </Button>
          )}
          {id && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => loadPaperData(id, false)}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Processing Banner */}
      {paper.status === 'processing' && (
        <Card style={{ padding: '1rem 1.25rem', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#a5b4fc' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>PyMuPDF Extraction & NLP Pipeline in Progress</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                The AI service is parsing structural sections and running structured information extraction. This page updates automatically.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Failure Banner */}
      {paper.status === 'failed' && (
        <Card style={{ padding: '1rem 1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
            <AlertTriangle size={18} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Parsing Pipeline Failed</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {paper.error_message || 'An unexpected error occurred during PDF parsing. Please check the file validity.'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Paper Header Card */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Badge variant="info">Scientific Literature</Badge>
              <Badge variant={paper.status === 'parsed' || paper.status === 'indexed' ? 'success' : paper.status === 'failed' ? 'danger' : 'warning'}>
                {paper.status}
              </Badge>
              {paper.total_pages && (
                <Badge variant="outline">{paper.total_pages} {paper.total_pages === 1 ? 'Page' : 'Pages'}</Badge>
              )}
              {entities.length > 0 && (
                <Badge variant="success">{entities.length} Extracted Entities</Badge>
              )}
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3, marginBottom: '0.75rem' }}>
              {paper.title}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {paper.publication_year && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} />
                  <span>Year: {paper.publication_year}</span>
                </div>
              )}
              {paper.venue && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BookOpen size={14} />
                  <span>Venue: {paper.venue}</span>
                </div>
              )}
              {paper.doi && (
                <div>
                  <span>DOI: </span>
                  <code style={{ color: '#818cf8' }}>{paper.doi}</code>
                </div>
              )}
              {paper.file_size_bytes ? (
                <div>
                  <span>Size: {(paper.file_size_bytes / 1024).toFixed(0)} KB</span>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {paper.file_url && (
              <a href={paper.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                  View Raw PDF
                </Button>
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <Button
          variant={activeTab === 'sections' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('sections')}
        >
          Extracted Sections ({sections.length})
        </Button>
        <Button
          variant={activeTab === 'entities' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('entities')}
        >
          Structured Info ({entities.length})
        </Button>
        {auditTrail.length > 0 && (
          <Button
            variant={activeTab === 'resolution' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('resolution')}
          >
            Resolution Audit ({auditTrail.length})
          </Button>
        )}
        <Button
          variant={activeTab === 'overview' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
        >
          Abstract & Overview
        </Button>
      </div>

      {/* Tab Content: Sections */}
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
                  {paper.status === 'processing'
                    ? 'PyMuPDF is processing the PDF pages and classifying sections.'
                    : 'When the Python AI service finishes parsing, sections (Introduction, Methods, Limitations, etc.) will appear here with page numbers.'}
                </p>
              </div>
            </Card>
          ) : (
            sections.map((sec) => (
              <Card key={sec.id}>
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
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {sec.content}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Entities & Structured Claims (Stage 6) */}
      {activeTab === 'entities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Category Filter Pills & Embed Action */}
          {entities.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setEntityFilter('all')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    backgroundColor: entityFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: entityFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  All ({entities.length})
                </button>
                {Object.entries(entityTypeCounts).map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setEntityFilter(type)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: entityFilter === type ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: entityFilter === type ? '#ffffff' : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type.replace('_', ' ')} ({count})
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Cpu size={14} />}
                onClick={handleGenerateEmbeddings}
                isLoading={embedding}
              >
                Embed with MiniLM
              </Button>
            </div>
          )}

          {entities.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={32} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
                  No Structured Entities Extracted Yet
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '500px' }}>
                  Extract research methods, datasets, metrics, findings, limitations, future work, and research objectives using the Stage 6 extraction engine with provenance attribution.
                </p>
                {sections.length > 0 ? (
                  <Button
                    variant="primary"
                    leftIcon={<Sparkles size={16} />}
                    onClick={handleExtractEntities}
                    isLoading={extracting}
                  >
                    Run Information Extraction
                  </Button>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Wait for paper section parsing to complete before extracting entities.
                  </div>
                )}
              </div>
            </Card>
          ) : filteredEntities.length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No entities match the selected category filter <code>{entityFilter}</code>.
              </p>
            </Card>
          ) : (
            filteredEntities.map((ent) => (
              <Card key={ent.id} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.4 }}>
                      {ent.text}
                    </div>
                    {ent.normalized_name && ent.normalized_name !== ent.text.toLowerCase() && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Canonical form: <code style={{ color: '#818cf8' }}>{ent.normalized_name}</code>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {(ent.embedding_id || ent.metadata?.embedding) && (
                      <Badge variant="outline">
                        <span style={{ color: '#a78bfa', fontSize: '0.75rem' }}>384-dim Vector</span>
                      </Badge>
                    )}
                    <Badge variant={getEntityTypeBadgeVariant(ent.entity_type)}>
                      {ent.entity_type.replace('_', ' ')}
                    </Badge>
                    <Badge variant="success">
                      {Math.round(ent.confidence * 100)}% conf
                    </Badge>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {ent.source_reference ? (
                    <span><strong>Provenance:</strong> {ent.source_reference}</span>
                  ) : (
                    <span>
                      <strong>Section:</strong> {ent.section_id || 'unassigned'}
                      {ent.page_number ? ` • Page ${ent.page_number}` : ''}
                    </span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Resolution Audit (Stage 8) */}
      {activeTab === 'resolution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {auditTrail.length === 0 ? (
            <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <GitMerge size={32} style={{ color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
                  No Entities Normalized Yet
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '500px' }}>
                  Group and canonicalize alias entities such as acronyms and spelling variations into resolved research concepts.
                </p>
                {entities.length > 0 && (
                  <Button
                    variant="primary"
                    leftIcon={<GitMerge size={16} />}
                    onClick={handleNormalizeEntities}
                    isLoading={resolving}
                  >
                    Run Entity Normalization
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            auditTrail.map((audit) => (
              <Card key={audit.id} style={{ padding: '1rem 1.25rem', borderLeft: `3px solid ${audit.decision === 'merged' ? '#10b981' : audit.decision === 'rejected' ? '#ef4444' : '#8b5cf6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#ffffff' }}>
                    {audit.decision === 'merged' ? 'Merged Entity Alias' : audit.decision === 'rejected' ? 'Rejected Merge Proposal' : 'New Canonical Entity'}
                  </div>
                  <Badge variant={audit.decision === 'merged' ? 'success' : audit.decision === 'rejected' ? 'danger' : 'default'}>
                    {audit.resolution_method}
                  </Badge>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                  <span style={{ padding: '0.15rem 0.4rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {audit.original_text}
                  </span>
                  {audit.decision === 'merged' ? (
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>vs</span>
                  )}
                  <span style={{ padding: '0.15rem 0.4rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontWeight: 600 }}>
                    {audit.canonical_entity}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Similarity: <strong>{audit.similarity_score.toFixed(2)}</strong></span>
                  <span>Confidence: <strong>{(audit.confidence * 100).toFixed(1)}%</strong></span>
                  {audit.rationale && <span>Reason: <em>{audit.rationale}</em></span>}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Abstract</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {paper.abstract ||
                sections.find((s) => s.section_type === 'abstract')?.content ||
                'Abstract will be extracted automatically from structural section boundaries.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
