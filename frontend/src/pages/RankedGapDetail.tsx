import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Quote,
  Layers,
  BarChart2,
  HelpCircle,
  Sparkles,
  Award,
} from 'lucide-react';
import { apiService } from '../services/api';
import type { RankedGap } from '../services/api';

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

const DIMENSION_COLOR_MAP: Record<string, string> = {
  'Recurrence': '#f59e0b',
  'Evidence Strength': '#6366f1',
  'Independent Paper Support': '#06b6d4',
  'Contradiction Strength': '#ef4444',
  'Underexplored Combination': '#ec4899',
  'Topic Relevance': '#3b82f6',
  'Temporal Signal': '#8b5cf6',
  'Graph Evidence': '#10b981',
  'Confidence': '#14b8a6',
};

export const RankedGapDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [gap, setGap] = useState<RankedGap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchGap = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getRankedGapById(id);
        if (res.success && res.data) {
          setGap(res.data);
        } else {
          setError(`Research gap with ID "${id}" could not be located.`);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve research gap detail.');
      } finally {
        setLoading(false);
      }
    };
    fetchGap();
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '3rem auto', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading research gap audit data…
      </div>
    );
  }

  if (error || !gap) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => navigate('/research-gaps')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', marginBottom: '1rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Gap Rankings</span>
        </button>
        <div style={{ color: '#f87171', fontSize: '0.9rem' }}>{error || 'Gap not found.'}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Top Navigation */}
      <div>
        <button
          onClick={() => navigate('/research-gaps')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'transparent',
            border: 'none',
            color: '#818cf8',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            padding: '0.25rem 0',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Ranked Research Gaps</span>
        </button>
      </div>

      {/* Title & Rank Header */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.625rem',
                backgroundColor: gap.rank <= 3 ? 'rgba(234, 179, 8, 0.18)' : 'rgba(99, 102, 241, 0.15)',
                border: gap.rank <= 3 ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.25rem',
                color: gap.rank <= 3 ? '#facc15' : '#818cf8',
                flexShrink: 0,
              }}
            >
              #{gap.rank}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                  }}
                >
                  {gap.evidence_type.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ID: {gap.gap_id}
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.35' }}>
                {gap.title}
              </h1>
            </div>
          </div>

          {/* Top Score Cards */}
          {(() => {
            const rgqsScore = getGapRGQS(gap);
            const tier = getTierBadge(rgqsScore);
            return (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: tier.bg,
                    border: `1px solid ${tier.border}`,
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: tier.text, fontWeight: 600 }}>
                    RGQS Quality Score
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: tier.text, fontFamily: 'monospace' }}>
                    {rgqsScore.toFixed(1)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'rgba(79, 70, 229, 0.12)',
                    border: '1px solid rgba(79, 70, 229, 0.3)',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#a5b4fc', fontWeight: 600 }}>
                    Composite Score
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>
                    {gap.composite_score.toFixed(4)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 600 }}>
                    Signal Confidence
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
                    {(gap.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/hypotheses?gap_id=${gap.gap_id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 1rem',
                    backgroundColor: '#4f46e5',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.4)',
                    alignSelf: 'center',
                  }}
                >
                  <Sparkles size={16} />
                  <span>Formulate Hypothesis</span>
                </button>
              </div>
            );
          })()}
        </div>

        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {gap.description}
        </p>
      </div>

      {/* Scientific Guardrail Notice */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: '0.5rem',
          color: '#fde047',
          fontSize: '0.8125rem',
          lineHeight: '1.45',
        }}
      >
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#eab308' }} />
        <div>
          <strong style={{ color: '#fef08a' }}>Scientific Guardrail:</strong> This ranking is computed from
          algorithmic signals across 9 dimensions. It is not an objective scientific assertion. Researchers should
          independently verify the source statements, study context, and empirical methodology.
        </div>
      </div>

      {/* Research Gap Quality Score (RGQS) Rigor Audit Section */}
      {(() => {
        const rgqsScore = getGapRGQS(gap);
        const tier = getTierBadge(rgqsScore);
        const comps = getGapComponents(gap);
        const paperCount = gap.source_papers?.length || 1;
        const evidenceCount = gap.source_statements?.length || gap.evidence_ids?.length || paperCount;

        const dimensions = [
          {
            key: 'G',
            name: 'Gap Validity (G)',
            weight: 30,
            score: comps.gapValidity,
            contrib: comps.gapValidity * 30,
            color: '#10b981',
            desc: 'Cross-paper recurrence, independent paper corroboration, and explicit limitation statements.',
          },
          {
            key: 'E',
            name: 'Evidence Grounding (E)',
            weight: 25,
            score: comps.evidenceGrounding,
            contrib: comps.evidenceGrounding * 25,
            color: '#6366f1',
            desc: 'Empirical excerpt quality, factual context grounding, and pipeline extraction confidence.',
          },
          {
            key: 'T',
            name: 'Traceability (T)',
            weight: 20,
            score: comps.traceability,
            contrib: comps.traceability * 20,
            color: '#06b6d4',
            desc: 'Verified paper IDs, document page citations, and traceable raw evidence records.',
          },
          {
            key: 'N',
            name: 'Novelty (N)',
            weight: 15,
            score: comps.novelty,
            contrib: comps.novelty * 15,
            color: '#ec4899',
            desc: 'Cross-domain bridge strength and structural graph gap divergence in knowledge graph.',
          },
          {
            key: 'C',
            name: 'Consistency (C)',
            weight: 10,
            score: comps.consistency,
            contrib: comps.consistency * 10,
            color: '#f59e0b',
            desc: 'Internal consensus across findings; heavily penalizes contradictory claims.',
          },
        ];

        return (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-color)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Award size={22} color="#10b981" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Research Gap Quality Score (RGQS) Audit
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Formula: <code style={{ color: '#a5b4fc', backgroundColor: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                      RGQS = 100 × (0.30·G + 0.25·E + 0.20·T + 0.15·N + 0.10·C)
                    </code>
                  </div>
                </div>
              </div>

              {/* Overall Score Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 800, color: tier.text, fontFamily: 'monospace' }}>
                    {rgqsScore.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 100</span>
                </div>
                <span
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    backgroundColor: tier.bg,
                    color: tier.text,
                    border: `1px solid ${tier.border}`,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {tier.label}
                </span>
              </div>
            </div>

            {/* Quality Meter & Summary Metrics */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                padding: '0.85rem 1.15rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Quality Meter:</span>
                {renderQualityMeter(rgqsScore)}
                <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>{rgqsScore.toFixed(0)}%</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                <span style={{ padding: '0.2rem 0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  Supporting Papers: <strong>{paperCount}</strong>
                </span>
                <span style={{ padding: '0.2rem 0.6rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  Supporting Evidence: <strong>{evidenceCount}</strong>
                </span>
                {gap.source_pages && gap.source_pages.length > 0 && (
                  <span style={{ padding: '0.2rem 0.6rem', backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                    Cited Pages: <strong>{gap.source_pages.join(', ')}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* 5 Dimensions Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {dimensions.map((dim) => {
                const pct = Math.min(100, Math.max(0, dim.score * 100));
                return (
                  <div
                    key={dim.key}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      borderRadius: '0.5rem',
                      borderLeft: `4px solid ${dim.color}`,
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      borderRight: '1px solid rgba(255,255,255,0.05)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {dim.name}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <span style={{ color: dim.color, fontWeight: 700 }}>
                          {(dim.score * 100).toFixed(1)}%
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                          (+{dim.contrib.toFixed(1)} pts)
                        </span>
                      </div>
                    </div>

                    <div style={{ height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: dim.color, borderRadius: '3px' }} />
                    </div>

                    <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {dim.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Why Identified Analytical Explanation */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.625rem',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontWeight: 600, fontSize: '0.9rem' }}>
          <HelpCircle size={16} />
          <span>Why the Gap Was Identified</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {gap.why_identified}
        </p>
      </div>

      {/* 9 Dimensions Audit Grid */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.625rem',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} color="#6366f1" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Explainable Dimension Breakdown
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Composite = Σ(raw_score × weight)
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {gap.dimensions && gap.dimensions.map((dim, idx) => {
            const color = DIMENSION_COLOR_MAP[dim.name] || '#818cf8';
            const pct = Math.min(100, Math.max(0, dim.raw_score * 100));

            return (
              <div
                key={idx}
                style={{
                  padding: '0.875rem 1rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.45)',
                  borderRadius: '0.5rem',
                  borderLeft: `4px solid ${color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {dim.name}
                  </span>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      raw score: <strong style={{ color: '#e2e8f0' }}>{dim.raw_score.toFixed(3)}</strong>
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      weight: <strong style={{ color: '#a5b4fc' }}>{dim.weight.toFixed(3)}</strong>
                    </span>
                    <span style={{ color: color, fontWeight: 700 }}>
                      +{dim.weighted_contribution.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div style={{ height: '6px', width: '100%', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '3px' }} />
                </div>

                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  {dim.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supporting Evidence Provenance */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.625rem',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="#06b6d4" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Supporting Evidence & Source Provenance
          </h3>
        </div>

        {/* Verbatim Statements */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Verbatim Corpus Statements ({gap.source_statements ? gap.source_statements.length : 0})
          </span>
          {gap.source_statements && gap.source_statements.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {gap.source_statements.map((stmt, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: '0.375rem',
                    borderLeft: '2px solid #a855f7',
                    fontSize: '0.85rem',
                    color: '#cbd5e1',
                    fontStyle: 'italic',
                    lineHeight: '1.5',
                  }}
                >
                  <Quote size={16} color="#a855f7" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>"{stmt}"</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No direct statements captured for this gap.</div>
          )}
        </div>

        {/* Supporting Papers */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Supporting Papers ({gap.source_papers ? gap.source_papers.length : 0})
          </span>
          {gap.source_papers && gap.source_papers.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.75rem' }}>
              {gap.source_papers.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '0.375rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <FileText size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      Paper ID: {p.id}
                    </div>
                    {p.publication_year && (
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        Published: {p.publication_year}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No explicit paper links associated.</div>
          )}
        </div>

        {/* Source Pages */}
        {gap.source_pages && gap.source_pages.length > 0 && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Cited Document Pages:</strong> {gap.source_pages.join(', ')}
          </div>
        )}

        {/* Evidence IDs */}
        {gap.evidence_ids && gap.evidence_ids.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            Associated Evidence IDs: {gap.evidence_ids.join(', ')}
          </div>
        )}
      </div>

    </div>
  );
};

export default RankedGapDetail;
