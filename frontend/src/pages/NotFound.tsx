import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <div style={{ color: '#ef4444' }}>
        <AlertCircle size={48} />
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>404 - Page Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '0.9rem' }}>
        The requested view does not exist in the HypothesiAI discovery portal.
      </p>
      <Link to="/" className="btn-primary" style={{ marginTop: '1rem' }}>
        Return to Dashboard
      </Link>
    </div>
  );
};
