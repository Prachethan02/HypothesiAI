/**
 * Graph Service Tests — Stage 9
 * =============================
 * Tests the Neo4j API endpoints and fallback in-memory graph store.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { PapersService } from '../src/services/papers.service';
import { GraphService } from '../src/services/graph.service';

const app = createApp();
let authToken = '';
let testPaperId = '';

async function getToken(): Promise<string> {
  if (authToken) return authToken;
  const email = `graph-test-${Date.now()}@hypothesiai.test`;
  const signupRes = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'Secure$1234Z!', full_name: 'Graph Tester' });
  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  }
  return authToken;
}

describe('Knowledge Graph API — Stage 9', () => {
  beforeAll(async () => {
    // Need a dummy paper to test graph syncing
    const paper = await PapersService.createPaper({
      title: 'Graph Theory in Neural Nets',
      originalFilename: 'graph_theory.pdf',
      storageKey: 'papers/graph/theory.pdf',
      fileUrl: '/uploads/papers/graph/theory.pdf',
      fileSizeBytes: 12345,
      mimeType: 'application/pdf',
    });
    testPaperId = paper.id;
    
    // Trigger mock extraction so the paper has entities to sync
    await PapersService.triggerExtraction(testPaperId);
  });

  describe('Auth Guard', () => {
    it('rejects unauthenticated requests to sync', async () => {
      const res = await request(app).post(`/api/v1/graph/sync/${testPaperId}`);
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to visualize', async () => {
      const res = await request(app).get('/api/v1/graph/visualize');
      expect(res.status).toBe(401);
    });
  });

  describe('Graph API Functionality (In-Memory Fallback)', () => {
    it('POST /api/v1/graph/sync/:paperId syncs paper entities to graph', async () => {
      const token = await getToken();
      const res = await request(app)
        .post(`/api/v1/graph/sync/${testPaperId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('synced to graph');
    });

    it('GET /api/v1/graph/stats retrieves basic graph statistics', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/v1/graph/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.nodes).toBe('number');
      expect(typeof res.body.data.relationships).toBe('number');
      
      // Since we synced a paper with entities, nodes should be > 0
      expect(res.body.data.nodes).toBeGreaterThan(0);
    });

    it('GET /api/v1/graph/visualize retrieves nodes and links', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/v1/graph/visualize')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(Array.isArray(res.body.links)).toBe(true);
      
      // Verify node format
      if (res.body.nodes.length > 0) {
        expect(res.body.nodes[0]).toHaveProperty('id');
        expect(res.body.nodes[0]).toHaveProperty('label');
        expect(res.body.nodes[0]).toHaveProperty('title');
      }

      // Verify link format
      if (res.body.links.length > 0) {
        expect(res.body.links[0]).toHaveProperty('source');
        expect(res.body.links[0]).toHaveProperty('target');
        expect(res.body.links[0]).toHaveProperty('label');
      }
    });
  });
});
