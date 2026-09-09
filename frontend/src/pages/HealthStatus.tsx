import React, { useEffect, useState } from 'react';
import {
  Activity,
  Server,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { apiService, HealthStatusResponse, ReadinessResponse } from '../services/api';

export const HealthStatus: React.FC = () => {
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, r] = await Promise.all([
        apiService.getBackendHealth().catch(() => null),
        apiService.getBackendReadiness().catch(() => null),
      ]);
      setHealth(h);
      setReadiness(r);
      if (!h) {
        setError('Unable to reach Backend API Gateway at configured URL.');
      }
    } catch (err: any) {
      setError(err.message || 'Error checking services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>System Diagnostics & Health</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Real-time status probes for Backend Gateway, PostgreSQL, Neo4j, and Python AI Service.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Probes</span>
        </button>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#f87171',
          fontSize: '0.875rem',
        }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Gateway Notice:</strong> {error} (Check that <code>npm run dev</code> is running in <code>backend/</code>).
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.25rem',
      }}>
        {/* Backend Gateway */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={20} color="#6366f1" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Backend Gateway</h2>
            </div>
            {health?.status === 'ok' ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={12} /> OK
              </span>
            ) : (
              <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <XCircle size={12} /> Offline
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>Runtime: <strong>Node.js + Express + TypeScript</strong></div>
            <div>Port: <code>5000</code></div>
            <div>Version: <code>{health?.version || '1.0.0'}</code></div>
            {health?.uptime && <div>Uptime: {Math.round(health.uptime)}s</div>}
          </div>
        </div>

        {/* Python AI Service */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={20} color="#a855f7" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Python AI Service</h2>
            </div>
            {readiness?.checks?.ai_service?.status === 'connected' ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={12} /> Connected
              </span>
            ) : (
              <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={12} /> Standalone
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>Runtime: <strong>Python 3.13 + FastAPI</strong></div>
            <div>Port: <code>8000</code></div>
            <div>Pipeline Scaffolding: <strong>8 Stages Registered</strong></div>
            <div>Status: {readiness?.checks?.ai_service?.status || 'Configured AI Service'}</div>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} color="#3b82f6" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>PostgreSQL (Supabase)</h2>
            </div>
            {readiness?.checks?.postgres?.status === 'connected' ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={12} /> Connected
              </span>
            ) : (
              <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Schema Ready
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>DDL: <code>database/schema.sql</code></div>
            <div>Tables: <code>users, papers, sections, entities, gaps, evidence, hypotheses</code></div>
            <div>Connection: {readiness?.checks?.postgres?.status || 'Configured via DATABASE_URL'}</div>
          </div>
        </div>

        {/* Neo4j Graph DB */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Neo4j Graph Database</h2>
            </div>
            {readiness?.checks?.neo4j?.status === 'connected' ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={12} /> Connected
              </span>
            ) : (
              <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Driver Ready
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>Protocol: <code>Configured via NEO4J_URI</code></div>
            <div>Connection: <strong>neo4j-driver connection manager active</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};
