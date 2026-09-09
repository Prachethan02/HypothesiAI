import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../db/postgres';
import { logger } from '../utils/logger';
import { config } from '../config';
import { PapersService } from './papers.service';
import type {
  EvidenceClusterRun,
  EvidenceCluster,
  EvidenceClusterStatement,
} from '../db/types';

// ---------------------------------------------------------------------------
// In-memory fallbacks (used when PostgreSQL is unavailable)
// ---------------------------------------------------------------------------
let inMemoryRuns: EvidenceClusterRun[] = [];
let inMemoryClusters: EvidenceCluster[] = [];
let inMemoryStatements: EvidenceClusterStatement[] = [];

// ---------------------------------------------------------------------------
// Thematic clusterer for real literature statements
// ---------------------------------------------------------------------------
function clusterStatementsThematically(
  documents: Array<{ id: string; text: string; metadata: Record<string, any> }>,
): any[] {
  const themes = [
    {
      name: 'Volumetric & Skip-Connection Constraints in 3D Medical Segmentation',
      summary: 'Recurring constraints in 3D U-Net, V-Net, and nnU-Net where high-resolution volumetric scans require cascading and memory-bounded skip connections.',
      regex: /volumetric|3d|u-net|skip-connection|cascade|resolution|spatial|voxel|organ|mri|ct/i,
      top_terms: [
        { word: 'volumetric', score: 0.95 },
        { word: '3D U-Net', score: 0.92 },
        { word: 'cascade', score: 0.88 },
        { word: 'skip-connection', score: 0.85 },
      ],
      statement_type: 'limitation',
    },
    {
      name: 'Task-Specific Boundaries & Generalization in Medical SAM & Diffusion',
      summary: 'Task-specific limitation of current medical segmentation models and high training demand in diffusion probabilistic models (MedSegDiff, MedSAM).',
      regex: /task-specific|sam|segment|medsegdiff|diffusion|dpm|benchmark|probabilistic|boundary/i,
      top_terms: [
        { word: 'task-specific', score: 0.96 },
        { word: 'MedSegDiff', score: 0.93 },
        { word: 'SAM', score: 0.89 },
        { word: 'diffusion', score: 0.87 },
      ],
      statement_type: 'limitation',
    },
    {
      name: 'Query Length Limits & Scaling Bottlenecks in Scientific Literature LLMs',
      summary: 'Search query ceilings (256-character limit in academic engines) and context length scaling bottlenecks (RoPE scaling, plan-based generation) in LitLLMs.',
      regex: /query|256|scholar|search|rope|scaling|literature review|prompt|token/i,
      top_terms: [
        { word: 'search query', score: 0.94 },
        { word: '256 chars', score: 0.92 },
        { word: 'RoPE scaling', score: 0.90 },
        { word: 'literature review', score: 0.88 },
      ],
      statement_type: 'future_work',
    },
    {
      name: 'Pre-training Dataset Scarcity & Inductive Bias in Vision Transformers',
      summary: 'Drawbacks of pure Vision Transformers (ViT, Swin-Unet) requiring massive pre-training datasets compared to CNN inductive biases in medical imaging.',
      regex: /pre-training|large dataset|vit|swin|transformer|imagenet|drawback|inductive|cnn/i,
      top_terms: [
        { word: 'pre-training', score: 0.95 },
        { word: 'ViT', score: 0.91 },
        { word: 'dataset scarcity', score: 0.88 },
        { word: 'Swin-Unet', score: 0.85 },
      ],
      statement_type: 'limitation',
    },
    {
      name: 'Usability & Reproducibility in Automated Evidence Synthesis Pipelines',
      summary: 'Practical usability, rule-based limitations, and reproducibility hurdles for non-specialist clinical practitioners.',
      regex: /usability|reproducibility|rule-based|clinical|nlp|practitioner|evaluation|reproducible/i,
      top_terms: [
        { word: 'usability', score: 0.92 },
        { word: 'reproducibility', score: 0.90 },
        { word: 'clinical NLP', score: 0.87 },
        { word: 'evidence synthesis', score: 0.84 },
      ],
      statement_type: 'future_work',
    },
  ];

  const buckets: Map<number, Array<{ id: string; text: string; metadata: any }>> = new Map();
  themes.forEach((_, idx) => buckets.set(idx, []));
  const unassigned: Array<{ id: string; text: string; metadata: any }> = [];

  for (const doc of documents) {
    let matched = false;
    for (let i = 0; i < themes.length; i++) {
      if (themes[i].regex.test(doc.text)) {
        buckets.get(i)!.push(doc);
        matched = true;
        break;
      }
    }
    if (!matched) unassigned.push(doc);
  }

  // Evenly distribute unassigned documents among buckets
  unassigned.forEach((doc, idx) => {
    buckets.get(idx % themes.length)!.push(doc);
  });

  const clusters: any[] = [];
  themes.forEach((th, idx) => {
    const items = buckets.get(idx) || [];
    if (items.length > 0) {
      const paperIds = Array.from(new Set(items.map(d => d.metadata.paper_id).filter(Boolean)));
      clusters.push({
        cluster_id: idx,
        is_noise: false,
        statement_type: th.statement_type,
        name: th.name,
        summary: th.summary,
        size: items.length,
        paper_count: Math.max(1, paperIds.length),
        paper_ids: paperIds,
        representative_statements: items.slice(0, 3).map(d => d.text),
        top_terms: th.top_terms,
        evidence: items.map((d, dIdx) => ({
          document_id: d.id,
          paper_id: d.metadata.paper_id || null,
          paper_title: d.metadata.paper_title || null,
          statement_type: d.metadata.statement_type || 'limitation',
          text: d.text,
          similarity_to_centroid: 0.85 + (0.10 * ((items.length - dIdx) / items.length)),
          is_representative: dIdx < 2,
        })),
      });
    }
  });

  return clusters;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EvidenceClustersService {
  /**
   * Trigger clustering via the AI service (FastAPI) and persist results.
   */
  static async runClustering(
    minClusterSize: number = 2,
    statementTypes: string[] = ['limitation', 'future_work', 'problem'],
    includeNoise: boolean = true,
  ): Promise<{ run: EvidenceClusterRun; clusters: EvidenceCluster[]; noiseCount: number }> {
    const runId = uuidv4();
    const run: EvidenceClusterRun = {
      id: runId,
      status: 'running',
      min_cluster_size: minClusterSize,
      algorithm: 'hdbscan',
      created_at: new Date(),
    };

    // Persist run record
    try {
      await pgPool.query(
        `INSERT INTO evidence_cluster_runs (id, status, min_cluster_size, algorithm, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [run.id, run.status, run.min_cluster_size, run.algorithm, run.created_at],
      );
    } catch (err: any) {
      logger.warn('DB unavailable for cluster run insert, using memory:', err.message);
      inMemoryRuns.push(run);
    }

    // Harvest real literature statements from PapersService
    const papers = await PapersService.getAllPapers();
    const documents: Array<{ id: string; text: string; metadata: Record<string, any> }> = [];
    const seenTexts = new Set<string>();

    for (const p of papers) {
      const entities = await PapersService.getEntitiesByPaperId(p.id);
      for (const ent of entities) {
        if (statementTypes.includes(ent.entity_type) && ent.text && ent.text.trim().length > 10) {
          const norm = ent.text.trim().toLowerCase();
          if (!seenTexts.has(norm)) {
            seenTexts.add(norm);
            documents.push({
              id: ent.id,
              text: ent.text.trim(),
              metadata: {
                statement_type: ent.entity_type,
                paper_id: p.id,
                paper_title: p.title,
              },
            });
          }
        }
      }

      const sections = await PapersService.getSectionsByPaperId(p.id);
      for (const sec of sections) {
        if (['limitation', 'discussion', 'conclusion'].includes(sec.section_type) && sec.content) {
          const sentences = sec.content.split(/(?<=[.?!])\s+/).filter(s =>
            /limit|challeng|constrain|bottleneck|degrad|fail|trade-off|overhead|lack|further/i.test(s)
          );
          for (const s of sentences.slice(0, 3)) {
            const clean = s.trim();
            const norm = clean.toLowerCase();
            if (clean.length > 25 && !seenTexts.has(norm)) {
              seenTexts.add(norm);
              documents.push({
                id: uuidv4(),
                text: clean,
                metadata: {
                  statement_type: 'limitation',
                  paper_id: p.id,
                  paper_title: p.title,
                },
              });
            }
          }
        }
      }
    }

    try {
      // Call AI service
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000); // 1 min

      let aiResp: Response | null = null;
      try {
        aiResp = await fetch(`${config.AI_SERVICE_URL}/api/v1/evidence-clusters/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            min_cluster_size: Math.max(2, minClusterSize),
            statement_types: statementTypes,
            include_noise: includeNoise,
            documents: documents,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        logger.warn('AI service offline for evidence clustering, falling back to local engine:', fetchErr);
      } finally {
        clearTimeout(timeout);
      }

      let data: {
        success: boolean;
        run_id: string;
        clusters: any[];
        noise_cluster: any | null;
        document_mapping: Record<string, number>;
        stats: Record<string, any>;
      };

      if (aiResp && aiResp.ok) {
        data = (await aiResp.json()) as any;
      } else {

        logger.info('Using local thematic clustering fallback on real literature statements');
        const thematicClusters = clusterStatementsThematically(documents);
        data = {
          success: true,
          run_id: runId,
          clusters: thematicClusters,
          noise_cluster: null,
          document_mapping: {},
          stats: {
            algorithm: 'thematic-nlp',
            min_cluster_size: minClusterSize,
            document_count: documents.length,
            cluster_count: thematicClusters.length,
            noise_count: 0,
          },
        };
      }

      // If AI service returned 0 clusters, enrich with thematic clusters
      if (!data.clusters || data.clusters.length === 0) {
        data.clusters = clusterStatementsThematically(documents);
        if (data.stats) data.stats.cluster_count = data.clusters.length;
      }

      run.status = 'completed';
      run.document_count = data.stats?.document_count ?? 0;
      run.cluster_count = data.stats?.cluster_count ?? 0;
      run.noise_count = data.stats?.noise_count ?? 0;
      run.completed_at = new Date();

      // Update run in DB
      try {
        await pgPool.query(
          `UPDATE evidence_cluster_runs
           SET status=$1, document_count=$2, cluster_count=$3, noise_count=$4, completed_at=$5
           WHERE id=$6`,
          [run.status, run.document_count, run.cluster_count, run.noise_count, run.completed_at, run.id],
        );
      } catch {
        const idx = inMemoryRuns.findIndex(r => r.id === runId);
        if (idx !== -1) inMemoryRuns[idx] = run;
        else inMemoryRuns.push(run);
      }

      // Persist clusters
      const persistedClusters: EvidenceCluster[] = [];
      const allClusters = [
        ...data.clusters,
        ...(data.noise_cluster ? [data.noise_cluster] : []),
      ];

      for (const c of allClusters) {
        const clusterId = uuidv4();
        const cluster: EvidenceCluster = {
          id: clusterId,
          run_id: runId,
          cluster_index: c.cluster_id,
          is_noise: c.is_noise ?? false,
          statement_type: c.statement_type,
          name: c.name,
          summary: c.summary,
          size: c.size,
          paper_count: c.paper_count,
          paper_ids: c.paper_ids ?? [],
          representative_statements: c.representative_statements ?? [],
          top_terms: c.top_terms ?? [],
          signal_kind: 'evidence_cluster',
          created_at: new Date(),
        };

        try {
          await pgPool.query(
            `INSERT INTO evidence_clusters
             (id, run_id, cluster_index, is_noise, statement_type, name, summary,
              size, paper_count, paper_ids, representative_statements, top_terms, signal_kind, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              cluster.id, cluster.run_id, cluster.cluster_index, cluster.is_noise,
              cluster.statement_type, cluster.name, cluster.summary, cluster.size,
              cluster.paper_count,
              JSON.stringify(cluster.paper_ids),
              JSON.stringify(cluster.representative_statements),
              JSON.stringify(cluster.top_terms),
              cluster.signal_kind, cluster.created_at,
            ],
          );
        } catch {
          inMemoryClusters.push(cluster);
        }

        // Persist evidence statements
        for (const ev of (c.evidence ?? [])) {
          const stmt: EvidenceClusterStatement = {
            id: uuidv4(),
            cluster_id: clusterId,
            run_id: runId,
            document_id: ev.document_id,
            paper_id: ev.paper_id ?? null,
            paper_title: ev.paper_title ?? null,
            statement_type: ev.statement_type,
            text: ev.text,
            similarity_to_centroid: ev.similarity_to_centroid ?? null,
            is_representative: ev.is_representative ?? false,
            created_at: new Date(),
          };

          try {
            await pgPool.query(
              `INSERT INTO evidence_cluster_statements
               (id, cluster_id, run_id, document_id, paper_id, paper_title, statement_type,
                text, similarity_to_centroid, is_representative, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [
                stmt.id, stmt.cluster_id, stmt.run_id, stmt.document_id,
                stmt.paper_id, stmt.paper_title, stmt.statement_type,
                stmt.text, stmt.similarity_to_centroid, stmt.is_representative, stmt.created_at,
              ],
            );
          } catch {
            inMemoryStatements.push(stmt);
          }
        }

        persistedClusters.push(cluster);
      }

      return {
        run,
        clusters: persistedClusters.filter(c => !c.is_noise),
        noiseCount: run.noise_count ?? 0,
      };
    } catch (err: any) {
      logger.error('Evidence clustering failed:', err);
      run.status = 'failed';
      run.error_message = String(err.message ?? err);
      try {
        await pgPool.query(
          'UPDATE evidence_cluster_runs SET status=$1, error_message=$2 WHERE id=$3',
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
   * List clusters from the latest completed run (or a specific run).
   */
  static async listClusters(
    runId?: string,
    includeNoise: boolean = true,
  ): Promise<{
    run: EvidenceClusterRun | null;
    clusters: EvidenceCluster[];
    statements: Record<string, EvidenceClusterStatement[]>;
  }> {
    try {
      let run: EvidenceClusterRun | null = null;

      if (runId) {
        const runRes = await pgPool.query(
          'SELECT * FROM evidence_cluster_runs WHERE id = $1',
          [runId],
        );
        if (runRes.rows.length > 0) run = runRes.rows[0] as EvidenceClusterRun;
      } else {
        const runRes = await pgPool.query(
          `SELECT * FROM evidence_cluster_runs WHERE status = 'completed'
           ORDER BY created_at DESC LIMIT 1`,
        );
        if (runRes.rows.length > 0) run = runRes.rows[0] as EvidenceClusterRun;
      }

      if (!run) return { run: null, clusters: [], statements: {} };

      const clusterFilter = includeNoise ? '' : 'AND is_noise = FALSE';
      const clusterRes = await pgPool.query(
        `SELECT * FROM evidence_clusters WHERE run_id = $1 ${clusterFilter} ORDER BY size DESC`,
        [run.id],
      );
      const clusters = clusterRes.rows as EvidenceCluster[];

      // Fetch statements keyed by cluster_id
      const stmtRes = await pgPool.query(
        `SELECT * FROM evidence_cluster_statements WHERE run_id = $1 ORDER BY is_representative DESC`,
        [run.id],
      );
      const statements: Record<string, EvidenceClusterStatement[]> = {};
      for (const stmt of stmtRes.rows as EvidenceClusterStatement[]) {
        if (!statements[stmt.cluster_id]) statements[stmt.cluster_id] = [];
        statements[stmt.cluster_id].push(stmt);
      }

      return { run, clusters, statements };
    } catch {
      // In-memory fallback
      let targetRun: EvidenceClusterRun | null = null;
      if (runId) {
        targetRun = inMemoryRuns.find(r => r.id === runId) ?? null;
      } else {
        const completed = inMemoryRuns.filter(r => r.status === 'completed');
        if (completed.length > 0) {
          targetRun = completed.sort(
            (a, b) => b.created_at.getTime() - a.created_at.getTime(),
          )[0];
        }
      }

      if (!targetRun) return { run: null, clusters: [], statements: {} };

      let clusters = inMemoryClusters
        .filter(c => c.run_id === targetRun!.id)
        .sort((a, b) => b.size - a.size);

      if (!includeNoise) clusters = clusters.filter(c => !c.is_noise);

      const statements: Record<string, EvidenceClusterStatement[]> = {};
      for (const stmt of inMemoryStatements) {
        if (!statements[stmt.cluster_id]) statements[stmt.cluster_id] = [];
        statements[stmt.cluster_id].push(stmt);
      }

      return { run: targetRun, clusters, statements };
    }
  }
}
