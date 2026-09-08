import React from 'react';
import { Network, Database } from 'lucide-react';

export const KnowledgeGraph: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Domain Knowledge Graph</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Interactive Neo4j entity graph representing cross-paper relationships.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
          <Network size={48} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Neo4j Graph Engine Configured</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', fontSize: '0.875rem', lineHeight: '1.6' }}>
          Stage 3 introduces DistilBERT entity extraction, MiniLM dense embeddings, RapidFuzz entity deduplication, and real-time visualization of Paper, Method, Problem, Dataset, and Limitation subgraphs.
        </p>
        <div className="badge badge-info" style={{ marginTop: '0.5rem' }}>
          <Database size={12} style={{ marginRight: '0.25rem' }} />
          <span>Neo4j Driver Module Initialized in Stage 1</span>
        </div>
      </div>
    </div>
  );
};
