import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Network, RefreshCw, ExternalLink } from 'lucide-react';
import { apiService } from '../services/api';
import type { GraphPayload } from '../services/api';

const NODE_COLORS: Record<string, string> = {
  paper: '#38bdf8',
  method: '#a855f7',
  dataset: '#ec4899',
  metric: '#10b981',
  limitation: '#f59e0b',
  topic: '#3b82f6',
  concept: '#14b8a6',
};

export const KnowledgeGraph: React.FC = () => {
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getIntelligenceDashboard();
      setGraph(res.graph);
      if (res.graph.nodes.length > 0) {
        setSelectedNodeId(res.graph.nodes[0].id);
      }
    } catch (e) {
      console.warn('Failed to load graph data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const filteredNodes = selectedType === 'all'
    ? graph.nodes
    : graph.nodes.filter((n) => n.type === selectedType);

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);
  const connectedLinks = graph.links.filter(
    (l) => l.source === selectedNodeId || l.target === selectedNodeId
  );

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Network size={24} color="#10b981" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Domain Knowledge Graph Explorer
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Interactive cross-paper entity graph mapping Papers, Methods, Datasets, Metrics, and Limitations with direct evidence provenance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadGraph}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Sync Graph</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['all', 'paper', 'method', 'dataset', 'metric', 'limitation', 'topic'].map((type) => {
          const isActive = selectedType === type;
          const color = type === 'all' ? '#818cf8' : NODE_COLORS[type] || '#818cf8';

          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.775rem',
                fontWeight: 600,
                backgroundColor: isActive ? color : 'var(--bg-secondary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? `1px solid ${color}` : '1px solid var(--border-color)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {type} ({type === 'all' ? graph.nodes.length : graph.nodes.filter((n) => n.type === type).length})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading knowledge graph representation…
        </div>
      ) : filteredNodes.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.75rem',
            border: '1px dashed var(--border-color)',
          }}
        >
          <Network size={40} color="#6b7280" style={{ margin: '0 auto 1rem', opacity: 0.7 }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            No Knowledge Graph Nodes Available
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Ingest scientific literature in the <Link to="/papers" style={{ color: '#818cf8' }}>Paper Library</Link> to extract entities and build cross-paper edges.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(300px, 1fr)', gap: '1.25rem' }}>
          {/* SVG Canvas */}
          <div
            style={{
              height: '540px',
              backgroundColor: 'rgba(11, 15, 25, 0.75)',
              borderRadius: '0.625rem',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            <svg width="100%" height="100%" viewBox="0 0 800 540" style={{ display: 'block' }}>
              {graph.links.map((link, idx) => {
                const sIdx = filteredNodes.findIndex((n) => n.id === link.source);
                const tIdx = filteredNodes.findIndex((n) => n.id === link.target);
                if (sIdx === -1 || tIdx === -1) return null;

                const sAngle = (sIdx / filteredNodes.length) * 2 * Math.PI;
                const tAngle = (tIdx / filteredNodes.length) * 2 * Math.PI;
                const sX = 400 + 260 * Math.cos(sAngle);
                const sY = 270 + 190 * Math.sin(sAngle);
                const tX = 400 + 260 * Math.cos(tAngle);
                const tY = 270 + 190 * Math.sin(tAngle);

                const isHighlighted = link.source === selectedNodeId || link.target === selectedNodeId;

                return (
                  <line
                    key={idx}
                    x1={sX}
                    y1={sY}
                    x2={tX}
                    y2={tY}
                    stroke={isHighlighted ? '#818cf8' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={isHighlighted ? 2 : 1}
                  />
                );
              })}

              {filteredNodes.map((node, idx) => {
                const angle = (idx / filteredNodes.length) * 2 * Math.PI;
                const cx = 400 + 260 * Math.cos(angle);
                const cy = 270 + 190 * Math.sin(angle);
                const isSelected = node.id === selectedNodeId;
                const color = NODE_COLORS[node.type] || '#818cf8';

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 11 : 7}
                      fill={color}
                      stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.6)'}
                      strokeWidth={isSelected ? 2.5 : 1}
                    />
                    <text
                      x={cx}
                      y={cy - 12}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : '#94a3b8'}
                      fontSize={isSelected ? '12' : '10'}
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {node.title.slice(0, 18)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Node Evidence Detail Card */}
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.625rem',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Entity Inspection & Provenance
            </span>

            {selectedNode ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: NODE_COLORS[selectedNode.type] || '#818cf8',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                    {selectedNode.type} Entity
                  </span>
                </div>

                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  {selectedNode.title}
                </h3>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Node ID: <code>{selectedNode.id}</code>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Connected Edges ({connectedLinks.length})
                  </span>
                  {connectedLinks.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {connectedLinks.map((l, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                          <code>{l.label}</code> → {l.target === selectedNode.id ? l.source : l.target}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No direct incident edges in current slice.</div>
                  )}
                </div>

                {selectedNode.url && (
                  <Link
                    to={selectedNode.url}
                    style={{
                      marginTop: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1rem',
                      backgroundColor: '#4f46e5',
                      borderRadius: '0.375rem',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <span>View Underlying Evidence</span>
                    <ExternalLink size={14} />
                  </Link>
                )}
              </>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select any node to inspect evidence.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;
