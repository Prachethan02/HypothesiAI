/**
 * Corpus Analysis Orchestrator — Priority 3: End-to-End Automatic Analysis
 * =========================================================================
 * Runs the full AI analytical pipeline for a research corpus in sequence:
 *   1. Topic Modeling (BERTopic)
 *   2. Evidence Clustering (HDBSCAN)
 *   3. Pattern Mining (FP-Growth / Apriori)
 *   4. Contradiction Detection (NLI / DeBERTa)
 *   5. Evidence Aggregation
 *   6. Gap Ranking (composite multi-dimensional scoring)
 *
 * Each step is executed with its existing service and wrapped with:
 *   - Progress tracking (0–100%)
 *   - Error resilience (one step failing does not halt the run)
 *   - Corpus status updates persisted to PostgreSQL
 *
 * The controller calls `CorpusAnalysisOrchestrator.run(corpusId)` without
 * awaiting it (fire-and-forget), then the frontend polls /analysis-status.
 */

import { CorpusService } from './corpus.service';
import { TopicsService } from './topics.service';
import { EvidenceClustersService } from './evidenceClusters.service';
import { PatternMiningService } from './patternMining.service';
import { ContradictionsService } from './contradictions.service';
import { EvidenceService } from './evidence.service';
import { GapRankingService } from './gapRanking.service';
import { HypothesesService } from './hypotheses.service';
import { GraphService } from './graph.service';
import { logger } from '../utils/logger';


export interface AnalysisStepState {
  current_step: string | null;
  steps_completed: string[];
  error: string | null;
}

// In-memory step state per corpus (cleared when analysis completes)
const stepStateMap = new Map<string, AnalysisStepState>();

// Pipeline step definitions — order matters; each step feeds the next
const PIPELINE_STEPS = [
  { key: 'topic_modeling',        label: 'Topic Modeling (BERTopic)',          weight: 15 },
  { key: 'evidence_clustering',   label: 'Evidence Clustering (HDBSCAN)',      weight: 15 },
  { key: 'pattern_mining',        label: 'Pattern Mining (FP-Growth)',         weight: 15 },
  { key: 'contradiction_detect',  label: 'Contradiction Detection (NLI)',      weight: 15 },
  { key: 'evidence_aggregation',  label: 'Evidence Aggregation',               weight: 20 },
  { key: 'gap_ranking',           label: 'Gap Ranking (Composite Scoring)',    weight: 20 },
] as const;

type StepKey = typeof PIPELINE_STEPS[number]['key'];

export class CorpusAnalysisOrchestrator {
  /**
   * Get current step info for a running or completed analysis.
   * Returns null if no run has been started for this corpus.
   */
  static getStepInfo(corpusId: string): AnalysisStepState | null {
    return stepStateMap.get(corpusId) ?? null;
  }

  /**
   * Run the full analysis pipeline for the given corpus.
   * Must be called without await (fire-and-forget) from the controller.
   */
  static async run(corpusId: string): Promise<void> {
    // Initialise state
    const state: AnalysisStepState = {
      current_step: null,
      steps_completed: [],
      error: null,
    };
    stepStateMap.set(corpusId, state);

    logger.info(`[CorpusOrchestrator] Starting analysis for corpus ${corpusId}`);

    try {
      // Mark corpus as analyzing with 0% progress
      await CorpusService.updateCorpusStatus(corpusId, 'analyzing', 0);

      let cumulativeWeight = 0;

      for (const step of PIPELINE_STEPS) {
        state.current_step = step.label;

        logger.info(`[CorpusOrchestrator][${corpusId}] -> ${step.label}`);

        try {
          await CorpusAnalysisOrchestrator._runStep(step.key, corpusId);
          state.steps_completed.push(step.key);
        } catch (stepErr: any) {
          // Log the failure but continue the pipeline — partial results are better than none
          logger.warn(
            `[CorpusOrchestrator][${corpusId}] Step "${step.label}" failed (continuing): ${stepErr.message}`
          );
          state.steps_completed.push(`${step.key}:failed`);
        }

        cumulativeWeight += step.weight;
        const progress = Math.min(Math.round(cumulativeWeight), 99);
        await CorpusService.updateCorpusStatus(corpusId, 'analyzing', progress).catch(() => {});
      }

      // Sync corpus papers to domain knowledge graph
      try {
        const corpusPapers = await CorpusService.getCorpusPapers(corpusId);
        for (const p of corpusPapers) {
          await GraphService.syncPaperToGraph(p.id);
        }
        logger.info(`[CorpusOrchestrator][${corpusId}] Synced ${corpusPapers.length} paper(s) to knowledge graph`);
      } catch (kgErr: any) {
        logger.warn(`[CorpusOrchestrator][${corpusId}] Knowledge graph sync note: ${kgErr.message}`);
      }

      // Pre-generate initial grounded hypothesis for top-ranked gap so it is immediately available
      try {
        const topGaps = await GapRankingService.listGaps({ top_k: 1 });
        if (topGaps.length > 0) {
          await HypothesesService.generateHypothesis({ gap_id: topGaps[0].gap_id });
          logger.info(`[CorpusOrchestrator][${corpusId}] Pre-generated grounded hypothesis for top gap: ${topGaps[0].gap_id}`);
        }
      } catch (hypErr: any) {
        logger.warn(`[CorpusOrchestrator][${corpusId}] Initial hypothesis pre-generation note: ${hypErr.message}`);
      }


      // All steps attempted — mark complete
      state.current_step = null;
      await CorpusService.updateCorpusStatus(corpusId, 'analyzed', 100);

      logger.info(`[CorpusOrchestrator][${corpusId}] Analysis complete`);
    } catch (fatalErr: any) {
      logger.error(`[CorpusOrchestrator][${corpusId}] Fatal orchestration error:`, fatalErr);
      state.current_step = null;
      state.error = String(fatalErr.message ?? fatalErr);
      await CorpusService.updateCorpusStatus(corpusId, 'failed', undefined).catch(() => {});
    }
  }

  /**
   * Dispatch a single pipeline step by key.
   */
  private static async _runStep(key: StepKey, corpusId?: string): Promise<void> {
    switch (key) {
      case 'topic_modeling':
        await TopicsService.generateTopics();
        break;

      case 'evidence_clustering':
        // runClustering(minClusterSize, statementTypes, includeNoise) — all optional
        await EvidenceClustersService.runClustering();
        break;

      case 'pattern_mining':
        await PatternMiningService.runMining({});
        break;

      case 'contradiction_detect':
        await ContradictionsService.runAnalysis({ semantic_threshold: 0.65 });
        break;

      case 'evidence_aggregation':
        await EvidenceService.runAggregation({});
        break;

      case 'gap_ranking':
        await GapRankingService.rankGaps({ corpusId });
        break;

      default:
        throw new Error(`Unknown pipeline step key: ${key}`);
    }
  }
}
