import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  minHeight?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  minHeight = '320px',
}) => {
  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: '3rem 2rem',
        textAlign: 'center',
        gap: '1.25rem',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8',
        }}
      >
        {icon || <Inbox size={28} />}
      </div>

      <div style={{ maxWidth: '460px' }}>
        <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.4rem' }}>
          {title}
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>

      {action && <div>{action}</div>}
    </div>
  );
};
