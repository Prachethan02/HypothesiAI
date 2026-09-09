import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../db/postgres';
import { logger } from '../utils/logger';
import { PapersService, type PaperRecord } from './papers.service';
import { GapRankingService } from './gapRanking.service';
import type { Corpus, CorpusPaper, CorpusStatus } from '../db/types';

// In-memory fallback stores for testing or when PostgreSQL is unavailable
const inMemoryCorpora: Map<string, Corpus> = new Map();
const inMemoryCorpusPapers: Map<string, CorpusPaper[]> = new Map();

export class CorpusService {
  /**
   * Create a new research corpus.
   */
  static async createCorpus(params: {
    userId?: string;
    name: string;
    description?: string;
  }): Promise<Corpus> {
    const id = uuidv4();
    const now = new Date();
    const corpus: Corpus = {
      id,
      user_id: params.userId ?? null,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      status: 'draft',
      analysis_progress: 0,
      metadata: {},
      paper_count: 0,
      created_at: now,
      updated_at: now,
    };

    try {
      const res = await pgPool.query(
        `INSERT INTO corpora (id, user_id, name, description, status, analysis_progress, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          corpus.id,
          corpus.user_id,
          corpus.name,
          corpus.description,
          corpus.status,
          corpus.analysis_progress,
          JSON.stringify(corpus.metadata),
          corpus.created_at,
          corpus.updated_at,
        ]
      );
      const row = res.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description,
        status: row.status,
        analysis_progress: row.analysis_progress,
        metadata: row.metadata,
        paper_count: 0,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      };
    } catch (err: any) {
      logger.warn(`PostgreSQL unavailable for createCorpus, using in-memory store: ${err.message}`);
      inMemoryCorpora.set(id, corpus);
      inMemoryCorpusPapers.set(id, []);
      return corpus;
    }
  }

  /**
   * List all corpora for a user (or all if not filtered).
   */
  static async listCorpora(userId?: string): Promise<Corpus[]> {
    try {
      const query = `
        SELECT c.*, COUNT(cp.paper_id)::int as paper_count
        FROM corpora c
        LEFT JOIN corpus_papers cp ON c.id = cp.corpus_id
        ${userId ? 'WHERE c.user_id = $1' : ''}
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `;
      const params = userId ? [userId] : [];
      const res = await pgPool.query(query, params);
      return res.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description,
        status: row.status,
        analysis_progress: row.analysis_progress,
        metadata: row.metadata,
        paper_count: row.paper_count || 0,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      }));
    } catch {
      if (inMemoryCorpora.size === 0) {
        const allPapers = await PapersService.getAllPapers();
        const defaultId = 'c-biomedical-nlp-benchmark';
        const defaultCorpus: Corpus = {
          id: defaultId,
          user_id: userId || 'sample-researcher',
          name: 'Biomedical Segmentation & Clinical NLP Benchmark',
          description: 'Comprehensive corpus spanning 15 scientific publications across medical segmentation architectures (U-Net, TransUNet, MedSegDiff) and automated literature review systems.',
          status: 'analyzed',
          analysis_progress: 100,
          metadata: { auto_seeded: true },
          paper_count: allPapers.length,
          created_at: new Date(),
          updated_at: new Date(),
        };
        inMemoryCorpora.set(defaultId, defaultCorpus);
        inMemoryCorpusPapers.set(
          defaultId,
          allPapers.map((p) => ({
            id: uuidv4(),
            corpus_id: defaultId,
            paper_id: p.id,
            inclusion_reason: 'Core architecture benchmark',
            source: 'upload' as const,
            added_at: new Date(),
          }))

        );
      }

      const list = Array.from(inMemoryCorpora.values());
      const filtered = userId ? list.filter((c) => c.user_id === userId) : list;
      const res = filtered.length > 0 ? filtered : list;
      return res.map((c) => ({
        ...c,
        paper_count: (inMemoryCorpusPapers.get(c.id) || []).length,
      }));
    }
  }

  /**
   * Get corpus by ID.
   */
  static async getCorpusById(corpusId: string): Promise<Corpus | null> {
    try {
      const query = `
        SELECT c.*, COUNT(cp.paper_id)::int as paper_count
        FROM corpora c
        LEFT JOIN corpus_papers cp ON c.id = cp.corpus_id
        WHERE c.id = $1
        GROUP BY c.id
      `;
      const res = await pgPool.query(query, [corpusId]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description,
        status: row.status,
        analysis_progress: row.analysis_progress,
        metadata: row.metadata,
        paper_count: row.paper_count || 0,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      };
    } catch {
      const corpus = inMemoryCorpora.get(corpusId);
      if (!corpus) return null;
      return {
        ...corpus,
        paper_count: (inMemoryCorpusPapers.get(corpusId) || []).length,
      };
    }
  }

  /**
   * Add a paper to a corpus.
   */
  static async addPaperToCorpus(
    corpusId: string,
    paperId: string,
    source: 'upload' | 'academic_search' = 'upload'
  ): Promise<CorpusPaper> {
    const id = uuidv4();
    const now = new Date();
    const entry: CorpusPaper = {
      id,
      corpus_id: corpusId,
      paper_id: paperId,
      source,
      added_at: now,
    };

    try {
      await pgPool.query(
        `INSERT INTO corpus_papers (id, corpus_id, paper_id, source, added_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (corpus_id, paper_id) DO UPDATE SET source = EXCLUDED.source
         RETURNING *`,
        [id, corpusId, paperId, source, now]
      );
    } catch (err: any) {
      logger.warn(`PostgreSQL error in addPaperToCorpus: ${err.message}`);
      const list = inMemoryCorpusPapers.get(corpusId) || [];
      if (!list.some((p) => p.paper_id === paperId)) {
        list.push(entry);
        inMemoryCorpusPapers.set(corpusId, list);
      }
    }

    return entry;
  }

  /**
   * Get all papers associated with a corpus.
   */
  static async getCorpusPapers(corpusId: string): Promise<PaperRecord[]> {
    try {
      const query = `
        SELECT p.*
        FROM papers p
        INNER JOIN corpus_papers cp ON p.id = cp.paper_id
        WHERE cp.corpus_id = $1
        ORDER BY cp.added_at ASC
      `;
      const res = await pgPool.query(query, [corpusId]);
      return res.rows.map(PapersService.rowToPaper);
    } catch {
      const mappings = inMemoryCorpusPapers.get(corpusId) || [];
      const papers: PaperRecord[] = [];
      for (const m of mappings) {
        const p = await PapersService.getPaperById(m.paper_id);
        if (p) papers.push(p);
      }
      return papers;
    }
  }

  /**
   * Remove a paper from a corpus.
   */
  static async removePaperFromCorpus(corpusId: string, paperId: string): Promise<boolean> {
    try {
      const res = await pgPool.query(
        `DELETE FROM corpus_papers WHERE corpus_id = $1 AND paper_id = $2`,
        [corpusId, paperId]
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      const list = inMemoryCorpusPapers.get(corpusId) || [];
      const next = list.filter((p) => p.paper_id !== paperId);
      inMemoryCorpusPapers.set(corpusId, next);
      return list.length !== next.length;
    }
  }

  /**
   * Update corpus status and progress percentage.
   */
  static async updateCorpusStatus(
    corpusId: string,
    status: CorpusStatus,
    progress?: number
  ): Promise<void> {
    try {
      await pgPool.query(
        `UPDATE corpora
         SET status = $2,
             analysis_progress = COALESCE($3, analysis_progress),
             updated_at = NOW()
         WHERE id = $1`,
        [corpusId, status, progress ?? null]
      );
    } catch {
      const c = inMemoryCorpora.get(corpusId);
      if (c) {
        c.status = status;
        if (progress !== undefined) c.analysis_progress = progress;
        c.updated_at = new Date();
      }
    }
  }

  /**
   * Delete a corpus, optionally deleting all associated papers and downstream artifacts.
   */
  static async deleteCorpus(corpusId: string, deletePapers: boolean = true): Promise<boolean> {
    let paperIds: string[] = [];
    try {
      const pRes = await pgPool.query(`SELECT paper_id FROM corpus_papers WHERE corpus_id = $1`, [corpusId]);
      paperIds = pRes.rows.map((r: any) => r.paper_id);
    } catch {
      const list = inMemoryCorpusPapers.get(corpusId) || [];
      paperIds = list.map((p) => p.paper_id);
    }

    if (deletePapers && paperIds.length > 0) {
      await PapersService.deletePapers(paperIds);
    }

    // Clear downstream gaps for this corpus
    GapRankingService.clearAllGaps(corpusId);

    try {
      await pgPool.query(`DELETE FROM corpus_papers WHERE corpus_id = $1`, [corpusId]);
      const res = await pgPool.query(`DELETE FROM corpora WHERE id = $1`, [corpusId]);
      inMemoryCorpusPapers.delete(corpusId);
      inMemoryCorpora.delete(corpusId);
      return (res.rowCount ?? 0) > 0;
    } catch {
      inMemoryCorpusPapers.delete(corpusId);
      return inMemoryCorpora.delete(corpusId);
    }
  }

  /**
   * Delete the WHOLE corpus: wipe all corpora, corpus papers, uploaded papers,
   * extractions, evidence, gaps, and disk cache.
   */
  static async purgeWholeCorpus(): Promise<{
    corporaDeleted: number;
    papersDeleted: number;
  }> {
    let corporaCount = inMemoryCorpora.size;

    try {
      const cRes = await pgPool.query(`SELECT count(*)::int as count FROM corpora`);
      corporaCount = Math.max(corporaCount, cRes.rows[0]?.count || 0);
      await pgPool.query(`DELETE FROM corpus_papers`);
      await pgPool.query(`DELETE FROM corpora`);
    } catch (err: any) {
      logger.warn(`PostgreSQL error during purge corpora: ${err.message}`);
    }

    inMemoryCorpora.clear();
    inMemoryCorpusPapers.clear();

    // Clear all papers & extractions & disk cache
    await PapersService.clearAllPapers();

    // Clear all research gaps
    GapRankingService.clearAllGaps();

    logger.info(`Whole corpus purged: ${corporaCount} corpora wiped.`);
    return {
      corporaDeleted: corporaCount,
      papersDeleted: 0,
    };
  }

  /**
   * Clear in-memory state for testing.
   */
  static _resetMemory(): void {
    inMemoryCorpora.clear();
    inMemoryCorpusPapers.clear();
  }
}
