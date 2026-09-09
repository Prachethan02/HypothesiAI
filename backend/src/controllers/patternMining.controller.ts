import { Request, Response } from 'express';
import { PatternMiningService } from '../services/patternMining.service';
import { logger } from '../utils/logger';

export class PatternMiningController {
  /** POST /api/v1/patterns/run */
  static async run(req: Request, res: Response): Promise<void> {
    try {
      const {
        min_support = 0.02,
        min_confidence = 0.3,
        algorithm = 'fpgrowth',
        combo_types,
      } = req.body ?? {};

      if (min_support < 0.001 || min_support > 1) {
        res.status(400).json({ success: false, error: 'min_support must be between 0.001 and 1.' });
        return;
      }

      const { run, patterns, rules, candidates } = await PatternMiningService.runMining({
        min_support,
        min_confidence,
        algorithm,
        combo_types,
      });

      res.status(200).json({
        success: true,
        data: {
          run_id: run.id,
          status: run.status,
          algorithm: run.algorithm,
          n_papers: run.n_papers,
          frequent_pattern_count: patterns.length,
          association_rule_count: rules.length,
          underexplored_candidate_count: candidates.length,
          frequent_patterns: patterns,
          association_rules: rules,
          underexplored_candidates: candidates,
        },
      });
    } catch (err: any) {
      logger.error('Pattern mining controller error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Pattern mining failed.' });
    }
  }

  /** GET /api/v1/patterns */
  static async listRuns(req: Request, res: Response): Promise<void> {
    try {
      const runs = await PatternMiningService.listRuns();
      res.status(200).json({ success: true, data: runs });
    } catch (err: any) {
      logger.error('List pattern runs error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to list runs.' });
    }
  }

  /** GET /api/v1/patterns/:runId */
  static async getRunDetails(req: Request, res: Response): Promise<void> {
    try {
      const runId = req.params.runId as string;
      const result = await PatternMiningService.getRunDetails(runId);

      if (!result.run) {
        res.status(404).json({ success: false, error: `Run ${runId} not found.` });
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      logger.error('Get pattern run error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to retrieve run.' });
    }
  }
}
