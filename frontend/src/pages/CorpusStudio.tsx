import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  Folders,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  ArrowRight,
  Database,
  Search,
  Zap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { apiService, Corpus, Paper, BatchUploadResult, CorpusAnalysisStatus } from '../services/api';
import {
  Button,
  Card,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  LoadingState,
  ProgressIndicator,
} from '../components/ui';

export const CorpusStudio: React.FC = () => {
  const { id: routeCorpusId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Corpora State
  const [corpora, setCorpora] = useState<Corpus[]>([]);
  const [activeCorpus, setActiveCorpus] = useState<Corpus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingPapers, setLoadingPapers] = useState<boolean>(false);
  const [corpusPapers, setCorpusPapers] = useState<Paper[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Create Corpus Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newCorpusName, setNewCorpusName] = useState<string>('');
  const [newCorpusDesc, setNewCorpusDesc] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  // Delete Active Corpus Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteAssociatedPapers, setDeleteAssociatedPapers] = useState<boolean>(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Purge Whole Corpus Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState<boolean>(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState<string>('');
  const [purging, setPurging] = useState<boolean>(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  // Pre-Upload Staging State (10 to 50 PDFs)
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload Progress & Resilient Results State
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<BatchUploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Polling ref
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Analysis Orchestration State
  const [analysisStatus, setAnalysisStatus] = useState<CorpusAnalysisStatus | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load Corpora List ───────────────────────────────────────────────────────
  const fetchCorpora = useCallback(async (selectId?: string) => {
    try {
      setLoading(true);
      const list = await apiService.listCorpora();
      setCorpora(list);

      if (list.length > 0) {
        // Pick requested corpus, or route corpus, or first available
        const targetId = selectId || routeCorpusId;
        const matched = list.find((c) => c.id === targetId) || list[0];
        setActiveCorpus(matched);
      } else {
        setActiveCorpus(null);
        setCorpusPapers([]);
      }
    } catch (err: any) {
      console.warn('Failed to load corpora list', err);
    } finally {
      setLoading(false);
    }
  }, [routeCorpusId]);

  // ── Load Active Corpus Papers ───────────────────────────────────────────────
  const fetchActiveCorpusPapers = useCallback(async (corpusId: string, silent = false) => {
    if (!silent) setLoadingPapers(true);
    try {
      const details = await apiService.getCorpusById(corpusId);
      if (details) {
        setActiveCorpus(details);
        setCorpusPapers(details.papers || []);
      }
    } catch (err: any) {
      console.warn(`Failed to load details for corpus ${corpusId}`, err);
    } finally {
      if (!silent) setLoadingPapers(false);
    }
  }, []);

  useEffect(() => {
    fetchCorpora();
  }, [fetchCorpora]);

  useEffect(() => {
    if (activeCorpus?.id) {
      fetchActiveCorpusPapers(activeCorpus.id);
    }
  }, [activeCorpus?.id, fetchActiveCorpusPapers]);

  // ── Polling when papers are processing ──────────────────────────────────────
  useEffect(() => {
    const hasPending = corpusPapers.some(
      (p) => p.status === 'uploaded' || p.status === 'processing'
    );

    if (hasPending && activeCorpus?.id) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchActiveCorpusPapers(activeCorpus.id, true);
        }, 3500);
      }
    } else if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [corpusPapers, activeCorpus?.id, fetchActiveCorpusPapers]);

  // ── Create Corpus Handler ───────────────────────────────────────────────────
  const handleCreateCorpus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCorpusName.trim()) {
      setCreateError('Corpus name is required');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiService.createCorpus(newCorpusName.trim(), newCorpusDesc.trim() || undefined);
      setCorpora((prev) => [created, ...prev]);
      setActiveCorpus(created);
      setCorpusPapers([]);
      setIsCreateModalOpen(false);
      setNewCorpusName('');
      setNewCorpusDesc('');
      navigate(`/corpus/${created.id}`);
    } catch (err: any) {
      setCreateError(err.response?.data?.error?.message || err.message || 'Failed to create corpus');
    } finally {
      setCreating(false);
    }
  };

  // ── Staging Files Handlers ──────────────────────────────────────────────────
  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const pdfs: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        pdfs.push(f);
      }
    }

    if (pdfs.length === 0) {
      setUploadError('Only PDF files are supported. Please select .pdf documents.');
      return;
    }

    setUploadError(null);
    setUploadResult(null);

    // Merge into staging, avoiding exact duplicates by name + size
    setStagedFiles((prev) => {
      const map = new Map<string, File>();
      prev.forEach((f) => map.set(`${f.name}-${f.size}`, f));
      pdfs.forEach((f) => map.set(`${f.name}-${f.size}`, f));
      return Array.from(map.values()).slice(0, 50); // Cap at 50 papers max
    });
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearStagedFiles = () => {
    setStagedFiles([]);
    setUploadError(null);
  };

  // ── Upload Batch Papers Handler ─────────────────────────────────────────────
  const handleBatchUpload = async () => {
    if (stagedFiles.length === 0 || !activeCorpus) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadResult(null);

    try {
      const result = await apiService.uploadBatchPapers(
        stagedFiles,
        activeCorpus.id,
        (percent) => setUploadProgress(percent)
      );

      setUploadResult(result);
      // Clear staged files on successful initiation
      setStagedFiles([]);

      // Refresh active corpus papers to show newly uploaded papers
      await fetchActiveCorpusPapers(activeCorpus.id, true);
    } catch (err: any) {
      setUploadError(err.response?.data?.error?.message || err.message || 'Batch upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Remove Paper from Corpus Handler ────────────────────────────────────────
  const handleRemovePaper = async (paperId: string) => {
    if (!activeCorpus) return;
    if (!window.confirm('Remove this paper from the research corpus?')) return;

    try {
      await apiService.removePaperFromCorpus(activeCorpus.id, paperId);
      setCorpusPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch (err: any) {
      alert(`Failed to remove paper: ${err.message}`);
    }
  };

  // ── Delete Active Corpus Handler ────────────────────────────────────────────
  const handleDeleteCorpus = async () => {
    if (!activeCorpus) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiService.deleteCorpus(activeCorpus.id, deleteAssociatedPapers);
      setIsDeleteModalOpen(false);
      await fetchCorpora();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error?.message || err.message || 'Failed to delete corpus');
    } finally {
      setDeleting(false);
    }
  };

  // ── Purge Whole Corpus Handler ──────────────────────────────────────────────
  const handlePurgeWholeCorpus = async () => {
    setPurging(true);
    setPurgeError(null);
    try {
      await apiService.purgeWholeCorpus();
      setIsPurgeModalOpen(false);
      setPurgeConfirmText('');
      await fetchCorpora();
      setCorpusPapers([]);
    } catch (err: any) {
      setPurgeError(err.response?.data?.error?.message || err.message || 'Failed to delete whole corpus');
    } finally {
      setPurging(false);
    }
  };

  // ── Analyze Corpus Handler ──────────────────────────────────────────────────
  const handleAnalyzeCorpus = async () => {
    if (!activeCorpus || analyzing) return;

    const readyCount = corpusPapers.filter(
      (p) => p.status === 'parsed' || p.status === 'indexed'
    ).length;

    if (readyCount === 0) {
      setAnalysisError('No parsed papers in this corpus. Please wait for PDF processing to complete before running analysis.');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStatus(null);

    try {
      await apiService.startCorpusAnalysis(activeCorpus.id);
    } catch (err: any) {
      setAnalyzing(false);
      setAnalysisError(err.response?.data?.error?.message || err.message || 'Failed to start analysis');
      return;
    }

    // Start polling every 3 seconds
    if (analysisPollerRef.current) clearInterval(analysisPollerRef.current);
    analysisPollerRef.current = setInterval(async () => {
      try {
        const status = await apiService.getAnalysisStatus(activeCorpus.id);
        setAnalysisStatus(status);

        if (status.status === 'analyzed' || status.analysis_progress >= 100) {
          clearInterval(analysisPollerRef.current!);
          analysisPollerRef.current = null;
          setAnalyzing(false);
          // Refresh corpus to show updated status
          await fetchActiveCorpusPapers(activeCorpus.id, true);
        } else if (status.status === 'failed') {
          clearInterval(analysisPollerRef.current!);
          analysisPollerRef.current = null;
          setAnalyzing(false);
          setAnalysisError(status.error || 'Analysis failed');
        }
      } catch (pollErr: any) {
        // Silently ignore transient polling errors
        console.warn('Analysis polling error:', pollErr);
      }
    }, 3000);
  };

  // ── Filtered Papers ─────────────────────────────────────────────────────────
  const filteredPapers = corpusPapers.filter((p) =>
    p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.venue?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Status Stats
  const parsedCount = corpusPapers.filter((p) => p.status === 'parsed' || p.status === 'indexed').length;
  const processingCount = corpusPapers.filter((p) => p.status === 'processing' || p.status === 'uploaded').length;
  const failedCount = corpusPapers.filter((p) => p.status === 'failed').length;

  const totalStagedSizeMb = (stagedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1);

  const getStatusBadge = (paper: Paper) => {
    switch (paper.status) {
      case 'indexed':
      case 'parsed':
        return <Badge variant="success">Parsed & Indexed</Badge>;
      case 'processing':
        return (
          <Badge variant="info">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <RefreshCw size={11} style={{ animation: 'spin 1.5s linear infinite' }} />
              Extracting Claims
            </span>
          </Badge>
        );
      case 'failed':
        return (
          <span title={paper.error_message || 'Processing failed'}>
            <Badge variant="danger">Extraction Failed</Badge>
          </span>
        );
      case 'uploaded':
      default:
        return <Badge variant="warning">Uploaded (Queued)</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* ── Top Header & Corpus Switcher ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: '0.375rem', color: '#818cf8', fontSize: '0.75rem', fontWeight: 600 }}>
              Phase A Architecture
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Multi-PDF Ingestion Pipeline</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Folders size={28} style={{ color: '#818cf8' }} />
            Research Corpus Studio
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '800px', marginTop: '0.25rem' }}>
            Curate multi-paper research collections (10 to 50+ scientific PDFs), track section extraction and entity resolution in real time, and establish verified empirical corpora for cross-paper discovery.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {corpora.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="corpus-select" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Active Corpus:
              </label>
              <select
                id="corpus-select"
                value={activeCorpus?.id || ''}
                onChange={(e) => {
                  const selected = corpora.find((c) => c.id === e.target.value);
                  if (selected) {
                    setActiveCorpus(selected);
                    navigate(`/corpus/${selected.id}`);
                  }
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--card-bg, #1a202c)',
                  border: '1px solid var(--border-color, #2d3748)',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  minWidth: '200px',
                }}
              >
                {corpora.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.paper_count || 0} papers)
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => {
              fetchCorpora();
              if (activeCorpus) fetchActiveCorpusPapers(activeCorpus.id);
            }}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            leftIcon={<FolderPlus size={16} />}
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
          >
            New Corpus
          </Button>

          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={() => {
              setPurgeError(null);
              setPurgeConfirmText('');
              setIsPurgeModalOpen(true);
            }}
          >
            Delete Whole Corpus
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading research corpora..." />
      ) : !activeCorpus ? (
        <Card style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <EmptyState
            title="No Research Corpus Found"
            description="Create your first research corpus to begin batch-ingesting 10 to 50+ scientific papers."
            action={
              <Button
                variant="primary"
                leftIcon={<FolderPlus size={16} />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create Research Corpus
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* ── Active Corpus Summary Card ────────────────────────────────────── */}
          <Card style={{ padding: '1.5rem', backgroundColor: 'rgba(26, 32, 44, 0.7)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>
                    {activeCorpus.name}
                  </h2>
                  <Badge variant={activeCorpus.status === 'ready' ? 'success' : 'info'}>
                    {activeCorpus.status.toUpperCase()}
                  </Badge>
                </div>
                {activeCorpus.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    {activeCorpus.description}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Corpus ID: <code style={{ color: '#818cf8' }}>{activeCorpus.id}</code></span>
                  <span>Created: {new Date(activeCorpus.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 size={13} />}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteAssociatedPapers(true);
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    Delete This Corpus
                  </Button>
                </div>
              </div>

              {/* Corpus Metrics Grid */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', minWidth: '110px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Papers</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>{corpusPapers.length}</div>
                </div>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', minWidth: '110px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 500 }}>Parsed & Ready</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{parsedCount}</div>
                </div>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', minWidth: '110px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 500 }}>In Processing</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8' }}>{processingCount}</div>
                </div>

                {failedCount > 0 && (
                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', minWidth: '110px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 500 }}>Failed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{failedCount}</div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* ── Multi-PDF Batch Upload & Pre-Upload Staging ───────────────────── */}
          <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UploadCloud size={18} style={{ color: '#818cf8' }} />
                  Batch Multi-PDF Ingestion
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Ingest 10 to 50 research papers simultaneously into this corpus. Review your staged files below prior to starting ingestion.
                </p>
              </div>
              {stagedFiles.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="ghost" size="sm" onClick={clearStagedFiles} disabled={uploading}>
                    Clear Staging
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<UploadCloud size={14} />}
                    onClick={handleBatchUpload}
                    isLoading={uploading}
                    disabled={uploading}
                  >
                    Upload {stagedFiles.length} {stagedFiles.length === 1 ? 'Paper' : 'Papers'} ({totalStagedSizeMb} MB)
                  </Button>
                </div>
              )}
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? '#6366f1' : 'var(--border-color, #4a5568)'}`,
                borderRadius: '0.5rem',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                backgroundColor: isDragOver ? 'rgba(99, 102, 241, 0.08)' : 'rgba(15, 23, 42, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', marginBottom: '0.75rem' }}>
                <UploadCloud size={28} />
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>
                Click to browse or drag and drop multiple scientific PDFs
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Supported format: PDF • Batch capacity: up to 50 papers • Max file size: 50MB per paper
              </p>
            </div>

            {/* Staging Drawer / Pre-Upload Queue Table */}
            {stagedFiles.length > 0 && (
              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                      Staged for Ingestion
                    </span>
                    <Badge variant="info">{stagedFiles.length} files ({totalStagedSizeMb} MB)</Badge>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Review files and remove any unwanted PDFs before uploading
                  </span>
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.375rem' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead style={{ width: '120px' }}>Size</TableHead>
                        <TableHead style={{ width: '80px', textAlign: 'right' }}>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stagedFiles.map((file, idx) => (
                        <TableRow key={`${file.name}-${file.size}-${idx}`}>
                          <TableCell style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                            <FileText size={15} style={{ color: '#818cf8', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                              {file.name}
                            </span>
                          </TableCell>
                          <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </TableCell>
                          <TableCell style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStagedFile(idx);
                              }}
                              disabled={uploading}
                              title="Remove from staging"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                padding: '0.25rem',
                              }}
                            >
                              <X size={16} />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Upload In-Progress State */}
            {uploading && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '0.5rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <ProgressIndicator
                  progressPercent={uploadProgress}
                  label={`Uploading batch to ${activeCorpus.name} (${uploadProgress}%)...`}
                />
              </div>
            )}

            {/* Resilient Error / Warning Notice */}
            {uploadError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ flex: 1 }}>
                  <strong>Upload Error:</strong> {uploadError}
                </div>
                <button type="button" onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Resilient Batch Upload Result Summary */}
            {uploadResult && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={18} style={{ color: '#34d399' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                    Batch Ingestion Completed: {uploadResult.summary.succeeded} of {uploadResult.summary.total} papers successfully registered
                  </span>
                </div>

                {uploadResult.errors.length > 0 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.375rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171', marginBottom: '0.35rem' }}>
                      Notice: {uploadResult.errors.length} {uploadResult.errors.length === 1 ? 'file' : 'files'} could not be ingested (valid files were retained):
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#fca5a5' }}>
                      {uploadResult.errors.map((err, i) => (
                        <li key={i}>
                          <code>{err.filename}</code>: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* ── Corpus Papers Table ─────────────────────────────────────────── */}
          <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={18} style={{ color: '#818cf8' }} />
                  Papers in this Corpus ({corpusPapers.length})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Literature records linked to this research corpus. Extraction runs asynchronously in the background.
                </p>
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Search size={15} />
                </div>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter papers by title..."
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                    backgroundColor: 'var(--bg-primary, #0f172a)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.375rem',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                  }}
                />
              </div>
            </div>

            {loadingPapers ? (
              <LoadingState message="Fetching papers for active corpus..." />
            ) : filteredPapers.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <EmptyState
                  title={corpusPapers.length === 0 ? 'No papers in this corpus yet' : 'No matching papers'}
                  description={
                    corpusPapers.length === 0
                      ? 'Upload batch PDFs above to populate this corpus.'
                      : 'Try adjusting your search filter.'
                  }
                />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paper Title</TableHead>
                      <TableHead style={{ width: '130px' }}>File Size</TableHead>
                      <TableHead style={{ width: '180px' }}>Extraction Status</TableHead>
                      <TableHead style={{ width: '140px' }}>Added At</TableHead>
                      <TableHead style={{ width: '160px', textAlign: 'right' }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPapers.map((paper) => (
                      <TableRow key={paper.id}>
                        <TableCell>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <Link
                              to={`/papers/${paper.id}`}
                              style={{
                                color: '#ffffff',
                                fontWeight: 600,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <span style={{ maxWidth: '480px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {paper.title}
                              </span>
                              <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                            </Link>
                            {paper.venue && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {paper.venue} {paper.publication_year ? `(${paper.publication_year})` : ''}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {paper.file_size_bytes
                            ? `${(paper.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                            : '—'}
                        </TableCell>
                        <TableCell>{getStatusBadge(paper)}</TableCell>
                        <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(paper.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Link to={`/papers/${paper.id}`}>
                              <Button variant="ghost" size="sm">
                                View Details
                              </Button>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemovePaper(paper.id)}
                              title="Remove from this corpus"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.35rem',
                                borderRadius: '0.25rem',
                                transition: 'color 0.2s ease',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f87171')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* ── Analyze Corpus Panel ───────────────────────────────────────── */}
          <Card
            style={{
              padding: '1.5rem',
              border: (analyzing || analysisStatus?.status === 'analyzed')
                ? '1px solid rgba(99, 102, 241, 0.4)'
                : '1px solid var(--border-color)',
              backgroundColor: 'rgba(26, 32, 44, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Zap size={18} style={{ color: '#818cf8' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                    Analyze Research Corpus
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '700px' }}>
                  Run the full AI pipeline automatically: topic modeling → evidence clustering → pattern mining → contradiction detection → evidence aggregation → gap ranking.
                  Results will be available in <strong style={{ color: '#a5b4fc' }}>Research Gaps</strong>.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {(analysisStatus?.status === 'analyzed' || activeCorpus?.status === 'analyzed') && (
                  <Link to="/research-gaps">
                    <Button variant="primary" rightIcon={<ArrowRight size={15} />}>
                      View Research Gaps
                    </Button>
                  </Link>
                )}
                <Button
                  variant={analyzing ? 'ghost' : 'secondary'}
                  leftIcon={analyzing ? <RefreshCw size={15} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Zap size={15} />}
                  onClick={handleAnalyzeCorpus}
                  disabled={analyzing || parsedCount === 0}
                  title={parsedCount === 0 ? 'Upload and wait for PDF processing to complete first' : undefined}
                >
                  {analyzing ? 'Analyzing…' : 'Start Analysis'}
                </Button>
              </div>
            </div>

            {/* Analysis Error */}
            {analysisError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ flex: 1 }}>
                  <strong>Analysis Error:</strong> {analysisError}
                </div>
                <button type="button" onClick={() => setAnalysisError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Live Progress Panel */}
            {analyzing && analysisStatus && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '0.5rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                {/* Progress Bar */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={13} />
                      {analysisStatus.current_step || 'Preparing…'}
                    </span>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{analysisStatus.analysis_progress}%</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${analysisStatus.analysis_progress}%`,
                      backgroundColor: '#6366f1',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>

                {/* Completed Steps */}
                {analysisStatus.steps_completed.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {analysisStatus.steps_completed.map((step) => {
                      const failed = step.endsWith(':failed');
                      const label = step.replace(':failed', '').replace(/_/g, ' ');
                      return (
                        <span
                          key={step}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: failed ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)',
                            color: failed ? '#f87171' : '#34d399',
                            border: `1px solid ${failed ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          {failed ? <X size={10} /> : <CheckCircle2 size={10} />}
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Success State (after analysis completes) */}
            {!analyzing && (analysisStatus?.status === 'analyzed' || activeCorpus?.status === 'analyzed') && (
              <div style={{ marginTop: '0.75rem', padding: '0.875rem', backgroundColor: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399', marginBottom: '0.15rem' }}>
                    Analysis Complete
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Research gaps have been identified and ranked. Click "View Research Gaps" to explore findings.
                  </div>
                </div>
                <Link to="/research-gaps">
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight size={14} />}>
                    View Gaps
                  </Button>
                </Link>
              </div>
            )}

            {/* Disabled state hint */}
            {parsedCount === 0 && !analyzing && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={13} />
                Upload and process at least one paper before running analysis.
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Create Corpus Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Research Corpus"
      >
        <form onSubmit={handleCreateCorpus} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Corpus Name *
            </label>
            <input
              type="text"
              required
              value={newCorpusName}
              onChange={(e) => setNewCorpusName(e.target.value)}
              placeholder="e.g. LLM Hallucination & Factuality Benchmarks"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Description / Research Scope
            </label>
            <textarea
              rows={3}
              value={newCorpusDesc}
              onChange={(e) => setNewCorpusDesc(e.target.value)}
              placeholder="Define the target domain, research questions, or boundaries for papers in this corpus..."
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          </div>

          {createError && (
            <div style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={15} />
              <span>{createError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={creating}
              disabled={creating || !newCorpusName.trim()}
            >
              Create Corpus
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Active Corpus Confirmation Modal ──────────────────────── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !deleting && setIsDeleteModalOpen(false)}
        title={`Delete Corpus: ${activeCorpus?.name || 'Corpus'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.875rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.1rem', color: '#f87171' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>
                Are you sure you want to delete this corpus?
              </div>
              <div>
                This will remove the corpus <strong>"{activeCorpus?.name}"</strong> and unlink all associated papers ({corpusPapers.length} papers).
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#ffffff', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={deleteAssociatedPapers}
              onChange={(e) => setDeleteAssociatedPapers(e.target.checked)}
              disabled={deleting}
              style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
            />
            <span>Also permanently delete the {corpusPapers.length} paper(s) and extracted literature signals belonging to this corpus</span>
          </label>

          {deleteError && (
            <div style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={15} />
              <span>{deleteError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={deleting}
              disabled={deleting}
              leftIcon={<Trash2 size={14} />}
              onClick={handleDeleteCorpus}
            >
              Confirm Delete Corpus
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Purge Whole Corpus Confirmation Modal ──────────────────────────── */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => !purging && setIsPurgeModalOpen(false)}
        title="Delete Whole Corpus & Reset Workspace"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.875rem' }}>
            <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '0.1rem', color: '#ef4444' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                High-Impact Action: Complete Corpus Deletion
              </div>
              <p style={{ lineHeight: 1.5, margin: 0 }}>
                This will permanently delete <strong>ALL research corpora, all uploaded papers, extracted entities, knowledge graph triples, evidence clusters, and ranked research gaps</strong> across the entire workspace.
              </p>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              To confirm, type <strong style={{ color: '#ef4444' }}>DELETE</strong> in the box below:
            </label>
            <input
              type="text"
              value={purgeConfirmText}
              onChange={(e) => setPurgeConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              disabled={purging}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                border: `1px solid ${purgeConfirmText === 'DELETE' ? '#ef4444' : 'var(--border-color)'}`,
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {purgeError && (
            <div style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={15} />
              <span>{purgeError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsPurgeModalOpen(false)}
              disabled={purging}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={purging}
              disabled={purging || purgeConfirmText !== 'DELETE'}
              leftIcon={<Trash2 size={14} />}
              onClick={handlePurgeWholeCorpus}
            >
              Delete Whole Corpus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
