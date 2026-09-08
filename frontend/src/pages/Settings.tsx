import React, { useEffect, useState } from 'react';
import {
  User,
  Key,
  Activity,
  Server,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen,
  GitBranch,
} from 'lucide-react';
import { Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { apiService, HealthStatusResponse, ReadinessResponse } from '../services/api';

// ─── Service Status Widget ──────────────────────────────────────────────────

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  status: 'ok' | 'connected' | 'offline' | 'pending' | undefined | null;
  details: { label: string; value: string }[];
}

const ServiceCard: React.FC<ServiceCardProps> = ({ icon, title, status, details }) => {
  const isHealthy = status === 'ok' || status === 'connected';

  return (
    <div
      style={{
        padding: '1.25rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {icon}
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            backgroundColor: isHealthy ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            color: isHealthy ? '#10b981' : '#f59e0b',
          }}
        >
          {isHealthy ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
          {isHealthy ? (status === 'ok' ? 'Online' : 'Connected') : 'Unavailable'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {details.map((d) => (
          <div key={d.label} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{d.label}: </span>
            <code style={{ color: 'var(--text-primary)', fontSize: '0.78rem' }}>{d.value}</code>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Settings Page ──────────────────────────────────────────────────────────

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const runProbes = async () => {
    setProbeLoading(true);
    setProbeError(null);
    try {
      const [h, r] = await Promise.all([
        apiService.getBackendHealth().catch(() => null),
        apiService.getBackendReadiness().catch(() => null),
      ]);
      setHealth(h);
      setReadiness(r);
      if (!h) setProbeError('Backend API gateway unreachable — ensure `npm run dev` is running in backend/.');
    } catch (err: unknown) {
      setProbeError(err instanceof Error ? err.message : 'Probe failed');
    } finally {
      setProbeLoading(false);
    }
  };

  useEffect(() => {
    runProbes();
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Manage your researcher profile, review infrastructure status, and understand LLM configuration.
        </p>
      </div>

      {/* ── Section 1: Researcher Profile ── */}
      <Card>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <User size={18} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Researcher Profile</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            {[
              { label: 'Full Name', value: user?.full_name || '—' },
              { label: 'Email Address', value: user?.email || '—' },
              { label: 'Role', value: user?.role || 'researcher' },
              { label: 'Account Status', value: user ? 'Active' : 'Not authenticated' },
            ].map((field) => (
              <div key={field.label}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {field.label}
                </div>
                <div
                  style={{
                    padding: '0.6rem 0.875rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {field.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start',
              padding: '0.875rem 1rem',
              backgroundColor: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            <Info size={15} style={{ flexShrink: 0, marginTop: '0.05rem', color: '#6366f1' }} />
            <span>
              Profile management (name, password change, avatar) will be available in Stage 5 when the full user-management API is implemented.
            </span>
          </div>
        </div>
      </Card>

      {/* ── Section 2: LLM Provider Configuration ── */}
      <Card>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Key size={18} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>LLM Provider Configuration</h2>
          </div>

          {/* Security Notice */}
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start',
              padding: '0.875rem 1rem',
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '0.5rem',
              fontSize: '0.82rem',
              color: '#fca5a5',
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.05rem', color: '#ef4444' }} />
            <span>
              <strong>Security policy:</strong> API keys are <em>never</em> stored in the frontend or transmitted through the browser.
              Configure them in the backend <code>.env</code> file (see <code>.env.example</code>). The AI service reads keys directly from environment variables at startup.
            </span>
          </div>

          {/* Provider Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {[
              {
                name: 'Google Gemini',
                envKey: 'GEMINI_API_KEY',
                purpose: 'Primary LLM for hypothesis generation and evidence synthesis',
                docsUrl: 'https://ai.google.dev',
                color: '#4285f4',
              },
              {
                name: 'OpenAI GPT',
                envKey: 'OPENAI_API_KEY',
                purpose: 'Optional secondary LLM / embedding fallback',
                docsUrl: 'https://platform.openai.com/docs',
                color: '#10a37f',
              },
            ].map((provider) => (
              <div
                key={provider.name}
                style={{
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: provider.color }}>
                  {provider.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {provider.purpose}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Set in <code style={{ color: 'var(--text-secondary)' }}>ai-service/.env</code>:
                </div>
                <code
                  style={{
                    display: 'block',
                    marginTop: '0.3rem',
                    padding: '0.4rem 0.6rem',
                    backgroundColor: 'var(--bg-tertiary, rgba(0,0,0,0.3))',
                    borderRadius: '0.4rem',
                    fontSize: '0.78rem',
                    color: '#a78bfa',
                    wordBreak: 'break-all',
                  }}
                >
                  {provider.envKey}=sk-...
                </code>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            See <code>.env.example</code> in the project root for all required environment variables.
            Restart the AI service after changing keys.
          </div>
        </div>
      </Card>

      {/* ── Section 3: Infrastructure Status ── */}
      <Card>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Activity size={18} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Infrastructure Status</h2>
            </div>
            <button
              onClick={runProbes}
              disabled={probeLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.5rem',
                color: 'var(--text-secondary)',
                cursor: probeLoading ? 'not-allowed' : 'pointer',
                opacity: probeLoading ? 0.6 : 1,
              }}
            >
              <RefreshCw size={13} style={probeLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>

          {probeError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '0.5rem',
                fontSize: '0.82rem',
                color: '#fca5a5',
              }}
            >
              {probeError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <ServiceCard
              icon={<Server size={17} color="#6366f1" />}
              title="Backend Gateway"
              status={health?.status === 'ok' ? 'ok' : (probeLoading ? 'pending' : 'offline')}
              details={[
                { label: 'Runtime', value: 'Node.js + Express + TS' },
                { label: 'Port', value: '5000' },
                { label: 'Version', value: health?.version || '1.0.0' },
                { label: 'Uptime', value: health?.uptime ? `${Math.round(health.uptime)}s` : 'N/A' },
              ]}
            />
            <ServiceCard
              icon={<Cpu size={17} color="#a855f7" />}
              title="Python AI Service"
              status={readiness?.checks?.ai_service?.status as 'connected' | 'offline' | undefined}
              details={[
                { label: 'Runtime', value: 'Python 3.13 + FastAPI' },
                { label: 'Port', value: '8000' },
                { label: 'Pipeline Stages', value: '8 registered' },
                { label: 'Status', value: readiness?.checks?.ai_service?.status || 'probe pending' },
              ]}
            />
            <ServiceCard
              icon={<Database size={17} color="#3b82f6" />}
              title="PostgreSQL"
              status={readiness?.checks?.postgres?.status as 'connected' | 'offline' | undefined}
              details={[
                { label: 'Schema', value: 'database/schema.sql' },
                { label: 'Tables', value: '15 (DDL ready)' },
                { label: 'Extension', value: 'pgvector' },
                { label: 'Status', value: readiness?.checks?.postgres?.status || 'probe pending' },
              ]}
            />
            <ServiceCard
              icon={<Activity size={17} color="#10b981" />}
              title="Neo4j Graph DB"
              status={readiness?.checks?.neo4j?.status as 'connected' | 'offline' | undefined}
              details={[
                { label: 'Bolt', value: 'bolt://localhost:7687' },
                { label: 'Browser', value: 'http://localhost:7474' },
                { label: 'Driver', value: 'neo4j-driver active' },
                { label: 'Status', value: readiness?.checks?.neo4j?.status || 'probe pending' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* ── Section 4: Stage Roadmap ── */}
      <Card>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <GitBranch size={18} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Build Roadmap</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { stage: 'Stage 1', title: 'Foundation & Monorepo', status: 'done', desc: 'React + Vite, Express + TypeScript, FastAPI, Docker Compose' },
              { stage: 'Stage 2', title: 'PostgreSQL Schema', status: 'done', desc: '15-table schema, migration runner, pgvector, Neo4j driver' },
              { stage: 'Stage 3', title: 'Authentication', status: 'done', desc: 'JWT, bcrypt, signup/login/logout, protected routes, AuthContext' },
              { stage: 'Stage 4', title: 'Frontend UI Shell', status: 'done', desc: '10 UI components, 10 pages, real API architecture, responsive layout' },
              { stage: 'Stage 5', title: 'Paper Ingestion & Parsing', status: 'upcoming', desc: 'PDF upload, text extraction, section parsing, entity extraction' },
              { stage: 'Stage 6', title: 'Knowledge Graph & Embeddings', status: 'upcoming', desc: 'Neo4j population, vector embeddings, semantic clustering' },
              { stage: 'Stage 7', title: 'Gap Detection Pipeline', status: 'upcoming', desc: 'Multi-signal gap inference: limitations, contradictions, NLI, pattern analysis' },
              { stage: 'Stage 8', title: 'Hypothesis Generation', status: 'upcoming', desc: 'LLM-assisted hypothesis creation with full evidence citation chains' },
            ].map((item) => (
              <div
                key={item.stage}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  padding: '0.75rem 1rem',
                  backgroundColor: item.status === 'done' ? 'rgba(16,185,129,0.05)' : 'var(--bg-secondary)',
                  border: `1px solid ${item.status === 'done' ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
                  borderRadius: '0.5rem',
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.status === 'done' ? '#10b981' : 'var(--border-subtle)',
                    marginTop: '0.05rem',
                  }}
                >
                  {item.status === 'done' ? (
                    <CheckCircle size={12} color="#fff" />
                  ) : (
                    <BookOpen size={10} color="var(--text-muted)" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: '0.4rem' }}>{item.stage}:</span>
                    {item.title}
                    {item.status === 'done' && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#10b981', fontWeight: 500 }}>✓ Complete</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
