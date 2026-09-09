import { Request, Response } from 'express';
import { EvidenceClustersService } from '../services/evidenceClusters.service';
import { logger } from '../utils/logger';

export class EvidenceClustersController {
  /** POST /api/v1/evidence-clusters/run */
  static async run(req: Request, res: Response): Promise<void> {
    try {
      const minClusterSize = Number(req.body?.min_cluster_size ?? 3);
      const statementTypes: string[] = req.body?.statement_types ?? [
        'limitation',
        'future_work',
        'problem',
      ];
      const includeNoise: boolean = req.body?.include_noise !== false;

      if (minClusterSize < 2) {
        res.status(400).json({ success: false, error: 'min_cluster_size must be >= 2' });
        return;
      }

      const { run, clusters, noiseCount } =
        await EvidenceClustersService.runClustering(minClusterSize, statementTypes, includeNoise);

      res.status(200).json({
        success: true,
        data: {
          run_id: run.id,
          status: run.status,
          cluster_count: clusters.length,
          noise_count: noiseCount,
          clusters,
        },
      });
    } catch (err: any) {
      logger.error('Evidence clustering controller error:', err);
      res.status(500).json({
        success: false,
        error: err.message ?? 'Evidence clustering failed.',
      });
    }
  }

  /** GET /api/v1/evidence-clusters */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const runId = req.query.run_id as string | undefined;
      const includeNoise = req.query.include_noise !== 'false';

      const { run, clusters, statements } = await EvidenceClustersService.listClusters(
        runId,
        includeNoise,
      );

      if (!run) {
        res.status(200).json({
          success: true,
          data: {
            run: null,
            clusters: [],
            message: 'No completed clustering runs found. Trigger a run first.',
          },
        });
        return;
      }

      // Attach statements to clusters
      const enriched = clusters.map(c => ({
        ...c,
        statements: statements[c.id] ?? [],
      }));

      res.status(200).json({
        success: true,
        data: {
          run,
          clusters: enriched,
          total_clustered: clusters.filter(c => !c.is_noise).reduce((s, c) => s + c.size, 0),
          noise_count: clusters.find(c => c.is_noise)?.size ?? 0,
        },
      });
    } catch (err: any) {
      logger.error('List evidence clusters controller error:', err);
      res.status(500).json({
        success: false,
        error: err.message ?? 'Failed to retrieve evidence clusters.',
      });
    }
  }

  /** GET /api/v1/evidence-clusters/:runId */
  static async getByRunId(req: Request, res: Response): Promise<void> {
    try {
      const runId = req.params.runId as string;
      const includeNoise = req.query.include_noise !== 'false';

      const { run, clusters, statements } = await EvidenceClustersService.listClusters(
        runId,
        includeNoise,
      );

      if (!run) {
        res.status(404).json({ success: false, error: `Run ${runId} not found.` });
        return;
      }

      const enriched = clusters.map(c => ({
        ...c,
        statements: statements[c.id] ?? [],
      }));

      res.status(200).json({ success: true, data: { run, clusters: enriched } });
    } catch (err: any) {
      logger.error('Get cluster run controller error:', err);
      res.status(500).json({
        success: false,
        error: err.message ?? 'Failed to retrieve cluster run.',
      });
    }
  }
}
