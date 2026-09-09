import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Network,
  Globe,
  CircleDot,
  Puzzle,
  Scale,
  Compass,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Layers,
  BarChart3,
  Calendar,
  AlertCircle,
  Database,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  IntelligenceDashboardData,
} from '../services/api';

const NODE_COLORS: Record<string, string> = {
  paper: '#38bdf8',
  method: '#a855f7',
  dataset: '#ec4899',
  metric: '#10b981',
  limitation: '#f59e0b',
  topic: '#3b82f6',
  concept: '#14b8a6',
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<IntelligenceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected node in Knowledge Graph visualizer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getIntelligenceDashboard();
      setData(res);
      if (res.graph.nodes.length > 0) {
        setSelectedNodeId(res.graph.nodes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load research intelligence data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ maxWidth: '1440px', margin: '3rem auto', textAlign: 'center', padding: '2rem' }}>
        <RefreshCw size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Assembling Research Intelligence Dashboard…
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Aggregating cross-corpus analytical signals across papers, entities, topics, patterns, and hypotheses.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171', marginBottom: '0.5rem' }}>
          <AlertCircle size={20} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Dashboard Synchronization Error</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{error || 'Unable to connect to intelligence service.'}</p>
        <button
          onClick={loadData}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4f46e5',
            border: 'none',
            borderRadius: '0.375rem',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const { stats, charts, graph } = data;
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);
  const connectedLinks = graph.links.filter(
    (l) => l.source === selectedNodeId || l.target === selectedNodeId
  );

  // 10 Stat Cards configuration
  const statCards = [
    { label: 'Papers Analyzed', count: stats.papers_analyzed, icon: FileText, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', url: '/papers', desc: 'Ingested & segmented' },
    { label: 'Entities Extracted', count: stats.entities_extracted, icon: Network, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', url: '/papers', desc: 'Methods, datasets, claims' },
    { label: 'Knowledge Graph', count: stats.knowledge_graph_stats.node_count, sub: `${stats.knowledge_graph_stats.edge_count} edges`, icon: Database, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', url: '/graph', desc: 'Cross-paper entity graph' },
    { label: 'Research Topics', count: stats.research_topics, icon: Globe, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', url: '/topics', desc: 'BERTopic semantic models' },
    { label: 'Limitation Clusters', count: stats.limitation_clusters, icon: CircleDot, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', url: '/evidence-clusters', desc: 'HDBSCAN constraint clusters' },
    { label: 'Future-Work Clusters', count: stats.future_work_clusters, icon: Sparkles, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', url: '/evidence-clusters', desc: 'Author recommendations' },
    { label: 'Underexplored Patterns', count: stats.underexplored_patterns, icon: Puzzle, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', url: '/patterns', desc: 'FP-Growth / Apriori gaps' },
    { label: 'Contradictions', count: stats.contradictions, icon: Scale, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', url: '/contradictions', desc: 'NLI empirical conflicts' },
    { label: 'Ranked Research Gaps', count: stats.research_gaps, icon: Compass, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', url: '/research-gaps', desc: 'Explainable 9-dim scoring' },
    { label: 'Grounded Hypotheses', count: stats.hypotheses, icon: Lightbulb, color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', url: '/hypotheses', desc: 'Evidence-grounded proposals' },
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '0.75rem',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
              }}
            >
              Scientific Discovery Intelligence
            </span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            HypothesiAI Research Intelligence Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.55' }}>
            Comprehensive analytics connecting ingested scientific literature, extracted entities, topic distributions,
            HDBSCAN limitation clusters, FP-Growth patterns, NLI contradictions, ranked research gaps, and evidence-grounded hypotheses.
          </p>
        </div>

        {/* Action Quick Links */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={loadData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.95rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.825rem',
              fontWeight: 500,
            }}
          >
            <RefreshCw size={15} />
            <span>Sync Stats</span>
          </button>

          <Link
            to="/search"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)',
            }}
          >
            <span>Global Search</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* 10 Core Summary Metric Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Layers size={18} color="#818cf8" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Research Corpus & Analytical Indicators (10 Modalities)
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(card.url)}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '0.625rem',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = card.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {card.label}
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: card.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: card.color,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                </div>

                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {card.count}
                  {card.sub && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'sans-serif', marginLeft: '0.4rem', fontWeight: 400 }}>
                      ({card.sub})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>{card.desc}</span>
                  <ExternalLink size={11} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7 Analytical Charts Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={18} color="#6366f1" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Analytical Evidence Visualizations (7 Charts)
          </h2>
        </div>

        {/* Row 1: Papers by Year & Topic Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>

          {/* Chart 1: Papers by Year */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  1. Papers Analyzed by Publication Year
                </h3>
              </div>
              <Link to="/papers" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span>View Papers</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {charts.papers_by_year.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No paper publication years recorded yet. Ingest papers in the <Link to="/papers" style={{ color: '#818cf8' }}>Paper Library</Link>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                {/* SVG Bar Chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  {charts.papers_by_year.map((item, i) => {
                    const maxCount = Math.max(...charts.papers_by_year.map((x) => x.count), 1);
                    const heightPct = Math.round((item.count / maxCount) * 100);

                    return (
                      <div
                        key={i}
                        onClick={() => navigate('/papers')}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'pointer' }}
                        title={`${item.count} paper(s) in ${item.year}`}
                      >
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem', fontFamily: 'monospace' }}>
                          {item.count}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '36px',
                            height: `${Math.max(8, heightPct)}%`,
                            backgroundColor: 'rgba(56, 189, 248, 0.65)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', whiteSpace: 'nowrap' }}>
                          {item.year}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart 2: Topic Distribution */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={16} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  2. Research Topic Distribution
                </h3>
              </div>
              <Link to="/topics" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span>Topic Models</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {charts.topic_distribution.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No topic distribution available. Run <Link to="/topics" style={{ color: '#818cf8' }}>Topic Modeling</Link> to generate BERTopic clusters.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {charts.topic_distribution.map((t, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/topics')}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        {t.name}
                      </span>
                      <span style={{ color: '#60a5fa', fontWeight: 600, fontFamily: 'monospace' }}>
                        {t.percentage}% ({t.frequency})
                      </span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${t.percentage}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Research Trends & Limitation Frequency */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>

          {/* Chart 3: Research Trends */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={16} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  3. Research Topic Velocity & Momentum
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Temporal trends</span>
            </div>

            {charts.research_trends.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No trend signals computed yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                {charts.research_trends.map((trend, i) => {
                  const dirColor = trend.direction === 'rising' ? '#10b981' : trend.direction === 'stable' ? '#3b82f6' : '#f59e0b';
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '0.65rem 0.75rem',
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        borderRadius: '0.375rem',
                        borderLeft: `3px solid ${dirColor}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: dirColor, fontWeight: 700 }}>
                          {trend.direction}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {trend.paper_count} papers
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {trend.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chart 4: Limitation Frequency */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CircleDot size={16} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  4. Top Recurring Empirical Limitations
                </h3>
              </div>
              <Link to="/evidence-clusters" style={{ fontSize: '0.75rem', color: '#f59e0b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span>Clusters</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {charts.limitation_frequency.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No extracted limitations recorded. Ingest papers in the <Link to="/papers" style={{ color: '#818cf8' }}>Paper Library</Link>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {charts.limitation_frequency.map((lim, idx) => {
                  const maxLim = Math.max(...charts.limitation_frequency.map((x) => x.count), 1);
                  const pct = Math.round((lim.count / maxLim) * 100);

                  return (
                    <div
                      key={idx}
                      onClick={() => navigate('/evidence-clusters')}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {lim.term}
                        </span>
                        <span style={{ color: '#fbbf24', fontWeight: 600, fontFamily: 'monospace' }}>
                          {lim.count} paper(s)
                        </span>
                      </div>
                      <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Gap Types Distribution, Contradictions, and Method-Dataset Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>

          {/* Chart 5: Gap Types Distribution */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Compass size={16} color="#f43f5e" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  5. Candidate Gap Modalities
                </h3>
              </div>
              <Link to="/research-gaps" style={{ fontSize: '0.75rem', color: '#f43f5e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span>Ranked Gaps</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {charts.gap_types.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No ranked gaps computed yet. Visit <Link to="/research-gaps" style={{ color: '#818cf8' }}>Research Gaps</Link> to run ranking.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {charts.gap_types.map((g, idx) => (
                  <div key={idx} onClick={() => navigate('/research-gaps')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{g.label}</span>
                      <span style={{ color: '#fb7185', fontWeight: 600, fontFamily: 'monospace' }}>{g.percentage}% ({g.count})</span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${g.percentage}%`, height: '100%', backgroundColor: '#f43f5e', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 6: Contradiction Count & NLI Statuses */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Scale size={16} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  6. Empirical Contradictions & NLI Signals
                </h3>
              </div>
              <Link to="/contradictions" style={{ fontSize: '0.75rem', color: '#ef4444', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span>Radar</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {charts.contradiction_count.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No contradiction analyses present. Run NLI analysis in <Link to="/contradictions" style={{ color: '#818cf8' }}>Contradiction Radar</Link>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {charts.contradiction_count.map((con, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/contradictions')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>{con.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>
                      {con.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 7: Method-Dataset Relationships */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '0.625rem', border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Puzzle size={16} color="#ec4899" />
                <h3 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  7. Method × Dataset Evaluations
                </h3>
              </div>
              <Link to="/patterns" style={{ fontSize: '0.75rem', color: '#ec4899', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span>Patterns</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {charts.method_dataset_relationships.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No method-dataset co-occurrences logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {charts.method_dataset_relationships.map((rel, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/patterns')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      <strong>{rel.method}</strong> on <em>{rel.dataset}</em>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#f472b6', fontWeight: 600 }}>
                      {rel.paper_count} paper(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Knowledge Graph Explorer */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Network size={20} color="#10b981" />
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Interactive Domain Knowledge Graph
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Cross-paper bipartite relationships connecting papers, methods, datasets, limitations, and topics.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{type}</span>
              </span>
            ))}
          </div>
        </div>

        {graph.nodes.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No graph nodes populated yet. Ingest papers in the <Link to="/papers" style={{ color: '#818cf8' }}>Paper Library</Link> to build the cross-paper graph.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '1.25rem', alignItems: 'start' }}>

            {/* SVG Visualizer Canvas */}
            <div
              style={{
                height: '420px',
                backgroundColor: 'rgba(11, 15, 25, 0.7)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 700 420" style={{ display: 'block' }}>
                {/* Edges */}
                {graph.links.map((link, idx) => {
                  const sIdx = graph.nodes.findIndex((n) => n.id === link.source);
                  const tIdx = graph.nodes.findIndex((n) => n.id === link.target);
                  if (sIdx === -1 || tIdx === -1) return null;

                  // Circular coordinate distribution for deterministic layout
                  const sAngle = (sIdx / graph.nodes.length) * 2 * Math.PI;
                  const tAngle = (tIdx / graph.nodes.length) * 2 * Math.PI;
                  const sX = 350 + 200 * Math.cos(sAngle);
                  const sY = 210 + 150 * Math.sin(sAngle);
                  const tX = 350 + 200 * Math.cos(tAngle);
                  const tY = 210 + 150 * Math.sin(tAngle);

                  const isHighlighted = link.source === selectedNodeId || link.target === selectedNodeId;

                  return (
                    <line
                      key={idx}
                      x1={sX}
                      y1={sY}
                      x2={tX}
                      y2={tY}
                      stroke={isHighlighted ? '#818cf8' : 'rgba(255,255,255,0.12)'}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeDasharray={isHighlighted ? 'none' : '3,3'}
                    />
                  );
                })}

                {/* Nodes */}
                {graph.nodes.map((node, idx) => {
                  const angle = (idx / graph.nodes.length) * 2 * Math.PI;
                  const cx = 350 + 200 * Math.cos(angle);
                  const cy = 210 + 150 * Math.sin(angle);
                  const isSelected = node.id === selectedNodeId;
                  const color = NODE_COLORS[node.type] || '#818cf8';

                  return (
                    <g
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 10 : 6}
                        fill={color}
                        stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.5)'}
                        strokeWidth={isSelected ? 2.5 : 1}
                      />
                      {isSelected && (
                        <text
                          x={cx}
                          y={cy - 14}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {node.title.slice(0, 20)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected Node Details & Direct Evidence Link */}
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Selected Entity Node
              </span>

              {selectedNode ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: NODE_COLORS[selectedNode.type] || '#818cf8',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                      {selectedNode.type}
                    </span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.35' }}>
                    {selectedNode.title}
                  </h3>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Node ID: <code>{selectedNode.id}</code>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Connected relationships: <strong>{connectedLinks.length}</strong>
                  </div>

                  {connectedLinks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Adjacent Links
                      </span>
                      {connectedLinks.slice(0, 4).map((l, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                          <code>{l.label}</code> → {l.target === selectedNode.id ? l.source : l.target}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedNode.url && (
                    <Link
                      to={selectedNode.url}
                      style={{
                        marginTop: '0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.85rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '0.375rem',
                        color: '#a5b4fc',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <span>View Source Evidence</span>
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click any node in the graph to inspect evidence links.</div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
