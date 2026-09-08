/**
 * Stage 6 — Information Extraction API Tests
 * ==========================================
 * Tests structured entity extraction endpoints, storage, and retrieval.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
      email: 'extraction_tester@hypothesiai.test',
      password: 'StrongPass123!',
      full_name: 'Extraction Tester',
    });

  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  } else if (signupRes.status === 409) {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'extraction_tester@hypothesiai.test', password: 'StrongPass123!' });
    authToken = loginRes.body.data?.token ?? '';
  }
  return authToken;
}

describe('Structured Extraction API — Stage 6', () => {
  let paperId = '';

  beforeAll(async () => {
    // Create a paper record for extraction tests
    const paper = await PapersService.createPaper({
      title: 'Extraction Benchmark Paper',
      originalFilename: 'benchmark.pdf',
      storageKey: 'papers/benchmark/benchmark.pdf',
      fileUrl: '/uploads/papers/benchmark/benchmark.pdf',
      fileSizeBytes: 10240,
      mimeType: 'application/pdf',
    });
    paperId = paper.id;

    // Store sample parsed sections for the paper
    await PapersService.storeSections(paperId, [
      {
        paper_id: paperId,
        page_number: 1,
        section_type: 'methods',
        heading: 'Methodology',
        text: 'We apply the Transformer architecture and evaluate on the GLUE benchmark.',
        word_count: 11,
        char_count: 73,
      },
      {
        paper_id: paperId,
        page_number: 2,
        section_type: 'limitations',
        heading: 'Limitations',
        text: 'A key limitation is high GPU memory requirements.',
        word_count: 8,
        char_count: 49,
      },
    ]);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication guard', () => {
    it('GET /papers/:id/entities should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/v1/papers/${paperId}/entities`);
      expect(res.status).toBe(401);
    });

    it('POST /papers/:id/extract should reject unauthenticated requests', async () => {
      const res = await request(app).post(`/api/v1/papers/${paperId}/extract`);
      expect(res.status).toBe(401);
    });
  });

  describe('Entity storage and retrieval', () => {
    it('should store and retrieve entities with full provenance', async () => {
      const token = await getAuthToken();

      // Directly store sample entities
      await PapersService.storeEntities(paperId, [
        {
          entity_type: 'method',
          text: 'Transformer',
          normalized_name: 'Transformer',
          confidence: 0.94,
          page_number: 1,
          section: 'methods',
          source_reference: 'Section: Methods, Page 1',
        },
        {
          entity_type: 'dataset',
          text: 'GLUE benchmark',
          normalized_name: 'glue benchmark',
          confidence: 0.89,
          page_number: 1,
          section: 'methods',
          source_reference: 'Section: Methods, Page 1',
        },
        {
          entity_type: 'limitation',
          text: 'high GPU memory requirements',
          normalized_name: 'high gpu memory requirements',
          confidence: 0.91,
          page_number: 2,
          section: 'limitations',
          source_reference: 'Section: Limitations, Page 2',
        },
      ]);

      const res = await request(app)
        .get(`/api/v1/papers/${paperId}/entities`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(3);

      const types = res.body.data.map((e: any) => e.entity_type);
      expect(types).toContain('method');
      expect(types).toContain('dataset');
      expect(types).toContain('limitation');

      // Verify provenance fields on an entity
      const methodEntity = res.body.data.find((e: any) => e.entity_type === 'method');
      expect(methodEntity.paper_id).toBe(paperId);
      expect(methodEntity.page_number).toBe(1);
      expect(methodEntity.text).toBe('Transformer');
      expect(methodEntity.source_reference).toBe('Section: Methods, Page 1');
      expect(methodEntity.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('POST /api/v1/papers/:id/extract', () => {
    it('should trigger extraction and return structured entities', async () => {
      const token = await getAuthToken();

      // Spy on triggerExtraction to avoid network call to AI service
      vi.spyOn(PapersService, 'triggerExtraction').mockResolvedValueOnce([
        {
          id: 'ent-1',
          paper_id: paperId,
          section_id: null,
          entity_type: 'method',
          text: 'Graph Convolutional Network',
          normalized_name: 'gcn',
          confidence: 0.95,
          page_number: 1,
          source_reference: 'Section: Methods, Page 1',
          metadata: {},
          created_at: new Date(),
        },
        {
          id: 'ent-2',
          paper_id: paperId,
          section_id: null,
          entity_type: 'objective',
          text: 'Our primary objective is to improve node classification',
          normalized_name: 'improve node classification',
          confidence: 0.88,
          page_number: 1,
          source_reference: 'Section: Introduction, Page 1',
          metadata: {},
          created_at: new Date(),
        },
      ]);

      const res = await request(app)
        .post(`/api/v1/papers/${paperId}/extract`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(2);
      expect(res.body.data[0].text).toBe('Graph Convolutional Network');
      expect(res.body.data[1].entity_type).toBe('objective');
    });
  });
});
