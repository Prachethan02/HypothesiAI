import React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description?: string;
}

export interface ProgressIndicatorProps {
  steps?: StepItem[];
  progressPercent?: number;
  label?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  progressPercent,
  label,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Linear Percentage Bar (if progressPercent provided) */}
      {progressPercent !== undefined && (
        <div>
          {label && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.4rem',
              }}
            >
              <span>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(progressPercent)}%</span>
            </div>
          )}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                height: '100%',
                backgroundColor: '#6366f1',
                borderRadius: '9999px',
                transition: 'width 0.3s ease-in-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Multi-Step Pipeline Tracker */}
      {steps && steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isInProgress = step.status === 'in_progress';
            const isFailed = step.status === 'failed';

            return (
              <div
                key={step.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}
              >
                {/* Step Icon Indicator */}
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '0.1rem',
                    backgroundColor: isCompleted
                      ? 'rgba(16, 185, 129, 0.2)'
                      : isInProgress
                      ? 'rgba(99, 102, 241, 0.2)'
                      : isFailed
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(55, 65, 81, 0.4)',
                    color: isCompleted
                      ? '#34d399'
                      : isInProgress
                      ? '#818cf8'
                      : isFailed
                      ? '#f87171'
                      : 'var(--text-muted)',
                    border: `1px solid ${
                      isCompleted
                        ? 'rgba(16, 185, 129, 0.4)'
                        : isInProgress
                        ? 'rgba(99, 102, 241, 0.4)'
                        : isFailed
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'rgba(55, 65, 81, 0.6)'
                    }`,
                  }}
                >
                  {isCompleted && <Check size={12} />}
                  {isInProgress && <Loader2 size={12} className="animate-spin" />}
                  {isFailed && <AlertCircle size={12} />}
                  {!isCompleted && !isInProgress && !isFailed && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{index + 1}</span>
                  )}
                </div>

                {/* Step Details */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: isInProgress ? 600 : 500,
                      color: isCompleted
                        ? '#ffffff'
                        : isInProgress
                        ? '#818cf8'
                        : isFailed
                        ? '#f87171'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {step.label}
                  </div>
                  {step.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
