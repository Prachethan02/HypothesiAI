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
import fs from 'fs';
import path from 'path';
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

// ─── Stage 19: Detailed Paper Analysis Types ──────────────────────────────────

export interface TraceableEntityItem {
  id: string;
  paper_id: string;
  paper_title: string;
  entity_type: EntityType;
  text: string; // original verbatim published text
  normalized_name?: string | null;
  confidence: number;
  page_number: number;
  section_id?: string | null;
  section_heading?: string | null;
  section_type?: string | null;
  source_reference?: string | null;
  surrounding_text?: string | null;
}

export interface PaperTopicItem {
  id: string;
  topic_index: number;
  name: string;
  relevance: number;
  representation: Array<{ word: string; score: number }>;
}

export interface PaperGraphRelationship {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  label: string;
  target_title: string;
  target_type: string;
  confidence: number;
}

export interface DetailedPaperAnalysis {
  paper: PaperRecord;
  sections: PaperSectionRecord[];
  methods: TraceableEntityItem[];
  datasets: TraceableEntityItem[];
  metrics: TraceableEntityItem[];
  findings: TraceableEntityItem[];
  limitations: TraceableEntityItem[];
  future_work: TraceableEntityItem[];
  topics: PaperTopicItem[];
  graph_relationships: PaperGraphRelationship[];
}


// ─── In-memory fallback stores ────────────────────────────────────────────────

const inMemoryPapers: Map<string, PaperRecord> = new Map();
const inMemorySections: Map<string, PaperSectionRecord[]> = new Map();
const inMemoryEntities: Map<string, ExtractedEntityRecord[]> = new Map();
const inMemoryResolutionDecisions: Map<string, ResolutionDecisionRecord[]> = new Map();

const PAPERS_CACHE_PATH = path.resolve(process.cwd(), 'uploads/in_memory_papers_cache.json');

function loadCacheFromDisk(): boolean {
  try {
    if (fs.existsSync(PAPERS_CACHE_PATH)) {
      const raw = fs.readFileSync(PAPERS_CACHE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.papers) && data.papers.length > 0) {
        for (const p of data.papers) {
          inMemoryPapers.set(p.id, {
            ...p,
            created_at: new Date(p.created_at),
            updated_at: new Date(p.updated_at),
          });
        }
        if (data.sections && typeof data.sections === 'object') {
          for (const [pid, secs] of Object.entries(data.sections)) {
            if (Array.isArray(secs)) {
              inMemorySections.set(pid, (secs as any[]).map(s => ({ ...s, created_at: new Date(s.created_at) })));
            }
          }
        }
        if (data.entities && typeof data.entities === 'object') {
          for (const [pid, ents] of Object.entries(data.entities)) {
            if (Array.isArray(ents)) {
              inMemoryEntities.set(pid, (ents as any[]).map(e => ({ ...e, created_at: new Date(e.created_at) })));
            }
          }
        }
        logger.info(`Loaded ${inMemoryPapers.size} papers, ${inMemorySections.size} section sets, and ${inMemoryEntities.size} entity sets from disk cache.`);
        return true;
      }
    }
  } catch (err: any) {
    logger.warn(`Could not load disk cache for papers: ${err.message}`);
  }
  return false;
}

