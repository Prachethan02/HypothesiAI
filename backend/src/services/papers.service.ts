/**
 * PapersService — Stage 5
 * =======================
 * Manages paper records and coordinates with the Python AI service.
 *
 * Uses PostgreSQL when available; falls back to an in-memory store
 * (same pattern as AuthService) so the backend works standalone.
 */
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { pgPool } from '../db/postgres';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { PaperStatus, EntityType } from '../db/types';

// ─── Public shapes ───────────────────────────────────────────────────────────

export interface CreatePaperInput {
  userId?: string;
  title: string;
  originalFilename: string;
  storageKey: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface PaperRecord {
  id: string;
  user_id?: string | null;
  title: string;
  doi?: string | null;
  authors: Array<{ name: string; affiliation?: string }>;
  publication_year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  file_url: string;
  storage_key: string;
  file_size_bytes: number;
  mime_type: string;
  total_pages?: number | null;
  status: PaperStatus;
  error_message?: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface PaperSectionRecord {
  id: string;
  paper_id: string;
  section_type: string;
  heading?: string | null;
  content: string;
  page_start: number;
  page_end: number;
  sequence_order: number;
  word_count: number;
  char_count: number;
  created_at: Date;
}

export interface ProcessingResult {
  paper_id: string;
  total_pages: number;
  total_segments: number;
  sections_detected: string[];
  segments: Array<{
    paper_id: string;
    page_number: number;
    section_type: string;
    heading?: string | null;
    text: string;
    word_count: number;
    char_count: number;
  }>;
  warnings: string[];
}

export interface ExtractedEntityRecord {
  id: string;
  paper_id: string;
  section_id?: string | null;
  entity_type: EntityType;
  text: string;
  normalized_name?: string | null;
  confidence: number;
  page_number?: number | null;
  source_reference?: string | null;
  embedding_id?: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface ResolutionDecisionRecord {
  id: string;
  decision_id: string;
  original_text: string;
  candidate_text?: string | null;
  canonical_entity: string;
  entity_type?: string | null;
  similarity_score: number;
  resolution_method: string;
  confidence: number;
  decision: 'merged' | 'rejected' | 'new_canonical';
  rationale?: string | null;
  metrics?: Record<string, any>;
  paper_id?: string | null;
  created_at: Date;
}

// ─── In-memory fallback stores ────────────────────────────────────────────────

const inMemoryPapers: Map<string, PaperRecord> = new Map();
const inMemorySections: Map<string, PaperSectionRecord[]> = new Map();
const inMemoryEntities: Map<string, ExtractedEntityRecord[]> = new Map();
const inMemoryResolutionDecisions: Map<string, ResolutionDecisionRecord[]> = new Map();


// ─── Service ──────────────────────────────────────────────────────────────────

export class PapersService {
  /**
   * Create a new paper record.
   * Returns the created record with status='uploaded'.
   */
  static async createPaper(input: CreatePaperInput): Promise<PaperRecord> {
    const id = uuidv4();
    const now = new Date();

    const paper: PaperRecord = {
      id,
      user_id: input.userId ?? null,
      title: input.title,
      doi: null,
      authors: [],
      publication_year: null,
      venue: null,
      abstract: null,
      file_url: input.fileUrl,
      storage_key: input.storageKey,
      file_size_bytes: input.fileSizeBytes,
      mime_type: input.mimeType,
      total_pages: null,
      status: 'uploaded',
      error_message: null,
      metadata: { original_filename: input.originalFilename },
      created_at: now,
      updated_at: now,
    };

    // Try PostgreSQL first
    try {
      const result = await pgPool.query(
        `INSERT INTO papers
           (id, user_id, title, file_url, storage_key, file_size_bytes, mime_type, status, metadata, authors)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          id,
          paper.user_id,
          paper.title,
          paper.file_url,
          paper.storage_key,
          paper.file_size_bytes,
          paper.mime_type,
          paper.status,
          JSON.stringify(paper.metadata),
          JSON.stringify(paper.authors),
        ],
      );
      const row = result.rows[0];
      logger.info(`Paper created in PostgreSQL: id=${id}`);
      return PapersService.rowToPaper(row);
    } catch (err: any) {
      logger.warn('PostgreSQL unavailable — using in-memory store for paper creation');
      inMemoryPapers.set(id, paper);
      return paper;
    }
  }

  /**
   * Update a paper's processing status.
   */
  static async updateStatus(
    paperId: string,
    status: PaperStatus,
    extra?: {
      totalPages?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      await pgPool.query(
        `UPDATE papers
         SET status=$2, total_pages=COALESCE($3, total_pages),
             error_message=$4, updated_at=NOW()
         WHERE id=$1`,
        [paperId, status, extra?.totalPages ?? null, extra?.errorMessage ?? null],
      );
    } catch {
      // Fallback: update in-memory
      const paper = inMemoryPapers.get(paperId);
      if (paper) {
        paper.status = status;
        paper.updated_at = new Date();
        if (extra?.totalPages !== undefined) paper.total_pages = extra.totalPages;
        if (extra?.errorMessage !== undefined) paper.error_message = extra.errorMessage;
      }
    }
  }

  /**
   * List all papers (optionally filtered by user).
   */
  static async listPapers(userId?: string): Promise<PaperRecord[]> {
    try {
      const query = userId
        ? 'SELECT * FROM papers WHERE user_id=$1 ORDER BY created_at DESC'
        : 'SELECT * FROM papers ORDER BY created_at DESC';
      const params = userId ? [userId] : [];
      const result = await pgPool.query(query, params);
      return result.rows.map(PapersService.rowToPaper);
    } catch {
      const papers = Array.from(inMemoryPapers.values());
      if (userId) return papers.filter((p) => p.user_id === userId);
      return papers;
    }
  }

  /**
   * Get a single paper by ID.
   */
  static async getPaperById(paperId: string): Promise<PaperRecord | null> {
    try {
      const result = await pgPool.query('SELECT * FROM papers WHERE id=$1', [paperId]);
      if (result.rows.length === 0) return null;
      return PapersService.rowToPaper(result.rows[0]);
    } catch {
      return inMemoryPapers.get(paperId) ?? null;
    }
  }

  /**
   * Get sections for a paper.
   */
  static async getSectionsByPaperId(paperId: string): Promise<PaperSectionRecord[]> {
    try {
      const result = await pgPool.query(
        'SELECT * FROM paper_sections WHERE paper_id=$1 ORDER BY sequence_order ASC',
        [paperId],
      );
      return result.rows.map(PapersService.rowToSection);
    } catch {
      return inMemorySections.get(paperId) ?? [];
    }
  }

  /**
   * Store extracted sections after AI parsing is complete.
   */
  static async storeSections(
    paperId: string,
    segments: ProcessingResult['segments'],
  ): Promise<void> {
    // Group consecutive segments by section_type+page to form coherent sections
    const sections: PaperSectionRecord[] = segments.map((seg, idx) => ({
      id: uuidv4(),
      paper_id: paperId,
      section_type: seg.section_type,
      heading: seg.heading ?? null,
      content: seg.text,
      page_start: seg.page_number,
      page_end: seg.page_number,
      sequence_order: idx,
      word_count: seg.word_count,
      char_count: seg.char_count,
      created_at: new Date(),
    }));

    try {
      // Batch insert sections using parameterised query per row
      for (const sec of sections) {
        await pgPool.query(
          `INSERT INTO paper_sections
             (id, paper_id, section_type, heading, content, page_start, page_end,
              sequence_order, bounding_boxes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT DO NOTHING`,
          [
            sec.id,
            sec.paper_id,
            sec.section_type,
            sec.heading,
            sec.content,
            sec.page_start,
            sec.page_end,
            sec.sequence_order,
            JSON.stringify([]),
          ],
        );
      }
      logger.info(`Stored ${sections.length} sections for paper=${paperId} in PostgreSQL`);
    } catch {
      // In-memory fallback
      inMemorySections.set(paperId, sections);
      logger.info(`Stored ${sections.length} sections for paper=${paperId} in memory`);
    }
  }

  /**
   * Call the Python AI service to process the PDF.
   * This is fire-and-wait (not true async queue — proper queue in Stage 6+).
   */
  static async triggerProcessing(
    paperId: string,
    absoluteFilePath: string,
    originalFilename: string,
  ): Promise<ProcessingResult> {
    const url = `${config.AI_SERVICE_URL}/api/v1/pipeline/process`;
    logger.info(`Triggering AI processing: paper_id=${paperId}  url=${url}`);

    const response = await axios.post<ProcessingResult>(
      url,
      {
        paper_id: paperId,
        file_path: absoluteFilePath,
        original_filename: originalFilename,
      },
      { timeout: 120_000 }, // 2-minute timeout for large PDFs
    );

    return response.data;
  }

  /**
   * Get all extracted entities for a paper.
   */
  static async getEntitiesByPaperId(paperId: string): Promise<ExtractedEntityRecord[]> {
    try {
      const result = await pgPool.query(
        'SELECT * FROM extracted_entities WHERE paper_id=$1 ORDER BY page_number ASC, confidence DESC',
        [paperId],
      );
      return result.rows.map(PapersService.rowToEntity);
    } catch {
      return inMemoryEntities.get(paperId) ?? [];
    }
  }

  /**
   * Store extracted entities for a paper in PostgreSQL (with in-memory fallback).
   */
  static async storeEntities(
    paperId: string,
    rawEntities: Array<{
      id?: string;
      paper_id?: string;
      section_id?: string | null;
      section?: string;
      entity_type: EntityType;
      text: string;
      normalized_name?: string | null;
      confidence: number;
      page_number?: number | null;
      source_reference?: string | null;
      metadata?: Record<string, any>;
    }>,
  ): Promise<ExtractedEntityRecord[]> {
    const now = new Date();
    const entities: ExtractedEntityRecord[] = rawEntities.map((e) => ({
      id: e.id || uuidv4(),
      paper_id: paperId,
      section_id: e.section_id || null,
      entity_type: e.entity_type,
      text: e.text,
      normalized_name: e.normalized_name || null,
      confidence: Number(e.confidence),
      page_number: e.page_number !== undefined && e.page_number !== null ? Number(e.page_number) : null,
      source_reference: e.source_reference || null,
      metadata: { ...e.metadata, source_reference: e.source_reference, section: e.section },
      created_at: now,
    }));

    try {
      for (const ent of entities) {
        await pgPool.query(
          `INSERT INTO extracted_entities
             (id, paper_id, section_id, entity_type, text, normalized_name, confidence, page_number, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT DO NOTHING`,
          [
            ent.id,
            ent.paper_id,
            ent.section_id,
            ent.entity_type,
            ent.text,
            ent.normalized_name,
            ent.confidence,
            ent.page_number,
            JSON.stringify(ent.metadata),
          ],
        );
      }
      logger.info(`Stored ${entities.length} entities for paper=${paperId} in PostgreSQL`);
    } catch {
      inMemoryEntities.set(paperId, entities);
      logger.info(`Stored ${entities.length} entities for paper=${paperId} in memory`);
    }

    return entities;
  }

  /**
   * Trigger structured research-information extraction on a paper's parsed sections.
   */
  static async triggerExtraction(paperId: string): Promise<ExtractedEntityRecord[]> {
    const sections = await PapersService.getSectionsByPaperId(paperId);
    if (!sections.length) {
      logger.warn(`No sections found for extraction on paper_id=${paperId}`);
      return [];
    }

    const segments = sections.map((s) => ({
      paper_id: paperId,
      page_number: s.page_start,
      section_type: s.section_type,
      heading: s.heading || undefined,
      text: s.content,
      char_count: s.char_count,
      word_count: s.word_count,
    }));

    const url = `${config.AI_SERVICE_URL}/api/v1/extraction/extract`;
    logger.info(`Triggering AI extraction: paper_id=${paperId}  url=${url}`);

    const response = await axios.post<{
      paper_id: string;
      total_entities: number;
      entities: Array<{
        id: string;
        paper_id: string;
        page_number?: number;
        section: string;
        text: string;
        entity_type: EntityType;
        confidence: number;
        source_reference: string;
        normalized_name?: string;
        metadata: Record<string, any>;
      }>;
    }>(
      url,
      {
        paper_id: paperId,
        segments,
        enable_neural: true,
      },
      { timeout: 120_000 },
    );

    const stored = await PapersService.storeEntities(paperId, response.data.entities);
    return stored;
  }

  /**
   * Update the embedding vector and ID for a specific entity in PostgreSQL and in-memory store.
   */
  static async updateEntityEmbedding(
    entityId: string,
    embeddingId: string,
    vector: number[],
  ): Promise<void> {
    try {
      await pgPool.query(
        `UPDATE extracted_entities
         SET embedding_id = $1,
             metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{embedding}', $2::jsonb)
         WHERE id = $3`,
        [embeddingId, JSON.stringify(vector), entityId],
      );
    } catch {
      for (const entityList of inMemoryEntities.values()) {
        const found = entityList.find((e) => e.id === entityId);
        if (found) {
          found.metadata = { ...found.metadata, embedding_id: embeddingId, embedding: vector };
          break;
        }
      }
    }
  }

  // ─── Row mappers ───────────────────────────────────────────────────────────

  private static rowToPaper(row: any): PaperRecord {
    return {
      id: row.id,
      user_id: row.user_id ?? null,
      title: row.title,
      doi: row.doi ?? null,
      authors: row.authors ?? [],
      publication_year: row.publication_year ?? null,
      venue: row.venue ?? null,
      abstract: row.abstract ?? null,
      file_url: row.file_url,
      storage_key: row.storage_key,
      file_size_bytes: Number(row.file_size_bytes ?? 0),
      mime_type: row.mime_type,
      total_pages: row.total_pages ?? null,
      status: row.status as PaperStatus,
      error_message: row.error_message ?? null,
      metadata: row.metadata ?? {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private static rowToSection(row: any): PaperSectionRecord {
    return {
      id: row.id,
      paper_id: row.paper_id,
      section_type: row.section_type,
      heading: row.heading ?? null,
      content: row.content,
      page_start: Number(row.page_start),
      page_end: Number(row.page_end),
      sequence_order: Number(row.sequence_order),
      word_count: Number(row.word_count ?? 0),
      char_count: Number(row.char_count ?? 0),
      created_at: new Date(row.created_at),
    };
  }

  private static rowToEntity(row: any): ExtractedEntityRecord {
    return {
      id: row.id,
      paper_id: row.paper_id,
      section_id: row.section_id ?? null,
      entity_type: row.entity_type as EntityType,
      text: row.text,
      normalized_name: row.normalized_name ?? null,
      confidence: Number(row.confidence),
      page_number: row.page_number ? Number(row.page_number) : null,
      source_reference: row.metadata?.source_reference ?? null,
      embedding_id: row.embedding_id ?? null,
      metadata: row.metadata ?? {},
      created_at: new Date(row.created_at),
    };
  }

  /**
   * Update the normalized_name (canonical entity) for an extracted entity.
   */
  static async updateEntityNormalizedName(entityId: string, normalizedName: string): Promise<void> {
    try {
      const pool = pgPool;
      if (pool) {
        await pool.query(
          'UPDATE extracted_entities SET normalized_name = $1 WHERE id = $2',
          [normalizedName, entityId]
        );
        return;
      }
    } catch {
      // Fall through to in-memory
    }
    // In-memory fallback
    for (const [, entities] of inMemoryEntities) {
      const ent = entities.find((e) => e.id === entityId);
      if (ent) {
        ent.normalized_name = normalizedName;
        break;
      }
    }
  }

  /**
   * Persist resolution decisions to entity_resolution_decisions table (or in-memory fallback).
   */
  static async insertResolutionDecisions(
    paperId: string,
    decisions: ResolutionDecisionRecord[]
  ): Promise<void> {
    if (!decisions.length) return;

    try {
      const pool = pgPool;
      if (pool) {
        for (const dec of decisions) {
          await pool.query(
            `INSERT INTO entity_resolution_decisions
               (decision_id, original_text, candidate_text, canonical_entity, entity_type,
                similarity_score, resolution_method, confidence, decision, rationale, metrics, paper_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (decision_id) DO NOTHING`,
            [
              dec.decision_id,
              dec.original_text,
              dec.candidate_text ?? null,
              dec.canonical_entity,
              dec.entity_type ?? null,
              dec.similarity_score,
              dec.resolution_method,
              dec.confidence,
              dec.decision,
              dec.rationale ?? null,
              JSON.stringify(dec.metrics ?? {}),
              paperId,
            ]
          );
        }
        return;
      }
    } catch {
      // Fall through to in-memory
    }
    // In-memory fallback
    const existing = inMemoryResolutionDecisions.get(paperId) ?? [];
    inMemoryResolutionDecisions.set(paperId, [...existing, ...decisions]);
    logger.warn('PostgreSQL unavailable — using in-memory store for resolution decisions');
  }

  /**
   * Retrieve all resolution decisions for a paper (for audit display).
   */
  static async getResolutionDecisions(paperId: string): Promise<ResolutionDecisionRecord[]> {
    try {
      const pool = pgPool;
      if (pool) {
        const res = await pool.query<any>(
          `SELECT * FROM entity_resolution_decisions
           WHERE paper_id = $1
           ORDER BY created_at ASC`,
          [paperId]
        );
        return res.rows.map((row: any) => ({
          id: row.id,
          decision_id: row.decision_id,
          original_text: row.original_text,
          candidate_text: row.candidate_text ?? null,
          canonical_entity: row.canonical_entity,
          entity_type: row.entity_type ?? null,
          similarity_score: Number(row.similarity_score),
          resolution_method: row.resolution_method,
          confidence: Number(row.confidence),
          decision: row.decision,
          rationale: row.rationale ?? null,
          metrics: row.metrics ?? {},
          paper_id: row.paper_id ?? null,
          created_at: new Date(row.created_at),
        }));
      }
    } catch {
      // Fall through to in-memory
    }
    return inMemoryResolutionDecisions.get(paperId) ?? [];
  }
}
