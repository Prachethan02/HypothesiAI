import { Request, Response } from 'express';
import { ContradictionsService } from '../services/contradictions.service';
import { logger } from '../utils/logger';
import type { ContradictionVerificationStatus } from '../db/types';

export class ContradictionsController {
  /** POST /api/v1/contradictions/analyze */
  static async analyze(req: Request, res: Response): Promise<void> {
    try {
      const {
        semantic_threshold = 0.55,
        min_confidence = 0.5,
        max_comparisons = 500,
        target_paper_id,
      } = req.body ?? {};

      if (semantic_threshold < 0.1 || semantic_threshold > 1.0) {
        res.status(400).json({ success: false, error: 'semantic_threshold must be between 0.1 and 1.0.' });
        return;
      }

      const result = await ContradictionsService.runAnalysis({
        semantic_threshold,
        min_confidence,
        max_comparisons,
        target_paper_id,
      });

      res.status(200).json({
        success: true,
        data: {
          run_id: result.run.id,
          status: result.run.status,
          stats: result.stats,
          comparisons: result.comparisons,
        },
      });
    } catch (err: any) {
      logger.error('Contradiction analysis controller error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Contradiction analysis failed.' });
    }
  }

  /** GET /api/v1/contradictions */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { label, min_confidence, status, paper_id } = req.query;

      const comparisons = await ContradictionsService.listComparisons({
        label: label ? String(label) : undefined,
        min_confidence: min_confidence ? Number(min_confidence) : undefined,
        status: status ? String(status) : undefined,
        paper_id: paper_id ? String(paper_id) : undefined,
      });

      res.status(200).json({ success: true, data: comparisons });
    } catch (err: any) {
      logger.error('List contradictions controller error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to list comparisons.' });
    }
  }

  /** GET /api/v1/contradictions/:id */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const comparison = await ContradictionsService.getComparisonById(id);

      if (!comparison) {
        res.status(404).json({ success: false, error: `Comparison evidence ${id} not found.` });
        return;
      }

      res.status(200).json({ success: true, data: comparison });
    } catch (err: any) {
      logger.error('Get contradiction by ID error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to get comparison evidence.' });
    }
  }

  /** PATCH /api/v1/contradictions/:id/status */
  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status, review_notes } = req.body ?? {};

      if (!status || !['candidate_signal', 'confirmed', 'dismissed'].includes(status)) {
        res.status(400).json({
          success: false,
          error: "Valid status ('candidate_signal', 'confirmed', 'dismissed') is required.",
        });
        return;
      }

      const updated = await ContradictionsService.updateStatus(
        id,
        status as ContradictionVerificationStatus,
        review_notes,
      );

      if (!updated) {
        res.status(404).json({ success: false, error: `Comparison evidence ${id} not found.` });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (err: any) {
      logger.error('Update contradiction status error:', err);
      res.status(500).json({ success: false, error: err.message ?? 'Failed to update status.' });
    }
  }
}
