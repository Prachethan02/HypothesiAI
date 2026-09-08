import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Sparkles } from 'lucide-react';
import { apiService, Hypothesis } from '../services/api';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  LoadingState,
} from '../components/ui';

export const Hypotheses: React.FC = () => {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    apiService
      .getHypotheses()
      .then((data) => setHypotheses(data))
      .catch((err) => console.warn('Failed to load hypotheses', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Hypothesis Studio
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Grounded research hypotheses, methodology blueprints, and traceable literature citations.
          </p>
        </div>

        <Link to="/research-gaps">
          <Button variant="primary" leftIcon={<Sparkles size={16} />}>
            Formulate From Gap
          </Button>
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading research hypotheses..." submessage="Verifying empirical provenance" />
      ) : hypotheses.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={32} />}
          title="No Research Hypotheses Formulated Yet"
          description="Hypotheses are synthesized by the LLM strictly from evidence-backed research gaps. In Stage 5, the model receives limitation clusters, rarity patterns, and NLI conflicts to generate actionable methodologies with exact paper citations."
          action={
            <Link to="/research-gaps">
              <Button variant="primary" leftIcon={<Sparkles size={16} />}>
                Explore Candidate Gaps First
              </Button>
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {hypotheses.map((hyp) => (
            <Card key={hyp.id} style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Badge variant="info">Grounded Hypothesis</Badge>
                    <Badge variant="success">{hyp.status}</Badge>
                    {hyp.llm_provider && <Badge variant="outline">{hyp.llm_provider}</Badge>}
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>
                    {hyp.title}
                  </h2>
                </div>
              </div>

              {/* Statement */}
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Core Hypothesis Statement
                </div>
                <p style={{ fontSize: '1rem', color: '#ffffff', lineHeight: 1.6, fontWeight: 500 }}>
                  "{hyp.statement}"
                </p>
              </div>

              {/* Rationale & Methodology Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.4rem' }}>
                    Scientific Rationale
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {hyp.rationale}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.4rem' }}>
                    Proposed Methodology
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {hyp.proposed_methodology}
                  </p>
                </div>
              </div>

              {/* Citations Footer */}
              {hyp.citations && hyp.citations.length > 0 && (
                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    GROUNDED LITERATURE CITATIONS ({hyp.citations.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {hyp.citations.map((cit, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.6rem',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        📄 {cit.title} {cit.page ? `(p. ${cit.page})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
