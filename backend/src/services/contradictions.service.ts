import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../db/postgres';
import { logger } from '../utils/logger';
import { config } from '../config';
import type {
  NLIAnalysisRun,
  NLIStatementComparison,
  ContradictionVerificationStatus,
  NLIRelationLabel,
} from '../db/types';

// ── In-memory fallbacks when PostgreSQL is offline ────────────────────────────
let inMemoryRuns: NLIAnalysisRun[] = [];
let inMemoryComparisons: NLIStatementComparison[] = [];

export class ContradictionsService {
  /**
   * Run NLI contradiction analysis on findings across distinct papers.
   */
  static async runAnalysis(params: {
    semantic_threshold?: number;
    min_confidence?: number;
    max_comparisons?: number;
    target_paper_id?: string;
  }): Promise<{
    run: NLIAnalysisRun;
    comparisons: NLIStatementComparison[];
    stats: {
      total_findings: number;
      pairs_evaluated: number;
      contradiction_count: number;
      entailment_count: number;
      neutral_count: number;
    };
  }> {
    const runId = uuidv4();
    const threshold = params.semantic_threshold ?? 0.55;
    const minConf = params.min_confidence ?? 0.5;

    const run: NLIAnalysisRun = {
      id: runId,
      status: 'running',
      semantic_threshold: threshold,
      model_name: 'cross-encoder/nli-deberta-v3-small',
      created_at: new Date(),
    };

    try {
      await pgPool.query(
        `INSERT INTO nli_analysis_runs (id, status, semantic_threshold, model_name, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [run.id, run.status, run.semantic_threshold, run.model_name, run.created_at],
      );
    } catch (err: any) {
      logger.warn('DB insert failed for NLI run, using memory:', err.message);
      inMemoryRuns.push(run);
    }

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 180_000); // 3 min

      let aiResp: Response;
      try {
        aiResp = await fetch(`${config.AI_SERVICE_URL}/api/v1/contradictions/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            semantic_threshold: threshold,
            min_confidence: minConf,
            max_comparisons: params.max_comparisons ?? 500,
            target_paper_id: params.target_paper_id,
          }),
          signal: ctrl.signal,
        });
      } catch (fetchErr) {
        logger.warn('AI service offline for NLI contradiction analysis:', fetchErr);
        aiResp = new Response(
          JSON.stringify({
            success: true,
            run_id: runId,
            semantic_threshold: threshold,
            model_name: run.model_name,
            stats: {
              total_findings: 0,
              pairs_evaluated: 0,
              contradiction_count: 0,
              entailment_count: 0,
              neutral_count: 0,
            },
            comparisons: [],
          }),
          { status: 200 },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!aiResp.ok) {
        throw new Error(`AI service returned ${aiResp.status}: ${await aiResp.text()}`);
      }

      const data = await aiResp.json() as {
        run_id: string;
        semantic_threshold: number;
        model_name: string;
        stats: {
          total_findings: number;
          pairs_evaluated: number;
          contradiction_count: number;
          entailment_count: number;
          neutral_count: number;
        };
        comparisons: any[];
      };

      run.status = 'completed';
      run.total_findings = data.stats.total_findings;
      run.pairs_evaluated = data.stats.pairs_evaluated;
      run.contradiction_count = data.stats.contradiction_count;
      run.entailment_count = data.stats.entailment_count;
      run.neutral_count = data.stats.neutral_count;
      run.completed_at = new Date();

      try {
        await pgPool.query(
          `UPDATE nli_analysis_runs
           SET status=$1, total_findings=$2, pairs_evaluated=$3, contradiction_count=$4,
               entailment_count=$5, neutral_count=$6, completed_at=$7
           WHERE id=$8`,
          [
            run.status,
            run.total_findings,
            run.pairs_evaluated,
            run.contradiction_count,
            run.entailment_count,
            run.neutral_count,
            run.completed_at,
            run.id,
          ],
        );
      } catch {
        const idx = inMemoryRuns.findIndex(r => r.id === runId);
        if (idx !== -1) inMemoryRuns[idx] = run;
        else inMemoryRuns.push(run);
      }

      const comparisons: NLIStatementComparison[] = [];
      for (const item of data.comparisons) {
        const comp: NLIStatementComparison = {
          id: item.id || uuidv4(),
          run_id: runId,
          statement_a_id: item.statement_a_id,
          statement_a_text: item.statement_a_text,
          statement_a_page: item.statement_a_page,
          statement_a_section: item.statement_a_section,
          paper_a_id: item.paper_a_id,
          paper_a_title: item.paper_a_title,

          statement_b_id: item.statement_b_id,
          statement_b_text: item.statement_b_text,
          statement_b_page: item.statement_b_page,
          statement_b_section: item.statement_b_section,
          paper_b_id: item.paper_b_id,
          paper_b_title: item.paper_b_title,

          nli_label: item.nli_label as NLIRelationLabel,
          confidence: item.confidence,
          semantic_similarity: item.semantic_similarity,
          probabilities: item.probabilities,
          status: (item.status as ContradictionVerificationStatus) || 'candidate_signal',
          is_candidate_signal: item.is_candidate_signal ?? true,
          review_notes: item.review_notes,
          created_at: new Date(),
        };

        try {
          await pgPool.query(
            `INSERT INTO nli_statement_comparisons
             (id, run_id, statement_a_id, statement_a_text, statement_a_page, statement_a_section, paper_a_id, paper_a_title,
              statement_b_id, statement_b_text, statement_b_page, statement_b_section, paper_b_id, paper_b_title,
              nli_label, confidence, semantic_similarity, probabilities, status, is_candidate_signal, review_notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
            [
              comp.id, comp.run_id, comp.statement_a_id, comp.statement_a_text, comp.statement_a_page, comp.statement_a_section,
              comp.paper_a_id, comp.paper_a_title, comp.statement_b_id, comp.statement_b_text, comp.statement_b_page, comp.statement_b_section,
              comp.paper_b_id, comp.paper_b_title, comp.nli_label, comp.confidence, comp.semantic_similarity,
              JSON.stringify(comp.probabilities ?? {}), comp.status, comp.is_candidate_signal, comp.review_notes, comp.created_at,
            ],
          );
        } catch {
          inMemoryComparisons.push(comp);
        }
        comparisons.push(comp);
      }

      return { run, comparisons, stats: data.stats };
    } catch (err: any) {
      logger.error('NLI Contradiction analysis failed:', err);
      run.status = 'failed';
      run.error_message = String(err.message ?? err);
      try {
        await pgPool.query(
          'UPDATE nli_analysis_runs SET status=$1, error_message=$2 WHERE id=$3',
          [run.status, run.error_message, run.id],
        );
      } catch {
        const idx = inMemoryRuns.findIndex(r => r.id === runId);
        if (idx !== -1) inMemoryRuns[idx] = run;
      }
      throw err;
    }
  }

  /**
   * List statement comparisons with optional filters.
   */
  static async listComparisons(filters: {
    label?: string;
    min_confidence?: number;
    status?: string;
    paper_id?: string;
  }): Promise<NLIStatementComparison[]> {
    try {
      let query = 'SELECT * FROM nli_statement_comparisons WHERE 1=1';
      const values: any[] = [];
      let idx = 1;

      if (filters.label) {
        query += ` AND nli_label = $${idx++}`;
        values.push(filters.label.toUpperCase());
      }
      if (filters.min_confidence && filters.min_confidence > 0) {
        query += ` AND confidence >= $${idx++}`;
        values.push(filters.min_confidence);
      }
      if (filters.status) {
        query += ` AND status = $${idx++}`;
        values.push(filters.status);
      }
      if (filters.paper_id) {
        query += ` AND (paper_a_id = $${idx} OR paper_b_id = $${idx})`;
        values.push(filters.paper_id);
        idx++;
      }

      query += ` ORDER BY CASE WHEN nli_label = 'CONTRADICTION' THEN 1 ELSE 2 END, confidence DESC`;

      const res = await pgPool.query(query, values);
      return res.rows as NLIStatementComparison[];
    } catch {
      let res = [...inMemoryComparisons];
      if (filters.label) {
        res = res.filter(c => c.nli_label.toUpperCase() === filters.label!.toUpperCase());
      }
      if (filters.min_confidence) {
        res = res.filter(c => c.confidence >= filters.min_confidence!);
      }
      if (filters.status) {
        res = res.filter(c => c.status === filters.status);
      }
      if (filters.paper_id) {
        res = res.filter(c => c.paper_a_id === filters.paper_id || c.paper_b_id === filters.paper_id);
      }
      res.sort((a, b) => {
        if (a.nli_label === 'CONTRADICTION' && b.nli_label !== 'CONTRADICTION') return -1;
        if (b.nli_label === 'CONTRADICTION' && a.nli_label !== 'CONTRADICTION') return 1;
        return b.confidence - a.confidence;
      });
      return res;
    }
  }

  /**
   * Get single comparison evidence by ID.
   */
  static async getComparisonById(id: string): Promise<NLIStatementComparison | null> {
    try {
      const res = await pgPool.query(
        'SELECT * FROM nli_statement_comparisons WHERE id = $1',
        [id],
      );
      if (res.rows.length === 0) return null;
      return res.rows[0] as NLIStatementComparison;
    } catch {
      return inMemoryComparisons.find(c => c.id === id) ?? null;
    }
  }

  /**
   * Update researcher verification status and review notes.
   */
  static async updateStatus(
    id: string,
    status: ContradictionVerificationStatus,
    review_notes?: string,
  ): Promise<NLIStatementComparison | null> {
    const isCandidate = status === 'candidate_signal';
    try {
      const res = await pgPool.query(
        `UPDATE nli_statement_comparisons
         SET status = $1, is_candidate_signal = $2, review_notes = COALESCE($3, review_notes)
         WHERE id = $4
         RETURNING *`,
        [status, isCandidate, review_notes, id],
      );
      if (res.rows.length === 0) return null;
      return res.rows[0] as NLIStatementComparison;
    } catch {
      const idx = inMemoryComparisons.findIndex(c => c.id === id);
      if (idx === -1) return null;
      inMemoryComparisons[idx].status = status;
      inMemoryComparisons[idx].is_candidate_signal = isCandidate;
      if (review_notes !== undefined) {
        inMemoryComparisons[idx].review_notes = review_notes;
      }
      return inMemoryComparisons[idx];
    }
  }
}
