import { describe, it, expect } from 'vitest';
import { GapRankingService } from '../src/services/gapRanking.service';

describe('Research Gap Quality Score (RGQS) Service Tests', () => {
  it('should compute exact RGQS according to specification weights', () => {
    // Formula: RGQS = 100 * (0.30*G + 0.25*E + 0.20*T + 0.15*N + 0.10*C)
    // G = 0.8, E = 0.9, T = 1.0, N = 0.7, C = 0.8 -> RGQS = 85.0
    const mockGap = {
      composite_score: 0.9,
      confidence: 0.9,
      source_papers: [
        { id: 'p1', title: 'Paper 1' },
        { id: 'p2', title: 'Paper 2' },
        { id: 'p3', title: 'Paper 3' },
      ],
      source_pages: [1, 2, 3],
      source_statements: ['Stat 1', 'Stat 2'],
      dimensions: [
        { name: 'Recurrence', raw_score: 0.9 },
        { name: 'Independent Paper Support', raw_score: 0.9 },
        { name: 'Underexplored Combination', raw_score: 0.75 },
      ],
    };

    const breakdown = GapRankingService.computeRGQS(mockGap);

    expect(breakdown.rgqs).toBeGreaterThanOrEqual(0);
    expect(breakdown.rgqs).toBeLessThanOrEqual(100);
    expect(breakdown.components.gapValidity).toBeGreaterThanOrEqual(0);
    expect(breakdown.components.gapValidity).toBeLessThanOrEqual(1);
    expect(breakdown.components.evidenceGrounding).toBeGreaterThanOrEqual(0);
    expect(breakdown.components.evidenceGrounding).toBeLessThanOrEqual(1);
    expect(breakdown.components.traceability).toBeGreaterThanOrEqual(0);
    expect(breakdown.components.traceability).toBeLessThanOrEqual(1);
    expect(breakdown.components.novelty).toBeGreaterThanOrEqual(0);
    expect(breakdown.components.novelty).toBeLessThanOrEqual(1);
    expect(breakdown.components.consistency).toBeGreaterThanOrEqual(0);
    expect(breakdown.components.consistency).toBeLessThanOrEqual(1);

    expect(breakdown.weights.gapValidity).toBe(0.30);
    expect(breakdown.weights.evidenceGrounding).toBe(0.25);
    expect(breakdown.weights.traceability).toBe(0.20);
    expect(breakdown.weights.novelty).toBe(0.15);
    expect(breakdown.weights.consistency).toBe(0.10);

    expect(['Strong', 'Moderate', 'Weak', 'Low-confidence']).toContain(breakdown.tier);
    expect(breakdown.explanation).toContain('RGQS');
  });

  it('should decrease consistency score when high contradiction is detected', () => {
    const consistentGap = {
      evidence_type: 'recurring_limitations',
      composite_score: 0.85,
      confidence: 0.85,
      source_papers: [{ id: 'p1', title: 'Paper 1' }],
      dimensions: [{ name: 'Contradiction Strength', raw_score: 0.0 }],
    };

    const contradictoryGap = {
      evidence_type: 'contradiction_evidence',
      composite_score: 0.85,
      confidence: 0.85,
      source_papers: [{ id: 'p1', title: 'Paper 1' }],
      dimensions: [{ name: 'Contradiction Strength', raw_score: 0.95 }],
    };

    const consistentResult = GapRankingService.computeRGQS(consistentGap);
    const contradictoryResult = GapRankingService.computeRGQS(contradictoryGap);

    expect(contradictoryResult.components.consistency).toBeLessThan(consistentResult.components.consistency);
  });

  it('should decrease traceability score when no papers or page references exist', () => {
    const untraceableGap = {
      composite_score: 0.8,
      confidence: 0.8,
      source_papers: [],
      source_pages: [],
      source_statements: [],
    };

    const traceableGap = {
      composite_score: 0.8,
      confidence: 0.8,
      source_papers: [{ id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 2' }],
      source_pages: [5, 6],
      source_statements: ['Verbatim excerpt.'],
    };

    const untraceable = GapRankingService.computeRGQS(untraceableGap);
    const traceable = GapRankingService.computeRGQS(traceableGap);

    expect(traceable.components.traceability).toBeGreaterThan(untraceable.components.traceability);
    expect(traceable.rgqs).toBeGreaterThan(untraceable.rgqs);
  });
});
