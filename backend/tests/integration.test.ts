/**
 * End-to-End Cross-Tier Integration Test Suite — Stage 21
 * =======================================================
 * Validates the complete pipeline integration across:
 *   Frontend API contract -> Node Backend -> Python AI Service -> Data Store / Graph
 *
 * Flow:
 *   1. Authentication (Signup & JWT issuance)
 *   2. Paper Registration & Section Segmentation
 *   3. Entity Extraction & Provenance
 *   4. Knowledge Graph Sync, Query & Topological Statistics
 *   5. Topic Modeling Run
 *   6. Pattern Mining (FP-Growth / Apriori itemsets & underexplored combinations)
 *   7. Evidence Aggregation & Multi-Signal Scoring
 *   8. Research Gap Ranking with 9-Dimension Breakdown
 *   9. Evidence-Grounded Hypothesis Generation & Regeneration
 *  10. Global Research Search (Federated cross-entity)
 *  11. Research Intelligence System Health & Aggregated Dashboard
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { PapersService } from '../src/services/papers.service';

const app = createApp();
let token = '';
let paperId = '';
let gapId = '';
let hypothesisId = '';

describe('Tier-to-Tier Integration Pipeline (Stage 21)', () => {
  // ─── 1. Authentication ───────────────────────────────────────────────────────
  it('Tier 1: Authenticates researcher and issues verifiable JWT', async () => {
    const email = `integration-suite-${Date.now()}@hypothesiai.test`;
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email,
        password: 'SuperSecret1234$!',
        full_name: 'Lead Investigator',
        role: 'researcher',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    token = res.body.data.token;
  });

  // ─── 2. Paper Ingestion & Provenance ─────────────────────────────────────────
  it('Tier 2: Ingests paper and registers sections with source traceability', async () => {
    const paper = await PapersService.createPaper({
      title: 'Attention Bottlenecks in Deep Graph Neural Networks',
      abstract: 'Graph transformers exhibit quadratic memory growth preventing scaling to dense biological networks.',
      originalFilename: 'gnn_bottlenecks.pdf',
      storageKey: 'papers/integration/gnn_bottlenecks.pdf',
      fileUrl: '/uploads/papers/integration/gnn_bottlenecks.pdf',
      fileSizeBytes: 45678,
      mimeType: 'application/pdf',
      publicationYear: 2025,
      authors: ['A. Vaswani', 'Y. LeCun'],
    });

    paperId = paper.id;
    expect(paperId).toBeDefined();

    // Trigger extraction
    await PapersService.triggerExtraction(paperId);

    const secRes = await request(app)
      .get(`/api/v1/papers/${paperId}/sections`)
      .set('Authorization', `Bearer ${token}`);

    expect(secRes.status).toBe(200);
    expect(secRes.body.success).toBe(true);
    expect(Array.isArray(secRes.body.data)).toBe(true);
  });

  // ─── 3. Knowledge Graph Sync & Exploration ──────────────────────────────────
  it('Tier 3: Synchronizes extracted entities into Knowledge Graph and returns metrics', async () => {
    const syncRes = await request(app)
      .post(`/api/v1/graph/sync/${paperId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);

    const statsRes = await request(app)
      .get('/api/v1/graph/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.nodes).toBeGreaterThan(0);

    const vizRes = await request(app)
      .get('/api/v1/graph/visualize')
      .set('Authorization', `Bearer ${token}`);

    expect(vizRes.status).toBe(200);
    expect(Array.isArray(vizRes.body.nodes)).toBe(true);
    expect(Array.isArray(vizRes.body.links)).toBe(true);
  });

  // ─── 4. Topic Modeling ───────────────────────────────────────────────────────
  it('Tier 4: Triggers semantic topic modeling and retrieves active topics', async () => {
    const genRes = await request(app)
      .post('/api/v1/topics/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(genRes.status).toBe(200);
    expect(genRes.body.success).toBe(true);
    expect(genRes.body.data.status).toBe('completed');

    const listRes = await request(app)
      .get('/api/v1/topics')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
  });

  // ─── 5. Pattern Mining ───────────────────────────────────────────────────────
  it('Tier 5: Runs pattern mining to detect frequent itemsets & underexplored combos', async () => {
    const mineRes = await request(app)
      .post('/api/v1/patterns/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ min_support: 0.1, min_confidence: 0.2 });

    expect(mineRes.status).toBe(200);
    expect(mineRes.body.success).toBe(true);
    expect(mineRes.body.data).toHaveProperty('run_id');
  });

  // ─── 6. Evidence Aggregation & Gap Ranking ──────────────────────────────────
  it('Tier 6: Aggregates multi-signal evidence and generates ranked candidate research gaps', async () => {
    const aggRes = await request(app)
      .post('/api/v1/evidence/aggregate')
      .set('Authorization', `Bearer ${token}`)
      .send({ min_score: 0.1 });

    expect(aggRes.status).toBe(200);
    expect(aggRes.body.success).toBe(true);

    const gapsRes = await request(app)
      .get('/api/v1/research-gaps')
      .set('Authorization', `Bearer ${token}`);

    expect(gapsRes.status).toBe(200);
    expect(gapsRes.body.success).toBe(true);
    expect(Array.isArray(gapsRes.body.data)).toBe(true);

    if (gapsRes.body.data.length > 0) {
      gapId = gapsRes.body.data[0].id;
      const detailRes = await request(app)
        .get(`/api/v1/research-gaps/${gapId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data).toHaveProperty('composite_score');
      expect(detailRes.body.data).toHaveProperty('dimensions');
      expect(detailRes.body.data).toHaveProperty('source_papers');
    }
  });

  // ─── 7. Grounded Hypothesis Generation ───────────────────────────────────────
  it('Tier 7: Generates evidence-grounded hypothesis proposals and allows regeneration', async () => {
    // Generate hypothesis for candidate gap
    const genRes = await request(app)
      .post('/api/v1/hypotheses/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gap_id: gapId || '00000000-0000-0000-0000-000000000001',
      });

    expect(genRes.status).toBe(200);
    expect(genRes.body.success).toBe(true);
    expect(genRes.body.data).toHaveProperty('hypothesis');
    expect(genRes.body.data).toHaveProperty('evidence_bundle');

    hypothesisId = genRes.body.data.id || genRes.body.data.hypothesis_id;

    // Retrieve by ID
    const getRes = await request(app)
      .get(`/api/v1/hypotheses/${hypothesisId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id || getRes.body.data.hypothesis_id).toBe(hypothesisId);

    // Regenerate
    const regenRes = await request(app)
      .post(`/api/v1/hypotheses/${hypothesisId}/regenerate`)
      .set('Authorization', `Bearer ${token}`);

    expect(regenRes.status).toBe(200);
    expect(regenRes.body.success).toBe(true);
  });

  // ─── 8. Global Research Search ───────────────────────────────────────────────
  it('Tier 8: Federated search queries across papers, methods, topics, and hypotheses', async () => {
    const searchRes = await request(app)
      .get('/api/v1/search?q=Graph&type=all')
      .set('Authorization', `Bearer ${token}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.success).toBe(true);
    expect(searchRes.body.data).toHaveProperty('total');
    expect(searchRes.body.data).toHaveProperty('results');
  });

  // ─── 9. Intelligence Dashboard & System Health ──────────────────────────────
  it('Tier 9: Computes live dashboard metrics with cross-stage distribution charts', async () => {
    const dashRes = await request(app)
      .get('/api/v1/intelligence/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.success).toBe(true);
    expect(dashRes.body.data).toHaveProperty('stats');
    expect(dashRes.body.data).toHaveProperty('charts');
    expect(dashRes.body.data).toHaveProperty('graph');

    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
  });
});
