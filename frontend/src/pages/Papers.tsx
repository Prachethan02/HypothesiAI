import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, Search, ExternalLink, Calendar, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { apiService, Paper } from '../services/api';
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
  FileUploader,
} from '../components/ui';

export const Papers: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPapers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getPapers();
      setPapers(data);
    } catch (err) {
      console.warn('Failed to load papers', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  // Poll when any paper is in 'uploaded' or 'processing' status
  useEffect(() => {
    const hasPending = papers.some((p) => p.status === 'uploaded' || p.status === 'processing');
    if (hasPending) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchPapers(true);
        }, 3000);
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
  }, [papers]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const newPaper = await apiService.uploadPaper(
        selectedFile,
        customTitle.trim() || undefined,
        (percent) => setUploadProgress(percent),
      );
      setPapers((prev) => [newPaper, ...prev.filter((p) => p.id !== newPaper.id)]);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setCustomTitle('');
      setUploadProgress(0);
    } catch (err: any) {
      console.error('Upload failed', err);
      setUploadError(err.response?.data?.error?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filteredPapers = papers.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.venue?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (paper: Paper) => {
    switch (paper.status) {
      case 'indexed':
      case 'parsed':
        return <Badge variant="success">Parsed</Badge>;
      case 'processing':
        return (
          <Badge variant="info">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <RefreshCw size={10} style={{ animation: 'spin 1.5s linear infinite' }} />
              Processing
            </span>
          </Badge>
        );
      case 'failed':
        return (
          <span title={paper.error_message || 'Processing failed'}>
            <Badge variant="danger">Failed</Badge>
          </span>
        );
      case 'uploaded':
      default:
        return <Badge variant="warning">Uploaded</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Paper Library
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Ingested scientific literature, structural sections, and extracted research claims.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => fetchPapers(false)}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<UploadCloud size={16} />}
            onClick={() => {
              setUploadError(null);
              setIsUploadOpen(true);
            }}
          >
            Upload Research Paper
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }}>
            <Search size={16} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search papers by title, venue, or DOI..."
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.375rem',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''} found
        </div>
      </Card>

      {/* Papers Content */}
      {loading ? (
        <LoadingState message="Loading paper library..." submessage="Fetching metadata and ingestion status" />
      ) : filteredPapers.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No Scientific Papers Ingested Yet"
          description="Upload research papers in PDF format to trigger section parsing, entity extraction, and knowledge graph construction."
          action={
            <Button variant="primary" leftIcon={<UploadCloud size={16} />} onClick={() => setIsUploadOpen(true)}>
              Upload First Research Paper
            </Button>
          }
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paper Title & Venue</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPapers.map((paper) => (
                <TableRow key={paper.id}>
                  <TableCell>
                    <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '0.2rem' }}>
                      {paper.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {paper.venue || 'Venue Pending'} {paper.doi ? `• DOI: ${paper.doi}` : ''}
                      {paper.file_size_bytes ? ` • ${(paper.file_size_bytes / 1024).toFixed(0)} KB` : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      <Calendar size={14} />
                      <span>{paper.publication_year || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(paper)}</TableCell>
                  <TableCell>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {paper.total_pages || '—'}
                    </span>
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Link to={`/papers/${paper.id}`}>
                      <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                        Inspect
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Upload Paper Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!uploading) {
            setIsUploadOpen(false);
            setSelectedFile(null);
            setCustomTitle('');
            setUploadError(null);
          }
        }}
        title="Upload Scientific Literature"
        maxWidth="520px"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setIsUploadOpen(false);
                setSelectedFile(null);
                setCustomTitle('');
                setUploadError(null);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              isLoading={uploading}
              leftIcon={<UploadCloud size={16} />}
            >
              {uploading ? `Uploading (${uploadProgress}%)` : 'Start Ingestion'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Upload peer-reviewed research papers or preprints in PDF format (max 50 MB). PyMuPDF will extract structural sections (Abstract, Introduction, Methods, Limitations, Future Work) with complete page-level provenance.
          </p>

          {uploadError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{uploadError}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Custom Title (Optional)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Defaults to PDF document filename"
              disabled={uploading}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <FileUploader
            onFileSelect={(file) => {
              setSelectedFile(file);
              setUploadError(null);
            }}
            isLoading={uploading}
          />

          {uploading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Uploading to storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary, rgba(255,255,255,0.1))', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
