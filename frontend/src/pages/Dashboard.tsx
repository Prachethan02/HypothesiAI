import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Network,
  Compass,
  Lightbulb,
  Layers,
  ArrowRight,
  UploadCloud,
  Cpu,
} from 'lucide-react';
import { apiService, DashboardStats } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '../components/ui';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    papersAnalyzed: 0,
    entitiesExtracted: 0,
    researchGaps: 0,
    researchTopics: 0,
    hypotheses: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    apiService
      .getDashboardStats()
      .then((data) => setStats(data))
      .catch((err) => console.warn('Could not load dashboard stats', err))
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      title: 'Papers Analyzed',
      value: stats.papersAnalyzed,
      icon: FileText,
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.1)',
      path: '/papers',
      description: 'Ingested & segmented PDFs',
    },
    {
      title: 'Entities Extracted',
      value: stats.entitiesExtracted,
      icon: Network,
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.1)',
      path: '/papers',
      description: 'Methods, problems, claims',
    },
    {
      title: 'Research Gaps',
      value: stats.researchGaps,
      icon: Compass,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.1)',
      path: '/research-gaps',
      description: 'Multi-signal ranked white spaces',
    },
    {
      title: 'Research Topics',
      value: stats.researchTopics,
      icon: Layers,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      path: '/research-gaps',
      description: 'BERTopic clusters & keywords',
    },
    {
      title: 'Hypotheses',
      value: stats.hypotheses,
      icon: Lightbulb,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
      path: '/hypotheses',
      description: 'Evidence-grounded propositions',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Platform Hero Banner */}
      <Card
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          padding: '2.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Badge variant="info">Scientific Intelligence Platform</Badge>
          <Badge variant="outline">Stage 4 Active</Badge>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '0.75rem', color: '#ffffff' }}>
          Research Gap Discovery & Evidence-Backed Hypotheses
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '850px', lineHeight: 1.6, marginBottom: '1.75rem' }}>
          HypothesiAI ingests scientific literature, extracts structured ontology with PyMuPDF and DistilBERT, isolates multi-signal research gaps using BERTopic, HDBSCAN, FP-Growth, and NLI, and formulates verifiable, fully traceable hypotheses.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/papers">
            <Button variant="primary" leftIcon={<UploadCloud size={16} />}>
              Open Paper Library
            </Button>
          </Link>
          <Link to="/research-gaps">
            <Button variant="secondary" leftIcon={<Compass size={16} />}>
              Discover Research Gaps
            </Button>
          </Link>
          <Link to="/hypotheses">
            <Button variant="outline" leftIcon={<Lightbulb size={16} />}>
              Hypothesis Studio
            </Button>
          </Link>
        </div>
      </Card>

      {/* 5 Requisite Metrics Placeholders */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>Platform Analytical Metrics</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time database sync</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {statCards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.title} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: c.bg,
                      color: c.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <Link to={c.path} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
                    {loading ? '—' : c.value}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {c.description}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Multi-Signal Detection Architecture Banner */}
      <Card style={{ borderLeft: '4px solid #6366f1', padding: '1.75rem' }}>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', marginBottom: '0.25rem' }}>
            <Cpu size={20} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Multi-Signal Gap Detection Invariant
            </span>
          </div>
          <CardTitle>Converging Analytical Signals</CardTitle>
          <CardDescription>
            In accordance with core scientific tenets, HypothesiAI never relies on a single model to claim a research gap:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(31, 41, 55, 0.5)', borderRadius: '0.5rem' }}>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>1. Semantic Limitation Density</strong>
              BERTopic + HDBSCAN cluster repeating explicit limitations and future work statements across multiple independent labs.
            </div>
            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(31, 41, 55, 0.5)', borderRadius: '0.5rem' }}>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>2. Pattern Rarity Mining</strong>
              FP-Growth / Apriori pinpoints unattempted intersections between established problem frameworks and mature methodologies.
            </div>
            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(31, 41, 55, 0.5)', borderRadius: '0.5rem' }}>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>3. Contradiction Detection</strong>
              Cross-Encoder NLI detects conflicting empirical claims across literature to highlight unresolved scientific debate.
            </div>
            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(31, 41, 55, 0.5)', borderRadius: '0.5rem' }}>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>4. Grounded Synthesis</strong>
              LLMs receive structured evidence bundles to formulate actionable hypotheses with verifiable source paper citations.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
