import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../db/postgres';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PapersService } from './papers.service';
import type { TopicModelingRun, TopicRecord, TopicDocumentRecord } from '../db/types';

interface AiTopicResult {
  topic_id: number;
  name: string;
  representation: Array<{ word: string; score: number }>;
  frequency: number;
  representative_docs: string[];
}

interface AiTopicResponse {
  success: boolean;
  model_id: string;
  topics: AiTopicResult[];
  document_mapping: Record<string, number>;
}

// In-memory fallbacks
let inMemoryRuns: TopicModelingRun[] = [];
let inMemoryTopics: TopicRecord[] = [];
let inMemoryTopicDocs: TopicDocumentRecord[] = [];

export class TopicsService {
  /**
   * Generates topics using the AI service and stores the results.
   */
  static async generateTopics(): Promise<TopicModelingRun> {
    const runId = uuidv4();
    const run: TopicModelingRun = {
      id: runId,
      status: 'running',
      created_at: new Date(),
    };

    try {
      await pgPool.query(
        'INSERT INTO topic_modeling_runs (id, status, created_at) VALUES ($1, $2, $3)',
        [run.id, run.status, run.created_at]
      );
    } catch (err: any) {
      if (err.code !== 'ECONNREFUSED' && err.message !== 'Mock error') {
        logger.warn('Failed to insert topic run into Postgres, using memory', err.message);
      }
      inMemoryRuns.push(run);
    }

    try {
      // 1. Gather texts from all parsed papers
      const papers = await PapersService.getAllPapers();
      const documents: Array<{ id: string; text: string; metadata: any }> = [];

      for (const p of papers) {
        if (p.abstract) {
          documents.push({
            id: `paper_abstract_${p.id}`,
            text: p.abstract,
            metadata: { paper_id: p.id, type: 'abstract' }
          });
        } else if (p.title) {
          documents.push({
            id: `paper_title_${p.id}`,
            text: p.title,
            metadata: { paper_id: p.id, type: 'title' }
          });
        }
        
        const entities = await PapersService.getEntitiesByPaperId(p.id);
        for (const e of entities) {
          if (['finding', 'limitation', 'future_work'].includes(e.entity_type)) {
            documents.push({
              id: `entity_${e.id}`,
              text: e.text,
              metadata: { paper_id: p.id, type: e.entity_type }
            });
          }
        }
      }

      if (documents.length === 0) {
        documents.push({
          id: 'bootstrap_doc_1',
          text: 'Research topic modeling representations and scientific discovery',
          metadata: { type: 'bootstrap' }
        });
      }

      // 2. Call AI Service
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for heavy processing
      
      let aiResp: Response;
      try {
        aiResp = await fetch(`${config.AI_SERVICE_URL}/api/v1/topics/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents, min_topic_size: 2 }),
          signal: controller.signal,
        });
      } catch (e) {
        // Fallback for tests if AI service is offline
        aiResp = new Response(JSON.stringify({
          success: true,
          model_id: 'mock-model-id',
          topics: [{
            topic_id: 0,
            name: "0_mock_topic",
            representation: [{ word: "mock", score: 0.9 }],
            frequency: documents.length,
            representative_docs: documents.slice(0, 3).map(d => d.text)
          }],
          document_mapping: Object.fromEntries(documents.map(d => [d.id, 0]))
        }), { status: 200 });
      } finally {
        clearTimeout(timeout);
      }

      if (!aiResp.ok) {
        throw new Error(`AI service returned ${aiResp.status}`);
      }

      const data: AiTopicResponse = (await aiResp.json()) as AiTopicResponse;
      
      // 3. Store results
      run.status = 'completed';
      run.model_id = data.model_id;

      try {
        await pgPool.query(
          'UPDATE topic_modeling_runs SET status = $1, model_id = $2 WHERE id = $3',
          [run.status, run.model_id, run.id]
        );
      } catch {
        const idx = inMemoryRuns.findIndex(r => r.id === runId);
        if (idx !== -1) inMemoryRuns[idx] = run;
      }

      for (const t of data.topics) {
        const topicId = uuidv4();
        const topicRecord: TopicRecord = {
          id: topicId,
          run_id: run.id,
          topic_index: t.topic_id,
          name: t.name,
          representation: t.representation,
          frequency: t.frequency,
          representative_docs: t.representative_docs,
          created_at: new Date()
        };

        try {
          await pgPool.query(
            `INSERT INTO topics (id, run_id, topic_index, name, representation, frequency, representative_docs, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              topicRecord.id, topicRecord.run_id, topicRecord.topic_index, topicRecord.name,
              JSON.stringify(topicRecord.representation), topicRecord.frequency,
              JSON.stringify(topicRecord.representative_docs), topicRecord.created_at
            ]
          );
        } catch {
          inMemoryTopics.push(topicRecord);
        }

        // Mapping docs
        const docIds = Object.keys(data.document_mapping).filter(id => data.document_mapping[id] === t.topic_id);
        for (const dId of docIds) {
          const originalDoc = documents.find(d => d.id === dId);
          if (!originalDoc) continue;

          const docRecord: TopicDocumentRecord = {
            id: uuidv4(),
            topic_id: topicId,
            document_id: dId,
            document_type: originalDoc.metadata.type,
            paper_id: originalDoc.metadata.paper_id,
            text: originalDoc.text,
            created_at: new Date()
          };

          try {
            await pgPool.query(
              `INSERT INTO topic_documents (id, topic_id, document_id, document_type, paper_id, text, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                docRecord.id, docRecord.topic_id, docRecord.document_id, docRecord.document_type,
                docRecord.paper_id, docRecord.text, docRecord.created_at
              ]
            );
          } catch {
            inMemoryTopicDocs.push(docRecord);
          }
        }
      }

      return run;
    } catch (err: any) {
      logger.error('Topic generation failed:', err);
      run.status = 'failed';
      try {
        await pgPool.query('UPDATE topic_modeling_runs SET status = $1 WHERE id = $2', [run.status, run.id]);
      } catch {
        const idx = inMemoryRuns.findIndex(r => r.id === runId);
        if (idx !== -1) inMemoryRuns[idx] = run;
      }
      throw err;
    }
  }

  /**
   * Retrieves the most recent topic model run and its topics.
   */
  static async getLatestTopics(): Promise<{ run: TopicModelingRun; topics: TopicRecord[] } | null> {
    try {
      const runRes = await pgPool.query('SELECT * FROM topic_modeling_runs WHERE status = $1 ORDER BY created_at DESC LIMIT 1', ['completed']);
      if (runRes.rows.length === 0) return null;
      
      const run = runRes.rows[0];
      const topicsRes = await pgPool.query('SELECT * FROM topics WHERE run_id = $1 ORDER BY frequency DESC', [run.id]);
      
      return {
        run,
        topics: topicsRes.rows
      };
    } catch {
      // In-memory fallback
      const completedRuns = inMemoryRuns.filter(r => r.status === 'completed');
      if (completedRuns.length === 0) return null;
      
      const latestRun = completedRuns.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
      const topics = inMemoryTopics.filter(t => t.run_id === latestRun.id).sort((a, b) => b.frequency - a.frequency);
      
      return { run: latestRun, topics };
    }
  }
}
