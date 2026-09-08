/**
 * ResolutionController — Stage 8
 * ================================
 * Handles HTTP requests for entity normalization.
 */
import type { Request, Response, NextFunction } from 'express';
import { ResolutionService } from '../services/resolution.service';
import { PapersService } from '../services/papers.service';
import { logger } from '../utils/logger';

export class ResolutionController {
  /**
   * POST /api/v1/resolution/resolve
   * Resolve a list of raw entities through the AI normalization engine.
   */
  static async resolveEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entities, config: resolutionConfig } = req.body;
      if (!Array.isArray(entities) || entities.length === 0) {
        res.status(400).json({ error: 'entities array is required and must not be empty' });
        return;
      }
      const result = await ResolutionService.resolveEntities(entities, resolutionConfig);
      res.json(result);
    } catch (err) {
      logger.error('[ResolutionController] resolveEntities failed', err);
      next(err);
    }
  }

  /**
   * POST /api/v1/resolution/compare
   * Compare a pair of entities and return merge decision with audit.
   */
  static async comparePair(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entity_a, entity_b, config: resolutionConfig } = req.body;
      if (!entity_a?.text || !entity_b?.text) {
        res.status(400).json({ error: 'entity_a and entity_b with text fields are required' });
        return;
      }
      const result = await ResolutionService.comparePair(entity_a, entity_b, resolutionConfig);
      res.json(result);
    } catch (err) {
      logger.error('[ResolutionController] comparePair failed', err);
      next(err);
    }
  }

  /**
   * POST /api/v1/papers/:id/resolve
   * Resolve and normalize all extracted entities for a given paper.
   */
  static async resolvePaperEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paperId = req.params['id'] as string;
      const { config: resolutionConfig } = req.body ?? {};

      const paper = await PapersService.getPaperById(paperId);
      if (!paper) {
        res.status(404).json({ error: `Paper ${paperId} not found` });
        return;
      }

      logger.info(`[ResolutionController] Resolving entities for paper_id=${paperId}`);
      const result = await ResolutionService.resolvePaperEntities(paperId, resolutionConfig);
      res.json({
        paper_id: paperId,
        ...result,
      });
    } catch (err) {
      logger.error('[ResolutionController] resolvePaperEntities failed', err);
      next(err);
    }
  }

  /**
   * GET /api/v1/papers/:id/resolution-audit
   * Retrieve the resolution audit trail for a paper.
   */
  static async getResolutionAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paperId = req.params['id'] as string;
      const decisions = await PapersService.getResolutionDecisions(paperId);
      res.json({
        paper_id: paperId,
        count: decisions.length,
        decisions,
      });
    } catch (err) {
      logger.error('[ResolutionController] getResolutionAudit failed', err);
      next(err);
    }
  }
}
