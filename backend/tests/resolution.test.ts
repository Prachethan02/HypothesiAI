/**
 * Resolution Tests — Stage 8
 * ===========================
 * Integration tests for entity normalization endpoints with in-memory fallback.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

// ─── Shared helpers ──────────────────────────────────────────────────────────

let authToken = '';

async function getToken(): Promise<string> {
  if (authToken) return authToken;
  const email = `resolve-test-${Date.now()}@hypothesiai.test`;
  const signupRes = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'Secure$1234Z!', full_name: 'Resolution Tester' });
  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  }
  return authToken;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Resolution API — Stage 8', () => {

  describe('Auth guard', () => {
    it('POST /api/v1/resolution/resolve — rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/resolution/resolve')
        .send({ entities: [{ text: 'GCN', entity_type: 'method' }] });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/resolution/compare — rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/resolution/compare')
        .send({
          entity_a: { text: 'GCN', entity_type: 'method' },
          entity_b: { text: 'Graph Convolutional Network', entity_type: 'method' },
        });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/resolution/resolve — proxies to AI service', () => {
    it('returns 400 for missing or empty entities array', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/v1/resolution/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ entities: [] });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing entities field', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/v1/resolution/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('passes through AI service errors gracefully (500) when AI service is offline', async () => {
      const token = await getToken();
      // AI service is not running in test env — expect a 500 error (not a crash)
      const res = await request(app)
        .post('/api/v1/resolution/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({
          entities: [
            { id: 'ent-1', text: 'GCN', entity_type: 'method' },
            { id: 'ent-2', text: 'Graph Convolutional Network', entity_type: 'method' },
          ],
        });
      // When AI service is unavailable, we expect a server error (not a crash or 200)
      expect([500, 502, 503]).toContain(res.status);
    });
  });

  describe('POST /api/v1/resolution/compare — proxies to AI service', () => {
    it('returns 400 for missing entity_a or entity_b text', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/v1/resolution/compare')
        .set('Authorization', `Bearer ${token}`)
        .send({ entity_a: {}, entity_b: { text: 'BERT' } });
      expect(res.status).toBe(400);
    });

    it('handles AI service unavailability gracefully (500)', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/v1/resolution/compare')
        .set('Authorization', `Bearer ${token}`)
        .send({
          entity_a: { text: 'BERT', entity_type: 'method' },
          entity_b: { text: 'BART', entity_type: 'method' },
        });
      expect([500, 502, 503]).toContain(res.status);
    });
  });

  describe('GET /api/v1/papers/:id/resolution-audit', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/papers/fake-id/resolution-audit');
      expect(res.status).toBe(401);
    });

    it('returns empty decisions array for a paper with no resolutions', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/v1/papers/nonexistent-paper-id/resolution-audit')
        .set('Authorization', `Bearer ${token}`);
      // Should return 200 with empty decisions (in-memory fallback returns [])
      expect(res.status).toBe(200);
      expect(res.body.decisions).toEqual([]);
      expect(res.body.count).toBe(0);
    });
  });
});
