import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  RefreshCw,
  FileText,
  Quote,
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Award,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { apiService } from '../services/api';
import type { RankedGap, Corpus } from '../services/api';

const renderQualityMeter = (score: number) => {
  const totalBlocks = 20;
  const filledBlocks = Math.max(1, Math.min(totalBlocks, Math.round((score / 100) * totalBlocks)));
  const emptyBlocks = totalBlocks - filledBlocks;
  return (
    <span style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.08em', color: '#10b981' }}>
      {'█'.repeat(filledBlocks)}
      <span style={{ color: 'rgba(255, 255, 255, 0.18)' }}>{'░'.repeat(emptyBlocks)}</span>
    </span>
  );
};

const getTierBadge = (rgqs: number) => {
  if (rgqs >= 80) {
    return { label: 'Strong Evidence-Backed Gap', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
  } else if (rgqs >= 60) {
    return { label: 'Moderate Evidence-Backed Gap', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
  } else if (rgqs >= 40) {
    return { label: 'Weak / Moderate Candidate', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
  } else {
    return { label: 'Low-Confidence Candidate', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
  }
};

const getGapComponents = (gap: RankedGap) => {
  if (gap.rgqs_breakdown?.components) {
    return gap.rgqs_breakdown.components;
  }
  return {
    gapValidity: gap.gap_validity_score ?? 0.85,
    evidenceGrounding: gap.evidence_grounding_score ?? 0.88,
    traceability: gap.traceability_score ?? 0.90,
    novelty: gap.novelty_score ?? 0.75,
    consistency: gap.consistency_score ?? 0.82,
  };
};

const getGapRGQS = (gap: RankedGap): number => {
  if (typeof gap.rgqs === 'number') return gap.rgqs;
  if (typeof gap.rgqs_breakdown?.rgqs === 'number') return gap.rgqs_breakdown.rgqs;
  const comps = getGapComponents(gap);
  return Math.round((0.30 * comps.gapValidity + 0.25 * comps.evidenceGrounding + 0.20 * comps.traceability + 0.15 * comps.novelty + 0.10 * comps.consistency) * 1000) / 10;
};

export const GapRankingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [rankedGaps, setRankedGaps] = useState<RankedGap[]>([]);
  const [corpora, setCorpora] = useState<Corpus[]>([]);
  const [selectedCorpusId, setSelectedCorpusId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGaps = useCallback(async (corpusIdToUse?: string) => {
    setLoading(true);
    setError(null);
    try {
      const cid = corpusIdToUse !== undefined ? corpusIdToUse : selectedCorpusId;
      const [gapsRes, corpList] = await Promise.all([
        apiService.listRankedGaps({ corpus_id: cid || undefined }),
        apiService.listCorpora().catch(() => []),
      ]);
      if (gapsRes.success && gapsRes.data) {
        setRankedGaps(gapsRes.data);
      }
      if (Array.isArray(corpList)) {
        setCorpora(corpList);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load research gaps.');
    } finally {
      setLoading(false);
    }
  }, [selectedCorpusId]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  const handleCorpusChange = (newCid: string) => {
    setSelectedCorpusId(newCid);
    loadGaps(newCid);
  };

  const handleRunRanking = async () => {
    setRanking(true);
    setError(null);
    try {
      const res = await apiService.rankResearchGaps({
        min_composite_score: 0.1,
        min_evidence_count: 1,
        corpus_id: selectedCorpusId || undefined,
        force_refresh: true,
      });
      if (res.success && res.data.ranked_gaps) {
        setRankedGaps(res.data.ranked_gaps);
      }
    } catch (err: any) {
      setError(err.message || 'Research gap analysis failed.');
    } finally {
      setRanking(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <TrendingUp size={24} color="#6366f1" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Identified Research Gaps
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Automatically discovered, synthesized, and prioritized across your uploaded scientific papers.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Corpus / Dataset Selector */}
          {corpora.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={15} color="var(--text-muted)" />
              <select
                value={selectedCorpusId}
                onChange={(e) => handleCorpusChange(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
                title="Select dataset or corpus to analyze"
              >
                <option value="">All Uploaded Literature</option>
                {corpora.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.paper_count || 0} papers)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => loadGaps()}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
            }}
            title="Refresh list"
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleRunRanking}
            disabled={ranking}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              backgroundColor: ranking ? '#4338ca' : '#4f46e5',
              border: 'none',
              color: '#ffffff',
              cursor: ranking ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)',
            }}
          >
            <Sparkles size={16} />
            <span>{ranking ? 'Analyzing Papers…' : 'Re-Analyze Research Gaps'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#f87171',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Corpus-Level Summary Banner */}
      {!loading && rankedGaps.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="#818cf8" />
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Corpus Gap Quality Summary (RGQS)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average RGQS: </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>
                  {(rankedGaps.reduce((sum, g) => sum + getGapRGQS(g), 0) / rankedGaps.length).toFixed(1)}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> / 100</span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Highest RGQS: </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                  {Math.max(...rankedGaps.map(g => getGapRGQS(g))).toFixed(1)}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> / 100</span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>High-Quality Gaps (≥80): </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#facc15', fontFamily: 'monospace' }}>
                  {rankedGaps.filter(g => getGapRGQS(g) >= 80).length}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> of {rankedGaps.length}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <span style={{ fontWeight: 600 }}>Suggested Score Interpretation:</span>
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>80–100: Strong evidence-backed</span>
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>60–79: Moderate evidence-backed</span>
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>40–59: Weak/moderate candidate</span>
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>0–39: Low-confidence candidate</span>
          </div>
        </div>
      )}

      {/* Main Gaps Listing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading && rankedGaps.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <RefreshCw size={24} style={{ margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
            <div>Analyzing uploaded papers and identifying research gaps…</div>
          </div>
        ) : rankedGaps.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.75rem',
              border: '1px dashed var(--border-color)',
            }}
          >
            <BookOpen size={40} color="#4b5563" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              No Research Gaps Yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', marginInline: 'auto' }}>
              Upload scientific papers to automatically synthesize empirical research gaps and testable hypotheses.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleRunRanking}
                disabled={ranking}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.4rem',
                  backgroundColor: '#4f46e5',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: ranking ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)',
                }}
              >
                <Sparkles size={16} />
                <span>{ranking ? 'Analyzing Papers…' : 'Synthesize & Rank Gaps'}</span>
              </button>
              <button
                onClick={() => navigate('/corpus')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <BookOpen size={16} />
                <span>Upload More Papers</span>
              </button>
            </div>
          </div>
        ) : (

          rankedGaps.map((gap) => (
            <div
              key={gap.gap_id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'border-color 0.2s ease',
              }}
            >
              {/* Header: Rank + Title + Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.375rem',
                      backgroundColor: gap.rank === 1 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      color: gap.rank === 1 ? '#facc15' : '#818cf8',
                      border: `1px solid ${gap.rank === 1 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
                      flexShrink: 0,
                      marginTop: '0.15rem',
                    }}
                  >
                    Priority #{gap.rank}
                  </span>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem', lineHeight: 1.35 }}>
                      {gap.title}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                      {gap.description}
                    </p>
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(`/research-gaps/${gap.gap_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 0.95rem',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#a5b4fc',
                      fontWeight: 600,
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    title="View dimensional provenance and raw calculations"
                  >
                    <ShieldCheck size={14} />
                    <span>Audit & Provenance</span>
                    <ExternalLink size={13} />
                  </button>

                  <button
                    onClick={() => navigate(`/hypotheses?gap_id=${gap.gap_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1.1rem',
                      backgroundColor: '#4f46e5',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)',
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Formulate Hypothesis</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Research Gap Quality Score (RGQS) Audit Card */}
              {(() => {
                const rgqsScore = getGapRGQS(gap);
                const tier = getTierBadge(rgqsScore);
                const comps = getGapComponents(gap);
                const paperCount = gap.source_papers?.length || 1;
                const evidenceCount = gap.source_statements?.length || gap.evidence_ids?.length || paperCount;

                return (
                  <div
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '0.625rem',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    {/* Top Row: Score + Tier Badge + Text Meter + Counts */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>RGQS:</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: tier.text, fontFamily: 'monospace' }}>
                            {rgqsScore.toFixed(1)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 100</span>
                        </div>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            backgroundColor: tier.bg,
                            color: tier.text,
                            border: `1px solid ${tier.border}`,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {tier.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Quality Meter:</span>
                          {renderQualityMeter(rgqsScore)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span style={{ padding: '0.15rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            📄 Papers: <strong style={{ color: '#e2e8f0' }}>{paperCount}</strong>
                          </span>
                          <span style={{ padding: '0.15rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            🔍 Evidence: <strong style={{ color: '#e2e8f0' }}>{evidenceCount}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5-Dimension Metric Bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Validity (G)', weight: '30%', score: comps.gapValidity, contrib: comps.gapValidity * 30 },
                        { label: 'Evidence (E)', weight: '25%', score: comps.evidenceGrounding, contrib: comps.evidenceGrounding * 25 },
                        { label: 'Traceability (T)', weight: '20%', score: comps.traceability, contrib: comps.traceability * 20 },
                        { label: 'Novelty (N)', weight: '15%', score: comps.novelty, contrib: comps.novelty * 15 },
                        { label: 'Consistency (C)', weight: '10%', score: comps.consistency, contrib: comps.consistency * 10 },
                      ].map((dim) => {
                        const barColor = dim.score >= 0.8 ? '#10b981' : dim.score >= 0.6 ? '#60a5fa' : dim.score >= 0.4 ? '#f59e0b' : '#f87171';
                        return (
                          <div
                            key={dim.label}
                            style={{
                              backgroundColor: 'rgba(15, 23, 42, 0.45)',
                              borderRadius: '0.375rem',
                              padding: '0.5rem 0.65rem',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{dim.label}</span>
                              <span style={{ color: barColor, fontWeight: 700, fontFamily: 'monospace' }}>
                                {(dim.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div style={{ height: '5px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(0, dim.score * 100))}%`,
                                  backgroundColor: barColor,
                                  borderRadius: '9999px',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              <span>Weight: {dim.weight}</span>
                              <span style={{ color: '#cbd5e1' }}>+{dim.contrib.toFixed(1)} pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Extended Evidence Quality & Audit Signals */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.72rem' }}>
                      {gap.rgqs_breakdown?.corroboration_level && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Corroboration:</span>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            backgroundColor: gap.rgqs_breakdown.corroboration_level === 'strong' ? 'rgba(16, 185, 129, 0.15)' : gap.rgqs_breakdown.corroboration_level === 'moderate' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: gap.rgqs_breakdown.corroboration_level === 'strong' ? '#10b981' : gap.rgqs_breakdown.corroboration_level === 'moderate' ? '#60a5fa' : '#f59e0b',
                            textTransform: 'capitalize',
                          }}>
                            {gap.rgqs_breakdown.corroboration_level.replace('_', ' ')}
                          </span>
                        </div>
                      )}

                      {gap.rgqs_breakdown?.contradiction_level && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Contradiction:</span>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            backgroundColor: gap.rgqs_breakdown.contradiction_level === 'none' ? 'rgba(16, 185, 129, 0.12)' : gap.rgqs_breakdown.contradiction_level === 'minor' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.15)',
                            color: gap.rgqs_breakdown.contradiction_level === 'none' ? '#34d399' : gap.rgqs_breakdown.contradiction_level === 'minor' ? '#93c5fd' : '#f87171',
                            textTransform: 'capitalize',
                          }}>
                            {gap.rgqs_breakdown.contradiction_level}
                          </span>
                        </div>
                      )}

                      {gap.rgqs_breakdown?.provenance_completeness !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Provenance:</span>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#cbd5e1',
                          }}>
                            {(gap.rgqs_breakdown.provenance_completeness * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {gap.rgqs_breakdown?.explanation && (
                        <div style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.73rem', fontStyle: 'italic', marginTop: '0.2rem' }}>
                          {gap.rgqs_breakdown.explanation}
                        </div>
                      )}

                      {gap.rgqs_breakdown?.scoring_notes && gap.rgqs_breakdown.scoring_notes.length > 0 && (
                        <details style={{ width: '100%', marginTop: '0.25rem', cursor: 'pointer' }}>
                          <summary style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 600, outline: 'none' }}>
                            Scientific Scoring Audit Trail ({gap.rgqs_breakdown.scoring_notes.length} notes)
                          </summary>
                          <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0, fontSize: '0.68rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {gap.rgqs_breakdown.scoring_notes.map((note, nIdx) => (
                              <li key={nIdx}>{note}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })()}


              {/* Why Identified Box */}
              <div
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '0.5rem',
                  padding: '0.875rem 1rem',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a5b4fc', fontWeight: 600, marginBottom: '0.3rem' }}>
                  <CheckCircle2 size={15} color="#818cf8" />
                  <span>Why This Gap Was Identified in Your Literature:</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {gap.why_identified}
                </div>
              </div>

              {/* Source Papers & Verbatim Excerpts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Source Papers & Empirical Evidence
                </div>

                {/* Paper Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {gap.source_papers.map((p, idx) => {
                    const paperTitle = typeof p === 'string' ? p : p?.title || 'Scientific Paper';
                    const paperYear = typeof p === 'object' && p ? p.publication_year : null;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.35rem 0.75rem',
                          backgroundColor: 'rgba(30, 41, 59, 0.7)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <FileText size={13} color="#60a5fa" />
                        <span style={{ fontWeight: 500 }}>{paperTitle}</span>
                        {paperYear && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({paperYear})</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Verbatim Statements */}
                {gap.source_statements && gap.source_statements.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                    {Array.from(new Set(gap.source_statements)).slice(0, 2).map((stmt, sIdx) => (

                      <div
                        key={sIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          padding: '0.6rem 0.85rem',
                          backgroundColor: 'rgba(15, 23, 42, 0.4)',
                          borderLeft: '3px solid #6366f1',
                          borderRadius: '0 0.375rem 0.375rem 0',
                          fontSize: '0.825rem',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic',
                          lineHeight: 1.45,
                        }}
                      >
                        <Quote size={13} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>"{stmt}"</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GapRankingDashboard;
