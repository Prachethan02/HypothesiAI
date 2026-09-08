/**
 * ResolutionService — Stage 8
 * ============================
 * Bridges the Node.js backend with the Python AI service entity resolution endpoint.
 * Handles batch normalization, pair comparison, and audit trail persistence.
 */
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  PapersService,
  ExtractedEntityRecord,
  ResolutionDecisionRecord,
} from './papers.service';

export interface ResolutionConfig {
  rapidfuzz_token_sort_threshold?: number;
  rapidfuzz_ratio_threshold?: number;
  semantic_cosine_threshold?: number;
  hybrid_min_confidence?: number;
  rapidfuzz_weight?: number;
  semantic_weight?: number;
  require_type_match?: boolean;
  enable_acronym_matching?: boolean;
}

export interface ResolvedEntity {
  original_id?: string | null;
  original_text: string;
  canonical_entity: string;
  entity_type: string;
  similarity_score: number;
  resolution_method: string;
  confidence: number;
  decision_id: string;
  aliases: string[];
}

export interface ResolutionResult {
  resolved_entities: ResolvedEntity[];
  unique_canonical_count: number;
  merged_count: number;
  audit_trail: ResolutionDecisionRecord[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ResolutionService {
  private static readonly aiServiceUrl = `${config.AI_SERVICE_URL}/api/v1/resolution`;

  /**
   * Resolve a batch of entities via the Python AI service.
   */
  static async resolveEntities(
    entities: Array<{ id?: string; text: string; entity_type: string; embedding?: number[] | null }>,
    resolutionConfig?: ResolutionConfig
  ): Promise<ResolutionResult> {
    const payload: Record<string, unknown> = { entities };
    if (resolutionConfig) payload.config = resolutionConfig;

    try {
      const res = await axios.post<any>(`${this.aiServiceUrl}/resolve`, payload, { timeout: 30000 });
      const data = res.data;

      const audit: ResolutionDecisionRecord[] = (data.audit_trail ?? []).map((dec: any) => ({
        id: dec.decision_id,
        decision_id: dec.decision_id,
        original_text: dec.original_text,
        candidate_text: dec.candidate_text ?? null,
        canonical_entity: dec.canonical_entity,
        entity_type: dec.entity_type ?? null,
        similarity_score: dec.similarity_score,
        resolution_method: dec.resolution_method,
        confidence: dec.confidence,
        decision: dec.decision,
        rationale: dec.rationale ?? null,
        metrics: dec.metrics ?? {},
        paper_id: null,
        created_at: new Date(),
      }));

      return {
        resolved_entities: data.resolved_entities ?? [],
        unique_canonical_count: data.unique_canonical_count ?? 0,
        merged_count: data.merged_count ?? 0,
        audit_trail: audit,
      };
    } catch (err: any) {
      logger.error('Entity resolution AI service call failed', err?.message);
      throw new Error(`Resolution service error: ${err?.message ?? 'unknown'}`);
    }
  }

  /**
   * Full pipeline: fetch paper entities, resolve, persist normalized names, store audit trail.
   */
  static async resolvePaperEntities(
    paperId: string,
    resolutionConfig?: ResolutionConfig
  ): Promise<ResolutionResult> {
    const entities: ExtractedEntityRecord[] = await PapersService.getEntitiesByPaperId(paperId);

    if (!entities.length) {
      logger.warn(`No extracted entities found for paper ${paperId}. Run extraction first.`);
      return { resolved_entities: [], unique_canonical_count: 0, merged_count: 0, audit_trail: [] };
    }

    logger.info(`Resolving ${entities.length} entities for paper_id=${paperId}`);

    const entityPayload = entities.map((e) => ({
      id: e.id,
      text: e.text,
      entity_type: e.entity_type,
      embedding: (e.metadata?.embedding as number[] | null) ?? null,
    }));

    const result = await this.resolveEntities(entityPayload, resolutionConfig);

    // Persist canonical names back to extracted_entities
    const updatePromises: Promise<void>[] = [];
    for (const resolved of result.resolved_entities) {
      if (resolved.original_id) {
        updatePromises.push(
          PapersService.updateEntityNormalizedName(resolved.original_id, resolved.canonical_entity)
        );
      }
    }
    await Promise.allSettled(updatePromises);
    logger.info(`Updated canonical names for ${updatePromises.length} entities (paper_id=${paperId})`);

    // Persist audit trail decisions
    const decisionsToStore: ResolutionDecisionRecord[] = result.audit_trail.map((d) => ({
      ...d,
      paper_id: paperId,
    }));
    await PapersService.insertResolutionDecisions(paperId, decisionsToStore);
    logger.info(
      `Stored ${decisionsToStore.length} resolution decisions for paper_id=${paperId}: ` +
      `${result.merged_count} merged into ${result.unique_canonical_count} canonical concepts`
    );

    return result;
  }

  /**
   * Compare a single pair of entities through the Python AI service.
   */
  static async comparePair(
    entityA: { text: string; entity_type: string; embedding?: number[] | null },
    entityB: { text: string; entity_type: string; embedding?: number[] | null },
    resolutionConfig?: ResolutionConfig
  ): Promise<{
    should_merge: boolean;
    canonical_entity: string;
    similarity_score: number;
    resolution_method: string;
    confidence: number;
    decision: ResolutionDecisionRecord;
  }> {
    const payload: Record<string, unknown> = { entity_a: entityA, entity_b: entityB };
    if (resolutionConfig) payload.config = resolutionConfig;

    const res = await axios.post<any>(`${this.aiServiceUrl}/compare`, payload, { timeout: 10000 });
    const data = res.data;
    const dec = data.decision;

    return {
      should_merge: data.should_merge,
      canonical_entity: data.canonical_entity,
      similarity_score: data.similarity_score,
      resolution_method: data.resolution_method,
      confidence: data.confidence,
      decision: {
        id: dec.decision_id,
        decision_id: dec.decision_id,
        original_text: dec.original_text,
        candidate_text: dec.candidate_text ?? null,
        canonical_entity: dec.canonical_entity,
        entity_type: dec.entity_type ?? null,
        similarity_score: dec.similarity_score,
        resolution_method: dec.resolution_method,
        confidence: dec.confidence,
        decision: dec.decision,
        rationale: dec.rationale ?? null,
        metrics: dec.metrics ?? {},
        paper_id: null,
        created_at: new Date(),
      },
    };
  }
}
