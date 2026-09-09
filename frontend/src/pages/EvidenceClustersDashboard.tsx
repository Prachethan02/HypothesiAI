import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { apiService } from '../services/api';
import type {
  EvidenceClusterRun,
  EvidenceClusterWithStatements,
} from '../services/api';


// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATEMENT_TYPE_COLORS: Record<string, string> = {
  limitation: '#f59e0b',
  future_work: '#6366f1',
  problem: '#ec4899',
  unknown: '#6b7280',
};

const statementTypeLabel = (t: string) =>
  t === 'future_work' ? 'Future Work' : t.charAt(0).toUpperCase() + t.slice(1);

// ─── Sub‑components ──────────────────────────────────────────────────────────

interface ClusterCardProps {
  cluster: EvidenceClusterWithStatements;
  isExpanded: boolean;
  onToggle: () => void;
}

const ClusterCard: React.FC<ClusterCardProps> = ({ cluster, isExpanded, onToggle }) => {
  const color = STATEMENT_TYPE_COLORS[cluster.statement_type] ?? '#6b7280';

  return (
    <div
      style={{
        border: `1px solid ${cluster.is_noise ? '#374151' : 'var(--border-color)'}`,
        borderRadius: '0.75rem',
        backgroundColor: cluster.is_noise ? 'rgba(17,24,39,0.5)' : 'var(--bg-secondary)',
        padding: '1.25rem',
        opacity: cluster.is_noise ? 0.75 : 1,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            {/* Statement type badge */}
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: color + '22',
                color,
                border: `1px solid ${color}44`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {statementTypeLabel(cluster.statement_type)}
            </span>

            {cluster.is_noise && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(75,85,99,0.2)',
                  color: '#9ca3af',
                  border: '1px solid rgba(75,85,99,0.4)',
                }}
              >
                NOISE / OUTLIERS
              </span>
            )}

            {/* Signal kind */}
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              evidence signal
            </span>
          </div>

          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
            {cluster.name}
          </h3>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {cluster.size} statement{cluster.size !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {cluster.paper_count} paper{cluster.paper_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p
        style={{
          margin: '0.75rem 0 0',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        {cluster.summary}
      </p>

      {/* Representative statements preview */}
      {cluster.representative_statements.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            Representative Statements
          </div>
          {cluster.representative_statements.slice(0, 2).map((s, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                padding: '0.4rem 0.6rem',
                borderLeft: `2px solid ${color}`,
                backgroundColor: color + '0d',
                borderRadius: '0 0.25rem 0.25rem 0',
                marginBottom: '0.3rem',
                lineHeight: 1.5,
              }}
            >
              {s.length > 200 ? s.slice(0, 200) + '…' : s}
            </div>
          ))}
        </div>
      )}

      {/* Expand toggle */}
      {(cluster.statements?.length ?? 0) > 0 && (
        <button
          onClick={onToggle}
          style={{
            marginTop: '0.75rem',
            fontSize: '0.78rem',
            color: '#6366f1',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {isExpanded ? '▲ Hide' : '▼ Show'} all {cluster.statements!.length} source statements
        </button>
      )}

      {/* Expanded statements */}
      {isExpanded && cluster.statements && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {cluster.statements.map((stmt) => (
            <div
              key={stmt.id}
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(99,102,241,0.05)',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: stmt.is_representative ? '#818cf8' : 'var(--text-muted)' }}>
                  {stmt.is_representative ? '★ Representative' : 'Member'}
                </span>
                {stmt.paper_title && (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {stmt.paper_title.length > 60 ? stmt.paper_title.slice(0, 60) + '…' : stmt.paper_title}
                  </span>
                )}
              </div>
              {stmt.text}
              {stmt.similarity_to_centroid !== null && stmt.similarity_to_centroid !== undefined && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Similarity to centroid: {(stmt.similarity_to_centroid * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const EvidenceClustersDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<EvidenceClusterRun | null>(null);
  const [clusters, setClusters] = useState<EvidenceClusterWithStatements[]>([]);
  const [noiseCount, setNoiseCount] = useState(0);
  const [totalClustered, setTotalClustered] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showNoise, setShowNoise] = useState(false);
  const [minClusterSize, setMinClusterSize] = useState(3);
  const [filterType, setFilterType] = useState<string>('all');
  const [justRan, setJustRan] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.listEvidenceClusters(undefined, true);
      if (res.success && res.data.run) {
        setRun(res.data.run);
        setClusters(res.data.clusters ?? []);
        setTotalClustered(res.data.total_clustered ?? 0);
        setNoiseCount(res.data.noise_count ?? 0);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load clusters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    setJustRan(false);
    setError(null);
    try {
      await apiService.runEvidenceClustering({
        min_cluster_size: minClusterSize,
        include_noise: true,
      });
      await load();
      setJustRan(true);
    } catch (e: any) {
      setError(e.message ?? 'Clustering failed.');
    } finally {
      setRunning(false);
    }
  };


  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter clusters for display
  const displayClusters = clusters.filter(c => {
    if (!showNoise && c.is_noise) return false;
    if (filterType !== 'all' && c.statement_type !== filterType) return false;
    return true;
  });

  // Bar chart data (non-noise clusters only, top 15 by size)
  const chartData = clusters
    .filter(c => !c.is_noise)
    .sort((a, b) => b.size - a.size)
    .slice(0, 15)
    .map(c => ({
      name: c.name.length > 28 ? c.name.slice(0, 28) + '…' : c.name,
      size: c.size,
      papers: c.paper_count,
      type: c.statement_type,
    }));

  const statTypes = Array.from(new Set(clusters.filter(c => !c.is_noise).map(c => c.statement_type)));

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Evidence Clusters
            </h1>
            <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '680px' }}>
              Semantic clusters of limitation, future‑work, and unresolved research‑problem statements,
              grouped by HDBSCAN. These clusters are <strong>evidence signals</strong> derived from
              source papers — they are not automatically research gaps.
            </p>
          </div>

          {/* Workflow progression CTA */}
          {(run || clusters.length > 0) && (
            <button
              onClick={() => navigate('/research-gaps')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                backgroundColor: '#4f46e5',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79,70,229,0.4)',
                flexShrink: 0,
              }}
              title="Proceed to Research Gap Analysis"
            >
              ✦ Proceed to Research Gaps →
            </button>
          )}
        </div>

        {/* Workflow step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600 }}>Step 1: Evidence Clusters ✓</span>
          <span>→</span>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 500 }}>Step 2: Research Gaps</span>
          <span>→</span>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 500 }}>Step 3: Hypotheses</span>
        </div>

        {/* Post-run success banner */}
        {justRan && clusters.length > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '0.5rem',
            color: '#34d399',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <span>✓ Clustering complete — {clusters.filter(c => !c.is_noise).length} evidence clusters generated from your papers.</span>
            <button
              onClick={() => navigate('/research-gaps')}
              style={{
                padding: '0.4rem 1rem',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Analyze Research Gaps →
            </button>
          </div>
        )}
      </div>


      {/* Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-end',
          marginBottom: '1.5rem',
          padding: '1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Min Cluster Size
          </label>
          <input
            type="number"
            min={2}
            max={50}
            value={minClusterSize}
            onChange={e => setMinClusterSize(Number(e.target.value))}
            style={{
              width: '90px',
              padding: '0.4rem 0.6rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          style={{
            padding: '0.55rem 1.4rem',
            borderRadius: '0.5rem',
            backgroundColor: running ? '#374151' : '#6366f1',
            color: '#fff',
            border: 'none',
            cursor: running ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          {running ? 'Clustering…' : 'Run Clustering'}
        </button>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {run && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Last run: {new Date(run.created_at).toLocaleString()}&nbsp;·&nbsp;
            {run.status}&nbsp;·&nbsp;
            {run.cluster_count ?? 0} cluster{(run.cluster_count ?? 0) !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Summary bar */}
      {run && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {[
            { label: 'Evidence Clusters', value: run.cluster_count ?? 0 },
            { label: 'Statements Clustered', value: totalClustered },
            { label: 'Source Papers', value: Array.from(new Set(clusters.flatMap(c => c.paper_ids))).length },
            { label: 'Noise Statements', value: noiseCount },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                flex: '1 1 120px',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart – cluster size distribution */}
      {chartData.length > 0 && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Cluster Size Distribution
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 16, bottom: 60, left: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', fontSize: '0.78rem' }}
                formatter={(val: any, name: any) => [val, name === 'size' ? 'Statements' : 'Papers']}
              />
              <Bar dataKey="size" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={STATEMENT_TYPE_COLORS[entry.type] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(STATEMENT_TYPE_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, display: 'inline-block' }} />
                {statementTypeLabel(type)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      {clusters.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Filter:</span>
          {['all', ...statTypes].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                border: `1px solid ${filterType === t ? '#6366f1' : 'var(--border-color)'}`,
                backgroundColor: filterType === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: filterType === t ? '#818cf8' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {t === 'all' ? 'All Types' : statementTypeLabel(t)}
            </button>
          ))}
          <button
            onClick={() => setShowNoise(v => !v)}
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              border: `1px solid ${showNoise ? '#f59e0b' : 'var(--border-color)'}`,
              backgroundColor: showNoise ? 'rgba(245,158,11,0.1)' : 'transparent',
              color: showNoise ? '#fbbf24' : 'var(--text-muted)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            {showNoise ? 'Hide Noise' : 'Show Noise'}
          </button>
        </div>
      )}

      {/* Cluster cards */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
          Loading clusters…
        </div>
      ) : displayClusters.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-color)',
            borderRadius: '0.75rem',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            No clusters yet
          </div>
          <div style={{ fontSize: '0.875rem' }}>
            Upload and process papers, then click <strong>Run Clustering</strong> to group
            limitations, future‑work statements, and research problems by semantic similarity.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayClusters.map(cluster => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              isExpanded={expandedIds.has(cluster.id)}
              onToggle={() => toggleExpand(cluster.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EvidenceClustersDashboard;
