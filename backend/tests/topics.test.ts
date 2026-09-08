import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { PapersService } from '../src/services/papers.service';

const app = createApp();
let authToken = '';

async function getToken(): Promise<string> {
  if (authToken) return authToken;
  const email = `topics-test-${Date.now()}@hypothesiai.test`;
  const signupRes = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'Secure$1234Z!', full_name: 'Topic Tester' });
  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  }
  return authToken;
}

describe('Topic Modeling API — Stage 10', () => {
  beforeAll(async () => {
    const paper = await PapersService.createPaper({
      title: 'Topic Modeling Theory',
      originalFilename: 'topics.pdf',
      storageKey: 'papers/topics/test.pdf',
      fileUrl: '/uploads/papers/topics/test.pdf',
      fileSizeBytes: 2222,
      mimeType: 'application/pdf',
    });
    await PapersService.triggerExtraction(paper.id);
  });

  describe('Auth Guard', () => {
    it('rejects unauthenticated requests to generate topics', async () => {
      const res = await request(app).post('/api/v1/topics/generate');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to get topics', async () => {
      const res = await request(app).get('/api/v1/topics');
      expect(res.status).toBe(401);
    });
  });

  describe('Topic Generation', () => {
    it('POST /api/v1/topics/generate triggers topic modeling (fallback to mock)', async () => {
      const token = await getToken();
      const res = await request(app)
        .post('/api/v1/topics/generate')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('completed');
    });

    it('GET /api/v1/topics retrieves the latest topic run', async () => {
      const token = await getToken();
      const res = await request(app)
        .get('/api/v1/topics')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('run');
      expect(res.body.data).toHaveProperty('topics');
      expect(Array.isArray(res.body.data.topics)).toBe(true);
      if (res.body.data.topics.length > 0) {
        expect(res.body.data.topics[0]).toHaveProperty('name');
        expect(res.body.data.topics[0]).toHaveProperty('frequency');
      }
    });
  });
});
