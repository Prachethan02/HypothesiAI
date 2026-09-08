import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Compass, ArrowLeft, Lightbulb, FileText } from 'lucide-react';
import { apiService, ResearchGap } from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  LoadingState,
  EmptyState,
} from '../components/ui';

export const GapDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [gap, setGap] = useState<ResearchGap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (id) {
      apiService
        .getResearchGapById(id)
        .then((data) => setGap(data))
        .catch((err) => console.warn('Failed to load gap details', err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading gap evidence & provenance..." />;
  }

  if (!gap) {
    return (
      <EmptyState
        icon={<Compass size={36} />}
        title="Research Gap Not Found"
        description={`No candidate research gap matches ID: ${id}.`}
        action={
          <Link to="/research-gaps">
            <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
              Back to Research Gaps
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/research-gaps">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
            Back to Research Gaps
          </Button>
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gap #{id}</span>
      </div>

      {/* Main Gap Header */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Badge variant="info">{gap.domain || 'Cross-Domain Literature'}</Badge>
              <Badge variant="success">{Math.round(gap.confidence_score * 100)}% Evidence Score</Badge>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3, marginBottom: '0.75rem' }}>
              {gap.title}
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {gap.description}
            </p>
          </div>

          <Link to={`/hypotheses?generateFor=${gap.id}`}>
            <Button variant="primary" leftIcon={<Lightbulb size={16} />}>
              Generate Hypothesis (Stage 5)
            </Button>
          </Link>
        </div>
      </Card>

      {/* Multi-Signal Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Signal Fusion Weights</CardTitle>
          <CardDescription>
            Multi-signal decomposition validating this candidate gap across diverse NLP criteria:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ padding: '1rem', backgroundColor: 'rgba(31, 41, 55, 0.4)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                LIMITATION CLUSTER DENSITY
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>
                {Math.round(gap.limitation_signal_weight * 100)}%
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                HDBSCAN clustered recurring open questions across independent publications.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(31, 41, 55, 0.4)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                PATTERN RARITY SCORE
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>
                {Math.round(gap.pattern_rarity_weight * 100)}%
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                FP-Growth identified statistically absent problem-method pairings.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(31, 41, 55, 0.4)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                NLI CONTRADICTION DEGREE
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>
                {Math.round(gap.contradiction_weight * 100)}%
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Cross-Encoder NLI detected opposing empirical claims in the literature.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence & Provenance Traceability */}
      <Card>
        <CardHeader>
          <CardTitle>Traceable Literature Evidence</CardTitle>
          <CardDescription>
            Direct paper citations and verbatim empirical excerpts backing this gap:
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!gap.evidence || gap.evidence.length === 0) ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Detailed provenance excerpts will be populated when the multi-signal detection pipeline runs in Stage 4.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {gap.evidence.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(17, 24, 39, 0.6)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} color="#818cf8" />
                      <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{ev.paper_title || 'Source Literature'}</strong>
                    </div>
                    <Badge variant="outline">{ev.evidence_type}</Badge>
                  </div>
                  <blockquote style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem', borderLeft: '2px solid #6366f1', paddingLeft: '0.75rem' }}>
                    "{ev.snippet}"
                  </blockquote>
                  {ev.page_number && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Verified Citation: Page {ev.page_number}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
