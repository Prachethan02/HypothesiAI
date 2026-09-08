import React, { useEffect, useState } from 'react';
import { Network, RefreshCw, BarChart2 } from 'lucide-react';
import { apiService } from '../services/api';
import { Button, Card, CardHeader, CardTitle, CardContent, LoadingState, Badge } from '../components/ui';

export const TopicsDashboard: React.FC = () => {
  const [topics, setTopics] = useState<any[]>([]);
  const [run, setRun] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await apiService.getTopics();
      if (res.success && res.data) {
        setRun(res.data.run);
        setTopics(res.data.topics);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiService.generateTopics();
      await fetchTopics();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState message="Loading topics..." />;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#ffffff' }}>Research Topic Models</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            BERTopic analysis of findings, limitations, and future work across all ingested papers.
            <br />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Note: A topic cluster signifies thematic grouping, not necessarily a research gap.
            </span>
          </p>
        </div>
        <Button onClick={handleGenerate} isLoading={generating} leftIcon={<RefreshCw size={16} />}>
          Run Topic Modeling
        </Button>
      </div>

      {!run ? (
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <Network size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>No Topic Models Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Click "Run Topic Modeling" to generate topic clusters using BERTopic.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <CardTitle><BarChart2 size={18} /> Topic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {topics.map((t, idx) => (
                  <Badge key={idx} variant="outline" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                    {t.name} <span style={{ opacity: 0.6, marginLeft: '0.5rem' }}>({t.frequency})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <h2 style={{ fontSize: '1.25rem', marginTop: '1rem' }}>Extracted Topics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {topics.map(t => (
              <Card key={t.id} style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#818cf8' }}>{t.name}</h3>
                  <Badge variant="info">{t.frequency} statements</Badge>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Representation</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {t.representation.map((rep: any, i: number) => (
                      <span key={i} style={{ fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        {rep.word} <span style={{ opacity: 0.5 }}>{(rep.score).toFixed(2)}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Representative Statements</div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {t.representative_docs?.map((doc: string, i: number) => (
                      <li key={i}>{doc}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
