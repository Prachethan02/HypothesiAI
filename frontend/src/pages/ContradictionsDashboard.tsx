import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type {
  NLIStatementComparison,
} from '../services/api';

type RelationTab = 'ALL' | 'CONTRADICTION' | 'ENTAILMENT' | 'NEUTRAL';

export const ContradictionsDashboard: React.FC = () => {
  const [comparisons, setComparisons] = useState<NLIStatementComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<RelationTab>('CONTRADICTION');
  const [semanticThreshold, setSemanticThreshold] = useState(0.55);
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});

  const loadComparisons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.listContradictions({
        min_confidence: minConfidence,
      });
      if (res.success) {
        setComparisons(res.data);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load contradiction comparisons.');
    } finally {
      setLoading(false);
    }
  }, [minConfidence]);

  useEffect(() => {
    loadComparisons();
  }, [loadComparisons]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await apiService.runContradictionAnalysis({
        semantic_threshold: semanticThreshold,
        min_confidence: minConfidence,
        max_comparisons: 500,
      });
      if (res.success) {
        if (res.data.comparisons.length === 0) {
          setError(
            'Analysis completed, but no cross-paper pairs met the semantic relevance threshold. Ensure at least two papers have extracted findings.'
          );
        }
        await loadComparisons();
      }
    } catch (e: any) {
      setError(e.message ?? 'NLI contradiction analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: 'candidate_signal' | 'confirmed' | 'dismissed'
  ) => {
    setUpdatingId(id);
    try {
      const notes = activeNotes[id];
      const res = await apiService.updateContradictionStatus(id, status, notes);
      if (res.success && res.data) {
        setComparisons((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...res.data! } : c))
        );
      }
    } catch (e: any) {
      setError(`Failed to update status: ${e.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter comparisons based on tab
  const filtered = comparisons.filter((c) => {
    if (tab === 'ALL') return true;
    return c.nli_label === tab;
  });

  const totalCount = comparisons.length;
  const contradictionCount = comparisons.filter((c) => c.nli_label === 'CONTRADICTION').length;
  const entailmentCount = comparisons.filter((c) => c.nli_label === 'ENTAILMENT').length;
  const neutralCount = comparisons.filter((c) => c.nli_label === 'NEUTRAL').length;

  return (
    <div style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Page Title & Context */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Contradiction Radar
          </h1>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            NLI Inference
          </span>
        </div>
        <p
          style={{
            marginTop: '0.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            maxWidth: '780px',
            lineHeight: 1.5,
          }}
        >
          Cross-paper literature conflict analysis using Natural Language Inference (NLI).
          Semantically relevant findings from different papers are paired and classified into{' '}
          <strong>ENTAILMENT</strong>, <strong>CONTRADICTION</strong>, or <strong>NEUTRAL</strong>.
        </p>
      </div>

      {/* Critical Scientific Guardrail Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '0.75rem',
          marginBottom: '1.75rem',
          fontSize: '0.82rem',
          color: '#fbbf24',
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span>
        <div>
          <strong>Important Scientific Guardrail:</strong> A contradiction detected by an NLI
          model is a <em>candidate signal</em>, not automatically established scientific truth.
          Differences in sample size, methodology, domain scope, or baseline metrics may account
          for conflicting findings. Inspect the verbatim statements and original sources below
          before drawing conclusions.
        </div>
      </div>

      {/* Control Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'flex-end',
          marginBottom: '1.75rem',
          padding: '1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            Semantic Relevance Threshold: {(semanticThreshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min={0.3}
            max={0.9}
            step={0.05}
            value={semanticThreshold}
            onChange={(e) => setSemanticThreshold(Number(e.target.value))}
            style={{ width: '160px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Cosine similarity cutoff
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            Min NLI Confidence: {(minConfidence * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            style={{ width: '160px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Confidence filter
          </span>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '0.5rem',
            backgroundColor: analyzing ? '#374151' : '#6366f1',
            color: '#ffffff',
            border: 'none',
            cursor: analyzing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            transition: 'background 0.2s',
          }}
        >
          {analyzing ? 'Evaluating Pairs…' : 'Run NLI Analysis'}
        </button>

        <button
          onClick={loadComparisons}
          disabled={loading}
          style={{
            padding: '0.6rem 1.1rem',
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

      {/* Aggregate Metric Cards */}
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
            {totalCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Pairs Compared
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderRadius: '0.625rem',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f87171' }}>
            {contradictionCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '0.2rem' }}>
            Contradictions (Candidate Signals)
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderRadius: '0.625rem',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>
            {entailmentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6ee7b7', marginTop: '0.2rem' }}>
            Entailments (Agreements)
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            borderRadius: '0.625rem',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#818cf8' }}>
            {neutralCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#a5b4fc', marginTop: '0.2rem' }}>
            Neutral / Uncorrelated
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          paddingBottom: '0.5rem',
        }}
      >
        {(
          [
            ['CONTRADICTION', `Contradictions (${contradictionCount})`],
            ['ENTAILMENT', `Entailments (${entailmentCount})`],
            ['NEUTRAL', `Neutrals (${neutralCount})`],
            ['ALL', `All Comparisons (${totalCount})`],
          ] as [RelationTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: tab === key ? 600 : 400,
              backgroundColor: tab === key ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
              color: tab === key ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List / Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading comparisons…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px dashed var(--border-color)',
            borderRadius: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>⚖️</div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-secondary)' }}>
            No {tab === 'ALL' ? '' : tab.toLowerCase()} comparisons found
          </div>
          <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
            Click <strong>Run NLI Analysis</strong> to evaluate cross-paper findings.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map((item) => {
            const isContra = item.nli_label === 'CONTRADICTION';
            const isEntail = item.nli_label === 'ENTAILMENT';
            const labelColor = isContra ? '#f87171' : isEntail ? '#34d399' : '#818cf8';
            const bgBadge = isContra
              ? 'rgba(239, 68, 68, 0.12)'
              : isEntail
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(99, 102, 241, 0.12)';

            return (
              <div
                key={item.id}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '0.75rem',
                  border: isContra
                    ? '1px solid rgba(239, 68, 68, 0.35)'
                    : '1px solid var(--border-color)',
                  boxShadow: isContra
                    ? '0 2px 8px rgba(239, 68, 68, 0.05)'
                    : 'none',
                }}
              >
                {/* Header Badge Strip */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        backgroundColor: bgBadge,
                        color: labelColor,
                        border: `1px solid ${labelColor}44`,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.nli_label}
                    </span>

                    {item.is_candidate_signal && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        Candidate Signal
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Relevance: {(item.semantic_similarity * 100).toFixed(0)}% · Confidence:{' '}
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor:
                          item.status === 'confirmed'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : item.status === 'dismissed'
                            ? 'rgba(107, 114, 128, 0.2)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color:
                          item.status === 'confirmed'
                            ? '#34d399'
                            : item.status === 'dismissed'
                            ? '#9ca3af'
                            : '#fbbf24',
                      }}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison Container */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    gap: '1rem',
                    alignItems: 'stretch',
                  }}
                >
                  {/* Statement A */}
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#818cf8',
                          textTransform: 'uppercase',
                        }}
                      >
                        Paper A Finding
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {item.statement_a_section || 'Results'}
                        {item.statement_a_page ? ` · p. ${item.statement_a_page}` : ''}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.paper_a_title}
                    </div>

                    <div
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                        borderLeft: '3px solid #818cf8',
                        paddingLeft: '0.6rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      "{item.statement_a_text}"
                    </div>
                  </div>

                  {/* Visual Connector */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 0.5rem',
                      color: labelColor,
                    }}
                  >
                    <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                      {isContra ? '⚡' : isEntail ? '⇄' : '≈'}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      vs
                    </span>
                  </div>

                  {/* Statement B */}
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#f59e0b',
                          textTransform: 'uppercase',
                        }}
                      >
                        Paper B Finding
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {item.statement_b_section || 'Results'}
                        {item.statement_b_page ? ` · p. ${item.statement_b_page}` : ''}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.paper_b_title}
                    </div>

                    <div
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                        borderLeft: '3px solid #f59e0b',
                        paddingLeft: '0.6rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      "{item.statement_b_text}"
                    </div>
                  </div>
                </div>

                {/* Researcher Review Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Add researcher note on this evidence…"
                      value={activeNotes[item.id] ?? item.review_notes ?? ''}
                      onChange={(e) =>
                        setActiveNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      style={{
                        flex: 1,
                        maxWidth: '420px',
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.78rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'confirmed')}
                      disabled={updatingId === item.id}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          item.status === 'confirmed'
                            ? 'rgba(16, 185, 129, 0.3)'
                            : 'rgba(16, 185, 129, 0.12)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        cursor: 'pointer',
                      }}
                    >
                      Confirm Conflict
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(item.id, 'dismissed')}
                      disabled={updatingId === item.id}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          item.status === 'dismissed'
                            ? 'rgba(107, 114, 128, 0.3)'
                            : 'rgba(107, 114, 128, 0.12)',
                        color: '#9ca3af',
                        border: '1px solid rgba(107, 114, 128, 0.3)',
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss (False Positive)
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(item.id, 'candidate_signal')}
                      disabled={updatingId === item.id}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContradictionsDashboard;
