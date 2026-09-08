import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  submessage?: string;
  minHeight?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  submessage,
  minHeight = '300px',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: '2rem',
        textAlign: 'center',
        gap: '0.75rem',
      }}
    >
      <Loader2 size={32} className="animate-spin" color="#6366f1" />
      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
        {message}
      </div>
      {submessage && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '360px' }}>
          {submessage}
        </div>
      )}
    </div>
  );
};
