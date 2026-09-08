import React from 'react';
import { Compass, GitMerge } from 'lucide-react';

export const GapDiscovery: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Multi-Signal Gap Discovery</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Evidence-ranked research gaps identified across literature white spaces.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
          <Compass size={48} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Multi-Evidence Fusion Pipeline Scheduled for Stage 4</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '560px', fontSize: '0.875rem', lineHeight: '1.6' }}>
          Research gaps are discovered from converging evidence signals: BERTopic + HDBSCAN limitation clusters, FP-Growth pattern rarity mining, and Cross-Encoder NLI conflict detection.
        </p>
        <div className="badge badge-info" style={{ marginTop: '0.5rem' }}>
          <GitMerge size={12} style={{ marginRight: '0.25rem' }} />
          <span>Multi-Signal Database Schema Configured in Stage 1</span>
        </div>
      </div>
    </div>
  );
};
