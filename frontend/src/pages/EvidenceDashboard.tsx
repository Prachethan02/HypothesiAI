import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import type {
  EvidenceItem,
  ScoringWeightsConfig,
} from '../services/api';

const SIGNAL_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  limitation_clusters: { label: 'Limitation Cluster', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  recurring_limitations: { label: 'Recurring Limitation', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  future_work_frequency: { label: 'Future Work', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  underexplored_method_dataset: { label: 'Underexplored Pattern', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  contradiction_evidence: { label: 'NLI Contradiction', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  kg_structural_gaps: { label: 'KG Structural Gap', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  disconnected_research_areas: { label: 'Disconnected Area', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' },
  topic_trends: { label: 'Topic Trend', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  temporal_decline_stagnation: { label: 'Temporal Stagnation', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  independent_paper_support: { label: 'Multi-Paper Support', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
};

export const EvidenceDashboard: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [aggregating, setAggregating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [showWeightsConfig, setShowWeightsConfig] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Configurable scoring weights
  const [weights, setWeights] = useState<ScoringWeightsConfig>({
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
  });

  const [minScore, setMinScore] = useState(0.20);
  const minPaperSupport = 1;

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.listAggregatedEvidence({ min_score: minScore });
      if (res.success) {
        setEvidenceList(res.data);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load evidence items.');
    } finally {
      setLoading(false);
    }
  }, [minScore]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const handleRunAggregation = async () => {
    setAggregating(true);
    setError(null);
    try {
      const res = await apiService.runEvidenceAggregation({
        weights,
        min_score: minScore,
        min_paper_support: minPaperSupport,
      });
      if (res.success) {
        setEvidenceList(res.data.evidence);
      }
    } catch (e: any) {
      setError(e.message ?? 'Aggregation failed.');
    } finally {
      setAggregating(false);
    }
  };

  const handleWeightChange = (key: keyof ScoringWeightsConfig, val: number) => {
    setWeights((prev) => ({ ...prev, [key]: val }));
  };

  const resetWeights = () => {
    setWeights({
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
    });
  };

  const filteredEvidence = evidenceList.filter((item) => {
    if (activeTab === 'ALL') return true;
    return item.type === activeTab;
  });

  const distinctTypes = Array.from(new Set(evidenceList.map((e) => e.type)));
  const totalEvidenceCount = evidenceList.length;
  const avgScore =
    totalEvidenceCount > 0
      ? (evidenceList.reduce((acc, curr) => acc + curr.score, 0) / totalEvidenceCount) * 100
      : 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.65rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Unified Evidence Aggregator
          </h1>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            Stage 14 Multi-Signal
          </span>
        </div>
        <p
          style={{
            marginTop: '0.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            maxWidth: '820px',
            lineHeight: 1.5,
          }}
        >
          Aggregates analytical signals from HDBSCAN clusters, FP-Growth patterns, NLI
          contradictions, knowledge graph structures, and paper consensus into candidate
          research-gap evidence with configurable weights.
        </p>
      </div>

      {/* Strict Boundary Guardrail Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.85rem 1.15rem',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: '#a5b4fc',
          lineHeight: 1.45,
        }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🛡️</span>
        <div>
          <strong>Evidence Signal Boundary:</strong> This engine outputs structured candidate
          evidence. It does <em>not</em> generate hypotheses or invent arbitrary scientific claims.
          All scores and provenances are calculated directly from empirical corpus signals.
        </div>
      </div>

      {/* Controls & Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          padding: '1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRunAggregation}
            disabled={aggregating}
            style={{
              padding: '0.6rem 1.4rem',
              borderRadius: '0.5rem',
              backgroundColor: aggregating ? '#374151' : '#6366f1',
              color: '#ffffff',
              border: 'none',
              cursor: aggregating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {aggregating ? 'Aggregating Signals…' : 'Run Evidence Aggregation'}
          </button>

          <button
            onClick={() => setShowWeightsConfig((prev) => !prev)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: showWeightsConfig ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: showWeightsConfig ? '#818cf8' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            ⚙️ {showWeightsConfig ? 'Hide Scoring Weights' : 'Configure Weights'}
          </button>

          <button
            onClick={loadEvidence}
            disabled={loading}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Min Score Cutoff: {(minScore * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min={0.05}
            max={0.6}
            step={0.05}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ width: '120px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Configurable Weights Drawer */}
      {showWeightsConfig && (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Configurable Scoring Weights (Multi-Signal Balance)
            </h3>
            <button
              onClick={resetWeights}
              style={{
                fontSize: '0.75rem',
                color: '#818cf8',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reset to Recommended
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {Object.entries(weights).map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span style={{ fontWeight: 700, color: '#818cf8' }}>
                    {((val || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={0.4}
                  step={0.01}
                  value={val || 0}
                  onChange={(e) =>
                    handleWeightChange(key as keyof ScoringWeightsConfig, Number(e.target.value))
                  }
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Aggregate Metric Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.625rem',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {totalEvidenceCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Candidate Evidence Items
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.625rem',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#818cf8' }}>
            {distinctTypes.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Signal Modalities Present
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.625rem',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>
            {avgScore.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Average Evidence Score
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '0.4rem 0.9rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: activeTab === 'ALL' ? 600 : 400,
            backgroundColor: activeTab === 'ALL' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
            color: activeTab === 'ALL' ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          All Signals ({totalEvidenceCount})
        </button>

        {distinctTypes.map((type) => {
          const typeMeta = SIGNAL_TYPE_LABELS[type] || { label: type, color: '#9ca3af', bg: 'rgba(255,255,255,0.1)' };
          const count = evidenceList.filter((e) => e.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: activeTab === type ? 600 : 400,
                backgroundColor: activeTab === type ? typeMeta.bg : 'transparent',
                color: activeTab === type ? typeMeta.color : 'var(--text-muted)',
              }}
            >
              {typeMeta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Evidence Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading candidate evidence items…
        </div>
      ) : filteredEvidence.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px dashed var(--border-color)',
            borderRadius: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>📑</div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-secondary)' }}>
            No candidate evidence items found
          </div>
          <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
            Click <strong>Run Evidence Aggregation</strong> to synthesize signals across papers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredEvidence.map((item) => {
            const meta = SIGNAL_TYPE_LABELS[item.type] || {
              label: item.type,
              color: '#818cf8',
              bg: 'rgba(99, 102, 241, 0.15)',
            };
            const isExpanded = expandedId === item.evidence_id;

            return (
              <div
                key={item.evidence_id}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '4px',
                          backgroundColor: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.color}44`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {meta.label}
                      </span>

                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Confidence: {(item.confidence * 100).toFixed(0)}% · Papers:{' '}
                        {item.source_papers.length}
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {item.title}
                    </h3>

                    <p
                      style={{
                        margin: '0.5rem 0 0',
                        fontSize: '0.84rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* Score Gauge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: meta.color }}>
                      {(item.score * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>evidence score</div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.evidence_id)}
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#818cf8',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {isExpanded ? '▲ Hide Provenance' : '▼ Inspect Evidence'}
                    </button>
                  </div>
                </div>

                {/* Expanded Provenance Details */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '1rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Verbatim Statements */}
                    {item.source_statements.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            marginBottom: '0.35rem',
                          }}
                        >
                          Verbatim Corpus Statements
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {item.source_statements.map((stmt, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-secondary)',
                                padding: '0.4rem 0.6rem',
                                backgroundColor: 'var(--bg-primary)',
                                borderRadius: '0.375rem',
                                borderLeft: `3px solid ${meta.color}`,
                                fontStyle: 'italic',
                              }}
                            >
                              "{stmt}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Papers & Pages */}
                    {item.source_papers.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            marginBottom: '0.35rem',
                          }}
                        >
                          Supporting Source Papers
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {item.source_papers.map((p, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-primary)',
                                backgroundColor: 'var(--bg-primary)',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              📄 {p.title}
                            </span>
                          ))}
                          {item.source_pages.length > 0 && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                padding: '0.2rem 0.5rem',
                              }}
                            >
                              Pages: {item.source_pages.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {evidenceList.length > 0 && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1.25rem 1.5rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Step 14 Complete — Multi-Signal Evidence Aggregated
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {evidenceList.length} candidate evidence items synthesized. Proceed to synthesize and rank research gaps with RGQS.
            </div>
          </div>
          <Link
            to="/research-gaps"
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ✦ Proceed to Research Gaps →
          </Link>
        </div>
      )}
    </div>
  );
};

export default EvidenceDashboard;
