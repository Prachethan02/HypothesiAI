import { Request, Response } from 'express';
import { EvidenceService } from '../services/evidence.service';
import { logger } from '../utils/logger';

export class EvidenceController {
  /** POST /api/v1/evidence/aggregate */
  static async aggregate(req: Request, res: Response): Promise<void> {
    try {
      const {
        weights,
        min_score = 0.20,
        min_paper_support = 1,
        target_domain,
      } = req.body ?? {};

      const result = await EvidenceService.runAggregation({
        weights,
        min_score,
        min_paper_support,
        target_domain,
      });

      res.status(200).json({
        success: true,
        data: {
          run_id: result.run.id,
          status: result.run.status,
          stats: result.stats,
          weights_used: result.weights_used,
          evidence: result.evidence,
        },
      });
    } catch (err: any) {
      logger.error('Evidence aggregation controller error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Evidence aggregation failed.' });
    }
  }

  /** GET /api/v1/evidence */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { signal_type, min_score } = req.query;

      const items = await EvidenceService.listEvidence({
        signal_type: signal_type ? String(signal_type) : undefined,
        min_score: min_score ? Number(min_score) : undefined,
      });

      res.status(200).json({ success: true, data: items });
    } catch (err: any) {
      logger.error('List evidence controller error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to list evidence.' });
    }
  }

  /** GET /api/v1/evidence/weights */
  static async getWeights(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        recurring_limitations: 0.12,
        future_work_frequency: 0.12,
        limitation_clusters: 0.15,
        topic_trends: 0.06,
        underexplored_method_dataset: 0.12,
        contradiction_evidence: 0.15,
        kg_structural_gaps: 0.10,
        disconnected_research_areas: 0.08,
        temporal_decline_stagnation: 0.05,
        independent_paper_support: 0.05,
      },
    });
  }

  /** GET /api/v1/evidence/:id */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const item = await EvidenceService.getEvidenceById(id);

      if (!item) {
        res.status(404).json({ success: false, error: `Evidence item ${id} not found.` });
        return;
      }

      res.status(200).json({ success: true, data: item });
    } catch (err: any) {
      logger.error('Get evidence by ID error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to get evidence.' });
    }
  }
}
