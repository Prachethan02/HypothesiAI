/**
 * EmbeddingsService — Stage 7
 * ===========================
 * Reusable backend service for generating semantic embeddings and evaluating
 * cosine similarity via the Python AI service (Sentence-Transformer MiniLM).
 *
 * Implements batching, entity embedding association, and PostgreSQL pgvector-compatible storage.
 */
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PapersService } from './papers.service';

export interface GeneratedEmbeddingItem {
  id?: string;
  text: string;
  embedding: number[];
  embedding_id: string;
  dimension: number;
  normalized: boolean;
}

export interface BatchEmbeddingResponse {
  model_name: string;
  dimension: number;
  embeddings: GeneratedEmbeddingItem[];
  total_items: number;
  cache_hits: number;
  computed: number;
}

export interface SimilarityMatch {
  index: number;
  text?: string;
  score: number;
}

export interface SimilarityResponse {
  matches: SimilarityMatch[];
  top_k: number;
}

export interface PaperEmbedResult {
  paperId: string;
  totalEmbedded: number;
  dimension: number;
  modelName: string;
  cacheHits: number;
}

export class EmbeddingsService {
  /**
   * Generate 384-dimensional normalized semantic embeddings for a batch of strings.
   */
  static async embedTexts(
    texts: string[],
    options?: { batchSize?: number; normalize?: boolean },
  ): Promise<BatchEmbeddingResponse> {
    if (!texts.length) {
      return {
        model_name: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        embeddings: [],
        total_items: 0,
        cache_hits: 0,
        computed: 0,
      };
    }

    const url = `${config.AI_SERVICE_URL}/api/v1/embeddings/generate`;
    logger.info(`Requesting batch embeddings: items=${texts.length}  url=${url}`);

    const response = await axios.post<BatchEmbeddingResponse>(
      url,
      {
        texts,
        batch_size: options?.batchSize ?? 32,
        normalize: options?.normalize ?? true,
      },
      { timeout: 120_000 },
    );

    return response.data;
  }

  /**
   * Evaluate cosine similarity between a query text and candidate texts.
   */
  static async computeSimilarity(
    queryText: string,
    candidateTexts: string[],
    topK = 5,
  ): Promise<SimilarityResponse> {
    const url = `${config.AI_SERVICE_URL}/api/v1/embeddings/similarity`;
    logger.info(`Evaluating cosine similarity: candidates=${candidateTexts.length}  url=${url}`);

    const response = await axios.post<SimilarityResponse>(
      url,
      {
        query_text: queryText,
        candidate_texts: candidateTexts,
        top_k: topK,
      },
      { timeout: 60_000 },
    );

    return response.data;
  }

  /**
   * Generate and persist semantic embeddings for all extracted entities,
   * limitations, future-work statements, and findings of a paper.
   */
  static async embedPaperEntities(paperId: string): Promise<PaperEmbedResult> {
    const entities = await PapersService.getEntitiesByPaperId(paperId);

    if (!entities.length) {
      logger.warn(`No entities found to embed for paper_id=${paperId}`);
      return {
        paperId,
        totalEmbedded: 0,
        dimension: 384,
        modelName: 'sentence-transformers/all-MiniLM-L6-v2',
        cacheHits: 0,
      };
    }

    logger.info(`Embedding ${entities.length} entities/claims for paper_id=${paperId}`);

    // Extract texts to embed
    const texts = entities.map((e) => e.text);

    // Call AI embedding service with batch processing
    const batchRes = await EmbeddingsService.embedTexts(texts, { batchSize: 32, normalize: true });

    // Associate generated embeddings back to entity records
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const embItem = batchRes.embeddings[i];
      if (embItem) {
        await PapersService.updateEntityEmbedding(
          entity.id,
          embItem.embedding_id,
          embItem.embedding,
        );
      }
    }

    logger.info(
      `Successfully embedded paper_id=${paperId}: count=${entities.length}  cache_hits=${batchRes.cache_hits}`,
    );

    return {
      paperId,
      totalEmbedded: entities.length,
      dimension: batchRes.dimension,
      modelName: batchRes.model_name,
      cacheHits: batchRes.cache_hits,
    };
  }
}