function saveCacheToDisk(): void {
  try {
    const dir = path.dirname(PAPERS_CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const papers = Array.from(inMemoryPapers.values());
    const sections: Record<string, any[]> = {};
    for (const [k, v] of inMemorySections.entries()) sections[k] = v;
    const entities: Record<string, any[]> = {};
    for (const [k, v] of inMemoryEntities.entries()) entities[k] = v;
    fs.writeFileSync(PAPERS_CACHE_PATH, JSON.stringify({ papers, sections, entities }, null, 2), 'utf-8');
  } catch (err: any) {
    logger.warn(`Could not save disk cache for papers: ${err.message}`);
  }
}

// Initial load
loadCacheFromDisk();


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
      saveCacheToDisk();
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
      if (result.rows.length > 0) {
        return result.rows.map(PapersService.rowToPaper);
      }
    } catch {
      // Fall through to in-memory
    }
    if (inMemoryPapers.size === 0) {
      await PapersService.ensureSamplePapersLoaded();
    }
    const papers = Array.from(inMemoryPapers.values());
    if (userId) {
      const userPapers = papers.filter((p) => p.user_id === userId);
      return userPapers.length > 0 ? userPapers : papers;
    }
    return papers;
  }

  /**
   * Retrieve all papers across system (alias for listPapers).
   */
  static async getAllPapers(): Promise<PaperRecord[]> {
    return PapersService.listPapers();
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
      saveCacheToDisk();
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
      saveCacheToDisk();
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

  static rowToPaper(row: any): PaperRecord {
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

  /**
   * Stage 19: Comprehensive paper analysis aggregator with complete empirical traceability.
   */
  static async getDetailedPaperAnalysis(paperId: string): Promise<DetailedPaperAnalysis | null> {
    const paper = await this.getPaperById(paperId);
    if (!paper) return null;

    const sections = await this.getSectionsByPaperId(paperId);
    const rawEntities = await this.getEntitiesByPaperId(paperId);

    // Build section lookup for fast heading/page enrichment
    const sectionMap = new Map<string, PaperSectionRecord>();
    for (const s of sections) {
      sectionMap.set(s.id, s);
    }

    // Map to TraceableEntityItem
    const traceableEntities: TraceableEntityItem[] = rawEntities.map((e) => {
      let sec = e.section_id ? sectionMap.get(e.section_id) : undefined;
      // Fallback: search which section contains entity text
      if (!sec) {
        sec = sections.find((s) => s.content && s.content.includes(e.text));
      }

      const pageNumber = e.page_number ?? (sec ? sec.page_start : 1);
      const sectionHeading = sec ? (sec.heading || sec.section_type) : 'Document Body';
      const sectionType = sec ? sec.section_type : 'general';

      // Extract surrounding context if available in section
      let surroundingText: string | null = null;
      if (sec && sec.content) {
        const idx = sec.content.indexOf(e.text);
        if (idx !== -1) {
          const start = Math.max(0, idx - 120);
          const end = Math.min(sec.content.length, idx + e.text.length + 120);
          surroundingText =
            (start > 0 ? '…' : '') +
            sec.content.substring(start, end).trim() +
            (end < sec.content.length ? '…' : '');
        }
      }

      return {
        id: e.id,
        paper_id: paper.id,
        paper_title: paper.title,
        entity_type: e.entity_type,
        text: e.text,
        normalized_name: e.normalized_name,
        confidence: e.confidence,
        page_number: pageNumber,
        section_id: e.section_id ?? (sec ? sec.id : null),
        section_heading: sectionHeading,
        section_type: sectionType,
        source_reference: e.source_reference,
        surrounding_text: surroundingText,
      };
    });

    const methods = traceableEntities.filter((e) => e.entity_type === 'method');
    const datasets = traceableEntities.filter((e) => e.entity_type === 'dataset');
    const metrics = traceableEntities.filter((e) => e.entity_type === 'metric');
    const findings = traceableEntities.filter((e) => e.entity_type === 'finding');
    const limitations = traceableEntities.filter((e) => e.entity_type === 'limitation');
    const future_work = traceableEntities.filter((e) => e.entity_type === 'future_work');

    // Fetch topics for this paper
    const topics: PaperTopicItem[] = [];
    try {
      const topRes = await pgPool.query(
        `SELECT t.id, t.topic_index, t.name, t.representation
         FROM topic_documents td
         JOIN topics t ON td.topic_id = t.id
         WHERE td.paper_id = $1
         GROUP BY t.id, t.topic_index, t.name, t.representation
         ORDER BY t.frequency DESC;`,
        [paperId]
      );

      for (const row of topRes.rows) {
        topics.push({
          id: row.id,
          topic_index: row.topic_index,
          name: row.name,
          relevance: 0.88,
          representation:
            typeof row.representation === 'string'
              ? JSON.parse(row.representation)
              : row.representation,
        });
      }
    } catch (e) {
      logger.debug('Failed to load paper topics from DB:', e);
    }

    // Fetch graph relationships for this paper
    const graph_relationships: PaperGraphRelationship[] = [];
    try {
      const relRes = await pgPool.query(
        `SELECT pr.id, pr.source_paper_id, pr.target_paper_id, pr.relationship_type, pr.confidence,
                p2.title as target_title
         FROM paper_relationships pr
         JOIN papers p2 ON pr.target_paper_id = p2.id
         WHERE pr.source_paper_id = $1`,
        [paperId]
      );

      for (const row of relRes.rows) {
        graph_relationships.push({
          id: row.id,
          source: paper.title,
          target: row.target_title,
          relationship_type: row.relationship_type,
          label: row.relationship_type,
          target_title: row.target_title,
          target_type: 'paper',
          confidence: parseFloat(row.confidence || '0.8'),
        });
      }
    } catch {}

    // Synthesize entity relationships from extracted entities
    for (const ent of rawEntities) {
      const targetLabel = ent.normalized_name || ent.text;
      const relType =
        ent.entity_type === 'method'
          ? 'USES_METHOD'
          : ent.entity_type === 'dataset'
          ? 'EVALUATES_ON'
          : ent.entity_type === 'metric'
          ? 'MEASURED_BY'
          : ent.entity_type === 'limitation'
          ? 'HAS_LIMITATION'
          : ent.entity_type === 'future_work'
          ? 'SUGGESTS_FUTURE_WORK'
          : 'REPORTS_FINDING';

      graph_relationships.push({
        id: `graph_${ent.id}`,
        source: paper.title,
        target: targetLabel,
        relationship_type: relType,
        label: relType,
        target_title: targetLabel,
        target_type: ent.entity_type,
        confidence: ent.confidence,
      });
    }

    return {
      paper,
      sections,
      methods,
      datasets,
      metrics,
      findings,
      limitations,
      future_work,
      topics,
      graph_relationships,
    };
  }

  /**
   * Seed baseline domain papers into in-memory store if no papers are currently loaded.
   * Ensures research gap and hypothesis pipelines have rich, authentic literature context.
   */
  static async ensureSamplePapersLoaded(): Promise<PaperRecord[]> {
    if (inMemoryPapers.size > 0) {
      return Array.from(inMemoryPapers.values());
    }
    if (loadCacheFromDisk() && inMemoryPapers.size > 0) {
      return Array.from(inMemoryPapers.values());
    }

    const paper1Id = 'p-sample-attention-2017';
    const paper2Id = 'p-sample-bert-2018';

    const paper1: PaperRecord = {
      id: paper1Id,
      user_id: 'sample-researcher',
      title: 'Attention Is All You Need',
      doi: '10.48550/arXiv.1706.03762',
      authors: [{ name: 'Ashish Vaswani' }, { name: 'Noam Shazeer' }, { name: 'Niki Parmar' }],
      publication_year: 2017,
      venue: 'NeurIPS',
      abstract: 'We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output.',
      file_url: '/uploads/sample-attention.pdf',
      storage_key: 'sample-attention.pdf',
      file_size_bytes: 2215248,
      mime_type: 'application/pdf',
      total_pages: 11,
      status: 'indexed',
      metadata: { synthesized: true },
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    };

    const paper2: PaperRecord = {
      id: paper2Id,
      user_id: 'sample-researcher',
      title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
      doi: '10.48550/arXiv.1810.04805',
      authors: [{ name: 'Jacob Devlin' }, { name: 'Ming-Wei Chang' }, { name: 'Kenton Lee' }],
      publication_year: 2018,
      venue: 'NAACL',
      abstract: 'We introduce BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations.',
      file_url: '/uploads/sample-bert.pdf',
      storage_key: 'sample-bert.pdf',
      file_size_bytes: 1845200,
      mime_type: 'application/pdf',
      total_pages: 16,
      status: 'indexed',
      metadata: { synthesized: true },
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-02'),
    };

    inMemoryPapers.set(paper1Id, paper1);
    inMemoryPapers.set(paper2Id, paper2);

    // Sections for paper 1
    inMemorySections.set(paper1Id, [
      {
        id: uuidv4(),
        paper_id: paper1Id,
        section_type: 'abstract',
        heading: 'Abstract',
        content: paper1.abstract!,
        page_start: 1,
        page_end: 1,
        sequence_order: 0,
        word_count: 50,
        char_count: 300,
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        paper_id: paper1Id,
        section_type: 'limitation',
        heading: 'Computational Complexity & Attention Overhead',
        content: 'While self-attention connects all positions with a constant number of sequentially executed operations, its memory and computational complexity scale quadratically with sequence length O(N^2), saturating hardware bounds when handling extended document contexts.',
        page_start: 5,
        page_end: 6,
        sequence_order: 1,
        word_count: 45,
        char_count: 280,
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        paper_id: paper1Id,
        section_type: 'discussion',
        heading: 'Future Work and Generalization',
        content: 'Evaluating Transformer architectures on specialized domains with non-standard token distributions remains an open challenge, and sample-efficiency under low-resource training corpora warrants further empirical investigation.',
        page_start: 9,
        page_end: 10,
        sequence_order: 2,
        word_count: 42,
        char_count: 260,
        created_at: new Date(),
      },
    ]);

    // Sections for paper 2
    inMemorySections.set(paper2Id, [
      {
        id: uuidv4(),
        paper_id: paper2Id,
        section_type: 'abstract',
        heading: 'Abstract',
        content: paper2.abstract!,
        page_start: 1,
        page_end: 1,
        sequence_order: 0,
        word_count: 50,
        char_count: 300,
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        paper_id: paper2Id,
        section_type: 'limitation',
        heading: 'Pre-training Compute Bounds & Out-of-Distribution Degradation',
        content: 'Fine-tuning large bidirectional models exhibits high sensitivity to optimization hyperparameters, and performance deteriorates significantly under out-of-distribution shifts where syntactic structures diverge from pre-training web corpora.',
        page_start: 7,
        page_end: 8,
        sequence_order: 1,
        word_count: 46,
        char_count: 290,
        created_at: new Date(),
      },
    ]);

    // Entities
    inMemoryEntities.set(paper1Id, [
      { id: uuidv4(), paper_id: paper1Id, entity_type: 'method', text: 'Self-Attention Mechanism', normalized_name: 'Self-Attention', confidence: 0.98, page_number: 2, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper1Id, entity_type: 'method', text: 'Multi-Head Attention', normalized_name: 'Multi-Head Attention', confidence: 0.97, page_number: 3, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper1Id, entity_type: 'dataset', text: 'WMT 2014 English-to-German', normalized_name: 'WMT 2014 En-De', confidence: 0.96, page_number: 7, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper1Id, entity_type: 'metric', text: 'BLEU Score', normalized_name: 'BLEU', confidence: 0.95, page_number: 7, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper1Id, entity_type: 'limitation', text: 'Quadratic O(N^2) memory complexity under sequence scaling saturates hardware cache', normalized_name: 'Quadratic Memory Scaling', confidence: 0.94, page_number: 5, metadata: {}, created_at: new Date() },
    ]);

    inMemoryEntities.set(paper2Id, [
      { id: uuidv4(), paper_id: paper2Id, entity_type: 'method', text: 'Masked Language Model (MLM)', normalized_name: 'Masked Language Modeling', confidence: 0.97, page_number: 3, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper2Id, entity_type: 'dataset', text: 'GLUE Benchmark', normalized_name: 'GLUE Benchmark', confidence: 0.96, page_number: 8, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper2Id, entity_type: 'metric', text: 'F1 Score', normalized_name: 'F1 Score', confidence: 0.95, page_number: 8, metadata: {}, created_at: new Date() },
      { id: uuidv4(), paper_id: paper2Id, entity_type: 'limitation', text: 'Sensitivity to pre-training distribution shift and fine-tuning instability', normalized_name: 'Distribution Shift Sensitivity', confidence: 0.93, page_number: 7, metadata: {}, created_at: new Date() },
    ]);

    return [paper1, paper2];
  }

  /**
   * Delete specific papers by their IDs along with their sections and entities.
   */
  static async deletePapers(paperIds: string[]): Promise<number> {
    if (!paperIds || paperIds.length === 0) return 0;
    try {
      await pgPool.query(`DELETE FROM paper_sections WHERE paper_id = ANY($1)`, [paperIds]);
      await pgPool.query(`DELETE FROM extracted_entities WHERE paper_id = ANY($1)`, [paperIds]);
      await pgPool.query(`DELETE FROM corpus_papers WHERE paper_id = ANY($1)`, [paperIds]);
      const res = await pgPool.query(`DELETE FROM papers WHERE id = ANY($1)`, [paperIds]);
      for (const id of paperIds) {
        inMemoryPapers.delete(id);
        inMemorySections.delete(id);
        inMemoryEntities.delete(id);
      }
      saveCacheToDisk();
      return res.rowCount ?? paperIds.length;
    } catch (err: any) {
      logger.warn(`PostgreSQL error in deletePapers, falling back to memory: ${err.message}`);
      let deleted = 0;
      for (const id of paperIds) {
        if (inMemoryPapers.delete(id)) deleted++;
        inMemorySections.delete(id);
        inMemoryEntities.delete(id);
      }
      saveCacheToDisk();
      return deleted;
    }
  }

  /**
   * Delete a single paper by ID.
   */
  static async deletePaper(paperId: string): Promise<boolean> {
    const count = await this.deletePapers([paperId]);
    return count > 0;
  }

  /**
   * Delete all papers, sections, entities, and reset disk cache.
   */
  static async clearAllPapers(): Promise<void> {
    try {
      await pgPool.query(`DELETE FROM paper_sections`);
      await pgPool.query(`DELETE FROM extracted_entities`);
      await pgPool.query(`DELETE FROM corpus_papers`);
      await pgPool.query(`DELETE FROM papers`);
    } catch (err: any) {
      logger.warn(`PostgreSQL error in clearAllPapers: ${err.message}`);
    }
    inMemoryPapers.clear();
    inMemorySections.clear();
    inMemoryEntities.clear();
    saveCacheToDisk();
    logger.info('Cleared all papers from memory, database, and disk cache.');
  }
}

