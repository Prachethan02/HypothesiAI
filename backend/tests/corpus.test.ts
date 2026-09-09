import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { PapersService } from '../src/services/papers.service';

const app = createApp();

let authToken = '';

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;
  const signupRes = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: 'corpus_test@hypothesiai.test',
      password: 'StrongPass123!',
      full_name: 'Corpus Tester',
    });

  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  } else {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'corpus_test@hypothesiai.test',
        password: 'StrongPass123!',
      });
    authToken = loginRes.body.data?.token ?? '';
  }
  return authToken;
}

function createMinimalPdf(): Buffer {
  const content = [
    '%PDF-1.4',
    '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj',
    '2 0 obj<</Type /Pages /Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 612 792]>>endobj',
    'xref',
    '0 4',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000058 00000 n ',
    '0000000115 00000 n ',
    'trailer<</Size 4/Root 1 0 R>>',
    'startxref',
    '190',
    '%%EOF',
  ].join('\n');
  return Buffer.from(content, 'utf-8');
}

beforeAll(() => {
  vi.spyOn(PapersService, 'triggerProcessing').mockResolvedValue({
    paper_id: 'mocked',
    total_pages: 1,
    total_segments: 1,
    sections_detected: ['abstract'],
    segments: [],
    warnings: [],
  });
});

describe('Research Corpus & Batch Multi-PDF Upload (Phase A)', () => {
  let createdCorpusId = '';
  let uploadedPaperId = '';

  it('should reject corpus creation without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/corpora')
      .send({ name: 'Unauthenticated Corpus' });

    expect(res.status).toBe(401);
  });

  it('should create a new research corpus with authentication', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post('/api/v1/corpora')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'LLM Hallucination Benchmarks',
        description: 'Empirical studies exploring factual inaccuracies in generative models.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('LLM Hallucination Benchmarks');
    createdCorpusId = res.body.data.id;
  });

  it('should list corpora for the authenticated user', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .get('/api/v1/corpora')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((c: any) => c.id === createdCorpusId)).toBe(true);
  });

  it('should batch-upload multiple PDFs into the corpus with resilient error handling', async () => {
    const token = await getAuthToken();
    const validPdf1 = createMinimalPdf();
    const validPdf2 = createMinimalPdf();
    const invalidTextFile = Buffer.from('This is not a real PDF file', 'utf-8');

    const res = await request(app)
      .post('/api/v1/papers/batch')
      .set('Authorization', `Bearer ${token}`)
      .field('corpus_id', createdCorpusId)
      .attach('files', validPdf1, { filename: 'hallucination_eval_2024.pdf', contentType: 'application/pdf' })
      .attach('files', validPdf2, { filename: 'factuality_metrics_2023.pdf', contentType: 'application/pdf' })
      .attach('files', invalidTextFile, { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.total).toBe(3);
    expect(res.body.data.summary.succeeded).toBe(2);
    expect(res.body.data.summary.failed).toBe(1);
    expect(res.body.data.uploaded).toHaveLength(2);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].filename).toBe('notes.txt');

    uploadedPaperId = res.body.data.uploaded[0].id;
  });

  it('should get corpus details including the linked papers', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .get(`/api/v1/corpora/${createdCorpusId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdCorpusId);
    expect(res.body.data.papers).toBeDefined();
    expect(res.body.data.papers.length).toBeGreaterThanOrEqual(2);
  });

  it('should remove a paper from a corpus', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .delete(`/api/v1/corpora/${createdCorpusId}/papers/${uploadedPaperId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify paper was detached from corpus
    const getRes = await request(app)
      .get(`/api/v1/corpora/${createdCorpusId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.data.papers.some((p: any) => p.id === uploadedPaperId)).toBe(false);
  });

  it('should link an existing paper to a corpus via POST /corpora/:id/papers', async () => {
    const token = await getAuthToken();
    // Re-create a corpus
    const createRes = await request(app)
      .post('/api/v1/corpora')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Academic Search Linking Test' });

    const newCorpusId = createRes.body.data.id;

    // Link paper
    const linkRes = await request(app)
      .post(`/api/v1/corpora/${newCorpusId}/papers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paper_id: uploadedPaperId, source: 'academic_search' });

    expect(linkRes.status).toBe(201);
    expect(linkRes.body.success).toBe(true);
    expect(linkRes.body.data.corpus_id).toBe(newCorpusId);
    expect(linkRes.body.data.paper_id).toBe(uploadedPaperId);
  });

  it('should trigger corpus analysis orchestration via POST /corpora/:id/analyze and poll status', async () => {
    const token = await getAuthToken();
    const createRes = await request(app)
      .post('/api/v1/corpora')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Orchestration Test Corpus' });

    const testCorpusId = createRes.body.data.id;

    // Cannot analyze empty corpus
    const emptyAnalyzeRes = await request(app)
      .post(`/api/v1/corpora/${testCorpusId}/analyze`)
      .set('Authorization', `Bearer ${token}`);
    expect(emptyAnalyzeRes.status).toBe(422);

    // Link a paper to it
    await request(app)
      .post(`/api/v1/corpora/${testCorpusId}/papers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paper_id: uploadedPaperId });

    // Now analyze
    const analyzeRes = await request(app)
      .post(`/api/v1/corpora/${testCorpusId}/analyze`)
      .set('Authorization', `Bearer ${token}`);
    expect(analyzeRes.status).toBe(202);
    expect(analyzeRes.body.success).toBe(true);

    // Check status
    const statusRes = await request(app)
      .get(`/api/v1/corpora/${testCorpusId}/analysis-status`)
      .set('Authorization', `Bearer ${token}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.data.corpus_id).toBe(testCorpusId);
  });

  it('should support academic search through arXiv proxy via GET /search/academic', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .get('/api/v1/search/academic')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'attention transformer', limit: 3 });

    // Should return 200 with search results or 502 if arXiv network is unreachable in test env
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('arxiv');
      expect(Array.isArray(res.body.data.results)).toBe(true);
    }
  });

  it('should delete a corpus', async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .delete(`/api/v1/corpora/${createdCorpusId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Confirm it returns 404 now
    const checkRes = await request(app)
      .get(`/api/v1/corpora/${createdCorpusId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(checkRes.status).toBe(404);
  });
});

