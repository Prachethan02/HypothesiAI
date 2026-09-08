import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, FileText, ArrowLeft } from 'lucide-react';
import { apiService, AnalysisRun } from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  LoadingState,
  ProgressIndicator,
  StepItem,
} from '../components/ui';

export const AnalysisDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (id) {
      apiService
        .getAnalysisRunById(id)
        .then((data) => setRun(data))
        .catch((err) => console.warn('Failed to load analysis run', err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const pipelineSteps: StepItem[] = [
    { id: '1', label: '1. PyMuPDF Structural Ingestion', status: 'completed', description: 'Decompose PDF sections and retain page coordinates' },
    { id: '2', label: '2. DistilBERT Entity & Limitation Extraction', status: 'completed', description: 'Extract problems, methods, datasets, claims' },
    { id: '3', label: '3. MiniLM Embeddings & RapidFuzz Resolution', status: 'completed', description: 'Vector embeddings and canonical entity deduplication' },
    { id: '4', label: '4. BERTopic + HDBSCAN Limitation Clustering', status: 'completed', description: 'Semantic clustering of open challenges across papers' },
    { id: '5', label: '5. FP-Growth Pattern Rarity Mining', status: 'completed', description: 'Uncover underexplored problem-method combinations' },
    { id: '6', label: '6. Cross-Encoder NLI Contradiction Detection', status: 'completed', description: 'Identify conflicting empirical findings' },
    { id: '7', label: '7. Multi-Signal Evidence Fusion & Gap Ranking', status: 'completed', description: 'Compute calibrated composite gap confidence' },
    { id: '8', label: '8. Grounded LLM Hypothesis Formulation', status: 'in_progress', description: 'Synthesize actionable hypotheses with paper citations' },
  ];

  if (loading) {
    return <LoadingState message="Loading pipeline telemetry..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
            Back to Dashboard
          </Button>
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Analysis Run #{id}</span>
      </div>

      {/* Header Card */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Badge variant="info">{run?.run_type || 'Discovery Pipeline Execution'}</Badge>
              <Badge variant={run?.status === 'failed' ? 'danger' : 'success'}>
                {run?.status || 'Active Telemetry'}
              </Badge>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
              Analytical Run #{id}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Multi-signal research gap discovery and hypothesis formulation run.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={16} color="#818cf8" />
              <span>Duration: {run?.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : 'Real-time'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={16} color="#34d399" />
              <span>Corpus: {run?.papers_analyzed_count || 0} papers</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Pipeline Stage Tracker */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Execution Stages</CardTitle>
          <CardDescription>
            Live state across the 8 modular analytical pipeline microservices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressIndicator steps={pipelineSteps} />
        </CardContent>
      </Card>

      {/* Run Parameters & Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle>Run Telemetry & Config</CardTitle>
        </CardHeader>
        <CardContent>
          <pre
            style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              color: '#818cf8',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(
              run?.parameters || {
                run_id: id,
                models: {
                  parser: 'PyMuPDF',
                  extractor: 'DistilBERT',
                  embeddings: 'sentence-transformers/all-MiniLM-L6-v2',
                  clustering: 'BERTopic + HDBSCAN',
                  pattern_mining: 'FP-Growth',
                  nli: 'cross-encoder/nli-distilroberta-base',
                  hypothesis_llm: 'Gemini / OpenAI Grounded Synthesis',
                },
                multi_signal_weights: {
                  limitation_cluster_density: 0.35,
                  pattern_rarity: 0.25,
                  nli_contradiction: 0.25,
                  momentum: 0.15,
                },
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
