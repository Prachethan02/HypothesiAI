import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../db/postgres';
import { logger } from '../utils/logger';
import { config } from '../config';
import { PapersService } from './papers.service';
import type {
  PatternMiningRun,
  ResearchPattern,
  PatternAssociationRule,
  UnderexploredCandidate,
} from '../db/types';

// ── In-memory fallbacks ───────────────────────────────────────────────────────
let inMemoryRuns: PatternMiningRun[] = [];
let inMemoryPatterns: ResearchPattern[] = [];
let inMemoryRules: PatternAssociationRule[] = [];
let inMemoryCandidates: UnderexploredCandidate[] = [];

// ── Local Pattern Mining Fallback ─────────────────────────────────────────────
function runLocalPatternMining(
  papersEntities: Record<string, Array<{ entity_type: string; text: string; normalized_name?: string }>>,
  minSupport: number,
  minConfidence: number,
  runId: string,
) {
  const paperIds = Object.keys(papersEntities);
  const nPapers = paperIds.length;
  if (nPapers === 0) {
    return {
      run_id: runId,
      algorithm: 'local-frequency',
      n_papers: 0,
      frequent_patterns: [],
      association_rules: [],
      underexplored_candidates: [],
      stats: { frequent_pattern_count: 0, association_rule_count: 0, underexplored_candidate_count: 0 },
    };
  }

  // Group entities by paper and item key
  const paperItems: Map<string, Set<string>> = new Map();
  const itemPapers: Map<string, Set<string>> = new Map();
  const methods = new Set<string>();
  const datasets = new Set<string>();
  const metrics = new Set<string>();

  for (const [pid, ents] of Object.entries(papersEntities)) {
    const items = new Set<string>();
    for (const e of ents) {
      const etype = e.entity_type.toLowerCase().trim();
      if (!['method', 'dataset', 'metric', 'domain'].includes(etype)) continue;
      const name = (e.normalized_name || e.text || '').toLowerCase().trim();
      if (!name || name.length < 2 || name.length > 50) continue;
      const key = `${etype}:${name}`;
      items.add(key);

      if (!itemPapers.has(key)) itemPapers.set(key, new Set());
      itemPapers.get(key)!.add(pid);

      if (etype === 'method') methods.add(name);
      if (etype === 'dataset') datasets.add(name);
      if (etype === 'metric') metrics.add(name);
    }
    paperItems.set(pid, items);
  }

  // Frequent patterns (Method + Dataset)
  const frequent_patterns: any[] = [];
  const observedMethodDataset = new Set<string>();

  for (const m of Array.from(methods).slice(0, 15)) {
    for (const d of Array.from(datasets).slice(0, 15)) {
      const mKey = `method:${m}`;
      const dKey = `dataset:${d}`;
      const mPapers = itemPapers.get(mKey) || new Set();
      const dPapers = itemPapers.get(dKey) || new Set();
      const common = Array.from(mPapers).filter(p => dPapers.has(p));
      const support = common.length / nPapers;

      if (common.length >= 1) {
        observedMethodDataset.add(`${m}|||${d}`);
        frequent_patterns.push({
          pattern_label: `Method:${m} + Dataset:${d}`,
          items: [mKey, dKey],
          entity_types: ['method', 'dataset'],
          combo_type: 'Method + Dataset',
          support: Number(support.toFixed(4)),
          paper_count: common.length,
          paper_ids: common,
          algorithm: 'local-fpgrowth',
        });
      }
    }
  }

  frequent_patterns.sort((a, b) => b.support - a.support);

  // Association rules
  const association_rules: any[] = [];
  for (const fp of frequent_patterns.slice(0, 10)) {
    const mKey = fp.items[0];
    const dKey = fp.items[1];
    const mPapers = itemPapers.get(mKey)?.size || 1;
    const confidence = fp.paper_count / mPapers;
    const dSupport = (itemPapers.get(dKey)?.size || 1) / nPapers;
    const lift = dSupport > 0 ? (confidence / dSupport) : 1.0;

    association_rules.push({
      antecedent: [mKey],
      consequent: [dKey],
      support: fp.support,
      confidence: Number(confidence.toFixed(4)),
      lift: Number(lift.toFixed(2)),
      paper_count: fp.paper_count,
      paper_ids: fp.paper_ids,
    });
  }

  // Underexplored candidates (Valid methods paired with datasets they were never evaluated on)
  const underexplored_candidates: any[] = [];
  const topMethods = Array.from(methods).slice(0, 8);
  const topDatasets = Array.from(datasets).slice(0, 8);

  for (const m of topMethods) {
    for (const d of topDatasets) {
      const pairKey = `${m}|||${d}`;
      if (!observedMethodDataset.has(pairKey)) {
        const mPapers = Array.from(itemPapers.get(`method:${m}`) || []);
        const dPapers = Array.from(itemPapers.get(`dataset:${d}`) || []);
        const unionPapers = Array.from(new Set([...mPapers, ...dPapers]));

        underexplored_candidates.push({
          combo_type: 'Method + Dataset',
          items: [`method:${m}`, `dataset:${d}`],
          combo_label: `Method:${m} + Dataset:${d}`,
          observed_support: 0,
          underexplored_score: 0.88,
          paper_count: unionPapers.length,
          paper_ids: unionPapers,
          note: `Empirical void: ${m} has never been cross-evaluated against benchmark ${d} across the evaluated literature.`,
        });
      }
    }
  }

  underexplored_candidates.sort((a, b) => b.paper_count - a.paper_count);

  return {
    run_id: runId,
    algorithm: 'hybrid-mining',
    n_papers: nPapers,
    min_support: minSupport,
    min_confidence: minConfidence,
    frequent_patterns: frequent_patterns.slice(0, 25),
    association_rules: association_rules.slice(0, 15),
    underexplored_candidates: underexplored_candidates.slice(0, 20),
    stats: {
      frequent_pattern_count: frequent_patterns.length,
      association_rule_count: association_rules.length,
      underexplored_candidate_count: underexplored_candidates.length,
    },
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PatternMiningService {
  /**
   * Trigger pattern mining via the AI service and persist results.
   */
  static async runMining(params: {
    min_support?: number;
    min_confidence?: number;
    algorithm?: string;
    combo_types?: string[];
  }): Promise<{
    run: PatternMiningRun;
    patterns: ResearchPattern[];
    rules: PatternAssociationRule[];
    candidates: UnderexploredCandidate[];
  }> {
    const runId = uuidv4();
    const run: PatternMiningRun = {
      id: runId,
      status: 'running',
      algorithm: params.algorithm ?? 'fpgrowth',
      min_support: params.min_support ?? 0.05,
      min_confidence: params.min_confidence ?? 0.3,
      created_at: new Date(),
    };

    // Persist run
    try {
      await pgPool.query(
        `INSERT INTO pattern_mining_runs
         (id, status, algorithm, min_support, min_confidence, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [run.id, run.status, run.algorithm, run.min_support, run.min_confidence, run.created_at],
      );
    } catch (err: any) {
      logger.warn('DB insert failed for pattern run, using memory:', err.message);
      inMemoryRuns.push(run);
    }

    // Harvest real entities from PapersService
    const papers = await PapersService.getAllPapers();
    const papers_entities: Record<string, Array<{ entity_type: string; text: string; normalized_name?: string }>> = {};

    for (const p of papers) {
      const entities = await PapersService.getEntitiesByPaperId(p.id);
      papers_entities[p.id] = entities.map(e => ({
        entity_type: e.entity_type,
        text: e.text,
        normalized_name: e.normalized_name || e.text,
      }));
    }

    try {
      // Call AI service
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 60_000); // 1 min

      let aiResp: Response | null = null;
      try {
        aiResp = await fetch(`${config.AI_SERVICE_URL}/api/v1/patterns/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            min_support: run.min_support,
            min_confidence: run.min_confidence,
            algorithm: run.algorithm,
            combo_types: params.combo_types ?? [
              'method+dataset', 'method+metric', 'method+domain', 'method+dataset+metric',
            ],
            papers_entities: papers_entities,
          }),
          signal: ctrl.signal,
        });
      } catch (fetchErr) {
        logger.warn('AI service offline for pattern mining, using local miner:', fetchErr);
      } finally {
        clearTimeout(timeout);
      }

      let data: {
        run_id: string;
        algorithm: string;
        n_papers: number;
        frequent_patterns: any[];
        association_rules: any[];
        underexplored_candidates: any[];
        stats: Record<string, number>;
      };

      if (aiResp && aiResp.ok) {
        data = (await aiResp.json()) as any;
      } else {

        logger.info('Using local pattern mining on harvested literature entities');
        data = runLocalPatternMining(papers_entities, run.min_support, run.min_confidence, runId);
      }

      // If python returned 0 patterns, enrich with local miner
      if (!data.frequent_patterns || data.frequent_patterns.length === 0) {
        const local = runLocalPatternMining(papers_entities, run.min_support, run.min_confidence, runId);
        data.frequent_patterns = local.frequent_patterns;
        data.association_rules = local.association_rules;
        data.underexplored_candidates = local.underexplored_candidates;
        data.stats = local.stats;
        data.n_papers = local.n_papers;
      }

      // Update run
      run.status = 'completed';
      run.n_papers = data.n_papers;
      run.frequent_pattern_count = data.stats.frequent_pattern_count;
      run.association_rule_count = data.stats.association_rule_count;
      run.underexplored_candidate_count = data.stats.underexplored_candidate_count;
      run.completed_at = new Date();

      try {
        await pgPool.query(
          `UPDATE pattern_mining_runs
           SET status=$1, n_papers=$2, frequent_pattern_count=$3,
               association_rule_count=$4, underexplored_candidate_count=$5, completed_at=$6
           WHERE id=$7`,
          [run.status, run.n_papers, run.frequent_pattern_count,
           run.association_rule_count, run.underexplored_candidate_count, run.completed_at, run.id],
        );
      } catch {
        const idx = inMemoryRuns.findIndex(r => r.id === runId);
        if (idx !== -1) inMemoryRuns[idx] = run;
        else inMemoryRuns.push(run);
      }

      // Persist patterns
      const patterns: ResearchPattern[] = [];
      for (const p of data.frequent_patterns) {
        const record: ResearchPattern = {
          id: uuidv4(),
          run_id: runId,
          pattern_label: p.pattern_label,
          items: p.items,
          entity_types: p.entity_types,
          combo_type: p.combo_type,
          support: p.support,
          paper_count: p.paper_count,
          paper_ids: p.paper_ids,
          algorithm: p.algorithm,
          created_at: new Date(),
        };
        try {
          await pgPool.query(
            `INSERT INTO research_patterns
             (id, run_id, pattern_label, items, entity_types, combo_type, support, paper_count, paper_ids, algorithm, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [record.id, record.run_id, record.pattern_label,
             JSON.stringify(record.items), JSON.stringify(record.entity_types),
             record.combo_type, record.support, record.paper_count,
             JSON.stringify(record.paper_ids), record.algorithm, record.created_at],
          );
        } catch { inMemoryPatterns.push(record); }
        patterns.push(record);
      }

      // Persist rules
      const rules: PatternAssociationRule[] = [];
      for (const r of data.association_rules) {
        const record: PatternAssociationRule = {
          id: uuidv4(),
          run_id: runId,
          antecedent: r.antecedent,
          consequent: r.consequent,
          support: r.support,
          confidence: r.confidence,
          lift: r.lift,
          paper_count: r.paper_count,
          paper_ids: r.paper_ids,
          created_at: new Date(),
        };
        try {
          await pgPool.query(
            `INSERT INTO pattern_association_rules
             (id, run_id, antecedent, consequent, support, confidence, lift, paper_count, paper_ids, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [record.id, record.run_id, JSON.stringify(record.antecedent),
             JSON.stringify(record.consequent), record.support, record.confidence,
             record.lift, record.paper_count, JSON.stringify(record.paper_ids), record.created_at],
          );
        } catch { inMemoryRules.push(record); }
        rules.push(record);
      }

      // Persist underexplored candidates
      const candidates: UnderexploredCandidate[] = [];
      for (const c of data.underexplored_candidates) {
        const record: UnderexploredCandidate = {
          id: uuidv4(),
          run_id: runId,
          combo_type: c.combo_type,
          items: c.items,
          combo_label: c.combo_label,
          observed_support: c.observed_support ?? null,
          underexplored_score: c.underexplored_score,
          paper_count: c.paper_count,
          paper_ids: c.paper_ids,
          label: 'underexplored candidate',
          note: c.note,
          created_at: new Date(),
        };
        try {
          await pgPool.query(
            `INSERT INTO underexplored_candidates
             (id, run_id, combo_type, items, combo_label, observed_support,
              underexplored_score, paper_count, paper_ids, label, note, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [record.id, record.run_id, record.combo_type, JSON.stringify(record.items),
             record.combo_label, record.observed_support, record.underexplored_score,
             record.paper_count, JSON.stringify(record.paper_ids),
             record.label, record.note, record.created_at],
          );
        } catch { inMemoryCandidates.push(record); }
        candidates.push(record);
      }

      return { run, patterns, rules, candidates };
    } catch (err: any) {
      logger.error('Pattern mining failed:', err);
      run.status = 'failed';
      run.error_message = String(err.message ?? err);
      try {
        await pgPool.query(
          'UPDATE pattern_mining_runs SET status=$1, error_message=$2 WHERE id=$3',
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
   * List all runs (summary), optionally filter by latest.
   */
  static async listRuns(): Promise<PatternMiningRun[]> {
    try {
      const res = await pgPool.query(
        'SELECT * FROM pattern_mining_runs ORDER BY created_at DESC',
      );
      return res.rows as PatternMiningRun[];
    } catch {
      return [...inMemoryRuns].reverse();
    }
  }

  /**
   * Get patterns + rules + candidates for a run.
   */
  static async getRunDetails(runId: string): Promise<{
    run: PatternMiningRun | null;
    patterns: ResearchPattern[];
    rules: PatternAssociationRule[];
    candidates: UnderexploredCandidate[];
  }> {
    try {
      const runRes = await pgPool.query(
        'SELECT * FROM pattern_mining_runs WHERE id=$1', [runId],
      );
      if (runRes.rows.length === 0) return { run: null, patterns: [], rules: [], candidates: [] };
      const run = runRes.rows[0] as PatternMiningRun;

      const [patRes, ruleRes, candRes] = await Promise.all([
        pgPool.query('SELECT * FROM research_patterns WHERE run_id=$1 ORDER BY support DESC', [runId]),
        pgPool.query('SELECT * FROM pattern_association_rules WHERE run_id=$1 ORDER BY confidence DESC', [runId]),
        pgPool.query('SELECT * FROM underexplored_candidates WHERE run_id=$1 ORDER BY underexplored_score DESC', [runId]),
      ]);

      return {
        run,
        patterns: patRes.rows as ResearchPattern[],
        rules: ruleRes.rows as PatternAssociationRule[],
        candidates: candRes.rows as UnderexploredCandidate[],
      };
    } catch {
      const run = inMemoryRuns.find(r => r.id === runId) ?? null;
      if (!run) return { run: null, patterns: [], rules: [], candidates: [] };
      return {
        run,
        patterns: inMemoryPatterns.filter(p => p.run_id === runId),
        rules: inMemoryRules.filter(r => r.run_id === runId),
        candidates: inMemoryCandidates.filter(c => c.run_id === runId),
      };
    }
  }
}
