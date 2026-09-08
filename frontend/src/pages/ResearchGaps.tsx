import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ExternalLink, Sparkles } from 'lucide-react';
import { apiService, ResearchGap } from '../services/api';
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  LoadingState,
} from '../components/ui';

export const ResearchGaps: React.FC = () => {
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    apiService
      .getResearchGaps()
      .then((data) => setGaps(data))
      .catch((err) => console.warn('Failed to load research gaps', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Multi-Signal Research Gaps
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Identified research white spaces synthesized across converging evidence signals.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Sparkles size={16} />}
          onClick={() => alert('Stage 4 multi-signal analytical pipeline (BERTopic, FP-Growth, NLI) will trigger here.')}
        >
          Discover New Gaps
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading discovered research gaps..." submessage="Aggregating multi-signal scores" />
      ) : gaps.length === 0 ? (
        <EmptyState
          icon={<Compass size={32} />}
          title="No Research Gaps Discovered Yet"
          description="Research gaps are synthesized automatically once research papers are uploaded and the multi-signal pipeline (BERTopic clusters, FP-Growth rarity mining, and NLI contradiction detection) executes in Stage 4."
          action={
            <Link to="/papers">
              <Button variant="primary">
                Ingest Research Papers First
              </Button>
            </Link>
          }
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate Gap Title & Domain</TableHead>
                <TableHead>Limitation Cluster</TableHead>
                <TableHead>Pattern Rarity</TableHead>
                <TableHead>Contradiction</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaps.map((gap) => (
                <TableRow key={gap.id}>
                  <TableCell>
                    <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '0.2rem' }}>
                      {gap.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Domain: <span style={{ color: '#818cf8' }}>{gap.domain || 'Cross-Disciplinary'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span style={{ fontSize: '0.85rem', color: '#34d399' }}>
                      {Math.round(gap.limitation_signal_weight * 100)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
                      {Math.round(gap.pattern_rarity_weight * 100)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span style={{ fontSize: '0.85rem', color: '#f87171' }}>
                      {Math.round(gap.contradiction_weight * 100)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">
                      {Math.round(gap.confidence_score * 100)}% Match
                    </Badge>
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Link to={`/gaps/${gap.id}`}>
                      <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                        Inspect Evidence
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
