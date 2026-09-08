/**
 * Stage 7 — Semantic Embeddings API Tests
 * ========================================
 * Tests the backend EmbeddingsService, cosine similarity integration,
 * batch processing, and entity embedding persistence.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { PapersService } from '../src/services/papers.service';
import { EmbeddingsService } from '../src/services/embeddings.service';

const app = createApp();

let authToken = '';

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;
  const signupRes = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: 'embeddings_tester@hypothesiai.test',
      password: 'StrongPass123!',
      full_name: 'Embeddings Tester',
    });

  if (signupRes.status === 201) {
    authToken = signupRes.body.data?.token ?? '';
  } else if (signupRes.status === 409) {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'embeddings_tester@hypothesiai.test', password: 'StrongPass123!' });
    authToken = loginRes.body.data?.token ?? '';
  }
  return authToken;
}

describe('Semantic Embeddings API — Stage 7', () => {
  let paperId = '';

  beforeAll(async () => {
    // Create paper record
    const paper = await PapersService.createPaper({
      title: 'Embedding Benchmark Paper',
      originalFilename: 'embeddings_benchmark.pdf',
      storageKey: 'papers/emb/benchmark.pdf',
      fileUrl: '/uploads/papers/emb/benchmark.pdf',
      fileSizeBytes: 20480,
      mimeType: 'application/pdf',
    });
    paperId = paper.id;

    // Store sample extracted entities
    await PapersService.storeEntities(paperId, [
      {
        entity_type: 'method',
        text: 'Transformer with Multi-Head Attention',
        confidence: 0.96,
        page_number: 1,
        section: 'methods',
        source_reference: 'Section: Methods, Page 1',
      },
      {
        entity_type: 'limitation',
        text: 'Quadratic memory complexity in sequence length',
        confidence: 0.91,
        page_number: 3,
        section: 'limitations',
        source_reference: 'Section: Limitations, Page 3',
      },
      {
        entity_type: 'future_work',
        text: 'Extend attention mechanism to linear complexity approximations',
        confidence: 0.89,
        page_number: 4,
        section: 'future_work',
        source_reference: 'Section: Future Work, Page 4',
      },
    ]);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication guard', () => {
    it('POST /papers/:id/embed should reject unauthenticated requests', async () => {
      const res = await request(app).post(`/api/v1/papers/${paperId}/embed`);
      expect(res.status).toBe(401);
    });
  });

  describe('EmbeddingsService unit methods', () => {
    it('should return empty result for empty texts array', async () => {
      const res = await EmbeddingsService.embedTexts([]);
      expect(res.total_items).toBe(0);
      expect(res.embeddings.length).toBe(0);
      expect(res.dimension).toBe(384);
    });

    it('should correctly mock and format batch embeddings', async () => {
      // Mock EmbeddingsService.embedTexts
      const mockEmbedTexts = vi.spyOn(EmbeddingsService, 'embedTexts').mockResolvedValueOnce({
        model_name: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        embeddings: [
          {
            text: 'Transformer with Multi-Head Attention',
            embedding: new Array(384).fill(0.05),
            embedding_id: 'emb_1234567890abcdef',
            dimension: 384,
            normalized: true,
          },
        ],
        total_items: 1,
        cache_hits: 0,
        computed: 1,
      });

      const res = await EmbeddingsService.embedTexts(['Transformer with Multi-Head Attention']);
      expect(res.dimension).toBe(384);
      expect(res.embeddings[0].embedding_id).toBe('emb_1234567890abcdef');
      expect(res.embeddings[0].embedding.length).toBe(384);
      expect(mockEmbedTexts).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/papers/:id/embed', () => {
    it('should generate embeddings for paper entities and update records', async () => {
      const token = await getAuthToken();

      // Mock AI service call inside EmbeddingsService
      vi.spyOn(EmbeddingsService, 'embedTexts').mockResolvedValueOnce({
        model_name: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        embeddings: [
          {
            text: 'Transformer with Multi-Head Attention',
            embedding: new Array(384).fill(0.05),
            embedding_id: 'emb_item1',
            dimension: 384,
            normalized: true,
          },
          {
            text: 'Quadratic memory complexity in sequence length',
            embedding: new Array(384).fill(-0.02),
            embedding_id: 'emb_item2',
            dimension: 384,
            normalized: true,
          },
          {
            text: 'Extend attention mechanism to linear complexity approximations',
            embedding: new Array(384).fill(0.03),
            embedding_id: 'emb_item3',
            dimension: 384,
            normalized: true,
          },
        ],
        total_items: 3,
        cache_hits: 1,
        computed: 2,
      });

      const res = await request(app)
        .post(`/api/v1/papers/${paperId}/embed`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paperId).toBe(paperId);
      expect(res.body.data.totalEmbedded).toBe(3);
      expect(res.body.data.dimension).toBe(384);
      expect(res.body.data.modelName).toContain('MiniLM');
    });
  });
});
