import { runCypher, isNeo4jConnected } from '../db/neo4j';
import { PapersService } from './papers.service';
import { logger } from '../utils/logger';
import type { ExtractedEntityRecord, PaperRecord } from './papers.service';

export interface GraphNode {
  id: string;
  label: string;
  title: string;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

// In-memory fallback if Neo4j is offline
const inMemoryNodes: Map<string, GraphNode> = new Map();
const inMemoryEdges: GraphEdge[] = [];

/**
 * Maps NLP entity_type to Neo4j Node Label.
 */
function getGraphLabelForEntity(entityType: string): string {
  const map: Record<string, string> = {
    method: 'Method',
    dataset: 'Dataset',
    metric: 'Metric',
    limitation: 'Limitation',
    future_work: 'Concept',
    finding: 'Finding',
    objective: 'Topic',
    concept: 'Concept',
    tool: 'Tool',
    topic: 'Topic',
  };
  return map[entityType] || 'Concept';
}

/**
 * Maps Neo4j Node Label to Edge Label (Relationship) from a Paper.
 */
function getEdgeLabelForTarget(targetLabel: string): string {
  const map: Record<string, string> = {
    Method: 'USES',
    Dataset: 'EVALUATES_ON',
    Metric: 'MEASURED_BY',
    Limitation: 'HAS_LIMITATION',
    Concept: 'SUGGESTS_FUTURE_WORK',
    Finding: 'REPORTS',
    Tool: 'USES',
    Topic: 'ADDRESSES',
  };
  return map[targetLabel] || 'REFERENCES';
}

export class GraphService {
  /**
   * Sync a paper and its entities to the Neo4j graph.
   */
  static async syncPaperToGraph(paperId: string): Promise<void> {
    const paper = await PapersService.getPaperById(paperId);
    if (!paper) throw new Error(`Paper ${paperId} not found`);

    const entities = await PapersService.getEntitiesByPaperId(paperId);
    
    if (isNeo4jConnected()) {
      await this.syncToNeo4j(paper, entities);
    } else {
      this.syncToMemory(paper, entities);
      logger.warn('Neo4j disconnected. Graph synced to in-memory store.');
    }
  }

  private static async syncToNeo4j(paper: PaperRecord, entities: ExtractedEntityRecord[]): Promise<void> {
    // 1. Merge Paper Node
    await runCypher(
      `MERGE (p:Paper { id: $id })
       SET p.title = $title, p.status = $status, p.created_at = $created_at`,
      {
        id: paper.id,
        title: paper.title,
        status: paper.status,
        created_at: paper.created_at.toISOString(),
      }
    );

    // 2. Merge Entity Nodes & Relationships
    for (const entity of entities) {
      const canonicalName = entity.normalized_name || entity.text.toLowerCase();
      // Generate a deterministic ID based on label and canonical name
      const nodeLabel = getGraphLabelForEntity(entity.entity_type);
      const nodeId = `${nodeLabel}_${canonicalName.replace(/\s+/g, '_')}`;
      const edgeLabel = getEdgeLabelForTarget(nodeLabel);

      const query = `
        MATCH (p:Paper { id: $paperId })
        MERGE (e:${nodeLabel} { id: $entityId })
        ON CREATE SET e.name = $canonicalName, e.type = $entityType
        MERGE (p)-[r:${edgeLabel}]->(e)
        SET r.source_paper = $paperId, r.confidence = $confidence, r.original_text = $originalText
      `;
      
      await runCypher(query, {
        paperId: paper.id,
        entityId: nodeId,
        canonicalName,
        entityType: entity.entity_type,
        confidence: entity.confidence,
        originalText: entity.text,
      });
    }
    
    logger.info(`Synced paper ${paper.id} with ${entities.length} entities to Neo4j.`);
  }

  private static syncToMemory(paper: PaperRecord, entities: ExtractedEntityRecord[]): void {
    inMemoryNodes.set(paper.id, {
      id: paper.id,
      label: 'Paper',
      title: paper.title,
    });

    for (const entity of entities) {
      const canonicalName = entity.normalized_name || entity.text.toLowerCase();
      const nodeLabel = getGraphLabelForEntity(entity.entity_type);
      const nodeId = `${nodeLabel}_${canonicalName.replace(/\s+/g, '_')}`;
      const edgeLabel = getEdgeLabelForTarget(nodeLabel);

      if (!inMemoryNodes.has(nodeId)) {
        inMemoryNodes.set(nodeId, {
          id: nodeId,
          label: nodeLabel,
          title: canonicalName,
        });
      }

      const edgeExists = inMemoryEdges.find(e => e.source === paper.id && e.target === nodeId);
      if (!edgeExists) {
        inMemoryEdges.push({
          source: paper.id,
          target: nodeId,
          label: edgeLabel,
        });
      }
    }
  }

  /**
   * Retrieve graph data for visualization (e.g. D3, Vis.js).
   */
  static async getGraphVisualization(limit = 200): Promise<GraphData> {
    if (isNeo4jConnected()) {
      const query = `
        MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT toInteger($limit)
      `;
      const records = await runCypher(query, { limit });

      const nodesMap = new Map<string, GraphNode>();
      const links: GraphEdge[] = [];

      for (const record of records) {
        const n = record.get('n');
        const m = record.get('m');
        const r = record.get('r');

        const nId = n.properties.id;
        if (!nodesMap.has(nId)) {
          nodesMap.set(nId, {
            id: nId,
            label: n.labels[0],
            title: n.properties.title || n.properties.name,
          });
        }

        const mId = m.properties.id;
        if (!nodesMap.has(mId)) {
          nodesMap.set(mId, {
            id: mId,
            label: m.labels[0],
            title: m.properties.title || m.properties.name,
          });
        }

        links.push({
          source: nId,
          target: mId,
          label: r.type,
        });
      }

      return {
        nodes: Array.from(nodesMap.values()),
        links,
      };
    } else {
      // In-memory fallback
      return {
        nodes: Array.from(inMemoryNodes.values()).slice(0, limit),
        links: inMemoryEdges.slice(0, limit),
      };
    }
  }

  /**
   * Retrieve basic graph statistics.
   */
  static async getGraphStats(): Promise<{ nodes: number; relationships: number }> {
    if (isNeo4jConnected()) {
      const nodeRes = await runCypher('MATCH (n) RETURN count(n) as c');
      const relRes = await runCypher('MATCH ()-[r]->() RETURN count(r) as c');
      return {
        nodes: nodeRes[0].get('c').toNumber(),
        relationships: relRes[0].get('c').toNumber(),
      };
    } else {
      return {
        nodes: inMemoryNodes.size,
        relationships: inMemoryEdges.length,
      };
    }
  }
}
