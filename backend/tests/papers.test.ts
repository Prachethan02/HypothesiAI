/**
 * Stage 5 — Papers API Tests
 * ==========================
 * Tests the paper ingestion endpoints without requiring PostgreSQL or the AI service.
 * Uses supertest against the Express app.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createApp } from '../src/app';
import { PapersService } from '../src/services/papers.service';

const app = createApp();

// ─── Auth helper ─────────────────────────────────────────────────────────────

let authToken = '';

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;
  // Register a test user
  const signupRes = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email: 'papers_test@hypothesiai.test', password: 'StrongPass123!', full_name: 'Paper Tester' });

  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  } else if (signupRes.status === 409) {
    // Already exists — login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'papers_test@hypothesiai.test', password: 'StrongPass123!' });
    authToken = loginRes.body.data?.token ?? '';
  }
  return authToken;
}

// ─── Fixture: minimal valid PDF ───────────────────────────────────────────────

function createMinimalPdf(): Buffer {
  // Minimal valid 1-page PDF (hand-crafted, ~400 bytes)
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

let tmpPdfPath = '';

beforeAll(() => {
  // Mock AI service call
  vi.spyOn(PapersService, 'triggerProcessing').mockResolvedValue({
    paper_id: 'mocked',
    total_pages: 2,
    total_segments: 3,
    sections_detected: ['introduction', 'results'],
    segments: [
      {
        paper_id: 'mocked',
        page_number: 1,
        section_type: 'introduction',
        heading: 'Introduction',
        text: 'This is an introduction paragraph.',
        word_count: 5,
        char_count: 36,
      },
    ],
    warnings: [],
  });

  // Write minimal PDF to a temp file for supertest .attach()
  tmpPdfPath = path.join(os.tmpdir(), `test_paper_${Date.now()}.pdf`);
  fs.writeFileSync(tmpPdfPath, createMinimalPdf());
});

afterAll(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpPdfPath)) fs.unlinkSync(tmpPdfPath);
});

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('Papers API — Stage 5', () => {

  describe('Authentication guard', () => {
    it('GET /papers should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/papers');
      expect(res.status).toBe(401);
    });

    it('POST /papers should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/papers')
        .attach('file', tmpPdfPath, 'paper.pdf');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/papers — upload', () => {
    it('should reject upload with no file', async () => {
      const token = await getAuthToken();
      const res = await request(app)
        .post('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Missing File Paper');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject a non-PDF file', async () => {
      const token = await getAuthToken();
      // Create a .txt temp file
      const txtPath = path.join(os.tmpdir(), 'test_notpdf.txt');
      fs.writeFileSync(txtPath, 'This is not a PDF');
      try {
        const res = await request(app)
          .post('/api/v1/papers')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', txtPath, 'paper.txt');
        // Multer filter or controller should reject it
        expect([400, 422, 500]).toContain(res.status);
      } finally {
        fs.unlinkSync(txtPath);
      }
    });

    it('should accept a valid PDF and return status=uploaded', async () => {
      const token = await getAuthToken();
      const res = await request(app)
        .post('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Attention Is All You Need')
        .attach('file', tmpPdfPath, 'attention.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        title: 'Attention Is All You Need',
        status: 'uploaded',
        mime_type: expect.stringContaining('pdf'),
      });
      expect(res.body.data.id).toBeTruthy();
    });
  });

  describe('GET /api/v1/papers — list', () => {
    it('should return a list of papers', async () => {
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });
  });

  describe('GET /api/v1/papers/:id — detail', () => {
    it('should return 404 for unknown paper ID', async () => {
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/v1/papers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return paper detail for known ID', async () => {
      const token = await getAuthToken();
      // First upload a paper to get an ID
      const uploadRes = await request(app)
        .post('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'BERT Paper Test')
        .attach('file', tmpPdfPath, 'bert.pdf');

      expect(uploadRes.status).toBe(201);
      const paperId = uploadRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/papers/${paperId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paperId);
    });
  });

  describe('GET /api/v1/papers/:id/sections', () => {
    it('should return sections array (empty or populated) for a known paper', async () => {
      const token = await getAuthToken();
      const uploadRes = await request(app)
        .post('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Sections Test Paper')
        .attach('file', tmpPdfPath, 'sections_test.pdf');
      expect(uploadRes.status).toBe(201);
      const paperId = uploadRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/papers/${paperId}/sections`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/v1/papers/:id/status', () => {
    it('should update paper status to processing', async () => {
      const token = await getAuthToken();
      const uploadRes = await request(app)
        .post('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Status Update Test')
        .attach('file', tmpPdfPath, 'status_test.pdf');
      expect(uploadRes.status).toBe(201);
      const paperId = uploadRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/papers/${paperId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'processing' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('processing');
    });

    it('should reject invalid status value', async () => {
      const token = await getAuthToken();
      const uploadRes = await request(app)
        .post('/api/v1/papers')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Invalid Status Test')
        .attach('file', tmpPdfPath, 'invalid_status.pdf');
      expect(uploadRes.status).toBe(201);
      const paperId = uploadRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/papers/${paperId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' });
      expect(patchRes.status).toBe(400);
    });
  });
});
