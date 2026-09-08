import React from 'react';
import { Lightbulb, BookOpen } from 'lucide-react';

export const HypothesisStudio: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Hypothesis Studio</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Strictly grounded, evidence-backed scientific hypotheses synthesized from detected gaps.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
          <Lightbulb size={48} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Grounded Hypothesis Generation Scheduled for Stage 5</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '560px', fontSize: '0.875rem', lineHeight: '1.6' }}>
          The LLM synthesizes actionable hypotheses, rationale, proposed methodologies, and evaluation criteria strictly from empirical evidence bundles with direct paper citations and anti-hallucination verification.
        </p>
        <div className="badge badge-info" style={{ marginTop: '0.5rem' }}>
          <BookOpen size={12} style={{ marginRight: '0.25rem' }} />
          <span>Hypothesis Persistence Model Formatted in Stage 1</span>
        </div>
      </div>
    </div>
  );
};
