import { Request, Response } from 'express';
import { CorpusService } from '../services/corpus.service';
import { CorpusAnalysisOrchestrator } from '../services/corpusAnalysis.orchestrator';
import { logger } from '../utils/logger';

export class CorpusController {
  /**
   * POST /api/v1/corpora — Create a new research corpus
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, description } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({
          success: false,
          error: { message: 'Corpus name is required', statusCode: 400 },
        });
        return;
      }

      const userId = (req as any).user?.userId || (req as any).user?.id;
      const corpus = await CorpusService.createCorpus({
        userId,
        name: name.trim(),
        description: description ? String(description).trim() : undefined,
      });

      res.status(201).json({
        success: true,
        data: corpus,
      });
    } catch (err: any) {
      logger.error('Failed to create corpus:', err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to create corpus', statusCode: 500 },
      });
    }
  }

  /**
   * GET /api/v1/corpora — List all corpora for current user
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const corpora = await CorpusService.listCorpora(userId);

      res.status(200).json({
        success: true,
        data: corpora,
      });
    } catch (err: any) {
      logger.error('Failed to list corpora:', err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to list corpora', statusCode: 500 },
      });
    }
  }

  /**
   * GET /api/v1/corpora/:id — Get corpus details with papers
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const corpus = await CorpusService.getCorpusById(id);
      if (!corpus) {
        res.status(404).json({
          success: false,
          error: { message: `Corpus ${id} not found`, statusCode: 404 },
        });
        return;
      }

      const papers = await CorpusService.getCorpusPapers(id);

      res.status(200).json({
        success: true,
        data: {
          ...corpus,
          papers,
        },
      });
    } catch (err: any) {
      logger.error(`Failed to get corpus ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to get corpus', statusCode: 500 },
      });
    }
  }

  /**
   * DELETE /api/v1/corpora/:id/papers/:paperId — Remove a paper from a corpus
   */
  static async removePaper(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const paperId = String(req.params.paperId);
      const removed = await CorpusService.removePaperFromCorpus(id, paperId);
      if (!removed) {
        res.status(404).json({
          success: false,
          error: { message: 'Paper not found in this corpus', statusCode: 404 },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Paper successfully removed from corpus',
      });
    } catch (err: any) {
      logger.error(`Failed to remove paper ${req.params.paperId} from corpus ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to remove paper from corpus', statusCode: 500 },
      });
    }
  }

  /**
    * DELETE /api/v1/corpora/:id — Delete a corpus
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deletePapers = req.query.delete_papers !== 'false';
      const deleted = await CorpusService.deleteCorpus(id, deletePapers);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { message: `Corpus ${id} not found`, statusCode: 404 },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Corpus and associated data successfully deleted',
      });
    } catch (err: any) {
      logger.error(`Failed to delete corpus ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to delete corpus', statusCode: 500 },
      });
    }
  }

  /**
   * POST /api/v1/corpora/purge — Purge the whole corpus and all data
   */
  static async purgeWholeCorpus(req: Request, res: Response): Promise<void> {
    try {
      const result = await CorpusService.purgeWholeCorpus();
      res.status(200).json({
        success: true,
        message: 'Whole corpus successfully deleted. All papers, extractions, and downstream gaps have been wiped.',
        data: result,
      });
    } catch (err: any) {
      logger.error('Failed to purge whole corpus:', err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to purge whole corpus', statusCode: 500 },
      });
    }
  }

  /**
   * POST /api/v1/corpora/:id/papers — Link an existing paper (by paperId) to this corpus.
   * Used by the academic search UI to add externally-found papers without re-uploading.
   */
  static async addPaper(req: Request, res: Response): Promise<void> {
    try {
      const corpusId = String(req.params.id);
      const { paper_id, source } = req.body || {};

      if (!paper_id || typeof paper_id !== 'string' || !paper_id.trim()) {
        res.status(400).json({
          success: false,
          error: { message: 'paper_id is required', statusCode: 400 },
        });
        return;
      }

      const corpus = await CorpusService.getCorpusById(corpusId);
      if (!corpus) {
        res.status(404).json({
          success: false,
          error: { message: `Corpus ${corpusId} not found`, statusCode: 404 },
        });
        return;
      }

      const entry = await CorpusService.addPaperToCorpus(
        corpusId,
        paper_id.trim(),
        (source === 'academic_search' ? 'academic_search' : 'upload') as 'upload' | 'academic_search'
      );

      res.status(201).json({
        success: true,
        data: entry,
      });
    } catch (err: any) {
      logger.error(`Failed to add paper to corpus ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to add paper to corpus', statusCode: 500 },
      });
    }
  }

  /**
   * POST /api/v1/corpora/:id/analyze — Start end-to-end analysis orchestration for a corpus.
   * Runs: topics → clustering → patterns → contradictions → evidence → gap ranking
   * Returns immediately with status=started; poll /analysis-status for progress.
   */
  static async startAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const corpusId = String(req.params.id);
      const corpus = await CorpusService.getCorpusById(corpusId);

      if (!corpus) {
        res.status(404).json({
          success: false,
          error: { message: `Corpus ${corpusId} not found`, statusCode: 404 },
        });
        return;
      }

      const papers = await CorpusService.getCorpusPapers(corpusId);
      if (papers.length === 0) {
        res.status(422).json({
          success: false,
          error: { message: 'Corpus has no papers. Upload papers before running analysis.', statusCode: 422 },
        });
        return;
      }

      // Start orchestration in background (non-blocking)
      CorpusAnalysisOrchestrator.run(corpusId).catch((err) => {
        logger.error(`Background analysis failed for corpus ${corpusId}:`, err);
      });

      res.status(202).json({
        success: true,
        message: 'Analysis started. Poll /analysis-status for progress.',
        data: {
          corpus_id: corpusId,
          status: 'analyzing',
          paper_count: papers.length,
        },
      });
    } catch (err: any) {
      logger.error(`Failed to start analysis for corpus ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to start analysis', statusCode: 500 },
      });
    }
  }

  /**
   * GET /api/v1/corpora/:id/analysis-status — Poll analysis progress.
   * Returns corpus status, analysis_progress percentage, and step details.
   */
  static async getAnalysisStatus(req: Request, res: Response): Promise<void> {
    try {
      const corpusId = String(req.params.id);
      const corpus = await CorpusService.getCorpusById(corpusId);

      if (!corpus) {
        res.status(404).json({
          success: false,
          error: { message: `Corpus ${corpusId} not found`, statusCode: 404 },
        });
        return;
      }

      const stepInfo = CorpusAnalysisOrchestrator.getStepInfo(corpusId);

      res.status(200).json({
        success: true,
        data: {
          corpus_id: corpusId,
          status: corpus.status,
          analysis_progress: corpus.analysis_progress ?? 0,
          current_step: stepInfo?.current_step ?? null,
          steps_completed: stepInfo?.steps_completed ?? [],
          error: stepInfo?.error ?? null,
        },
      });
    } catch (err: any) {
      logger.error(`Failed to get analysis status for corpus ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to get analysis status', statusCode: 500 },
      });
    }
  }
}

