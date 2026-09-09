import { pgPool } from '../../db/postgres';
import { logger } from '../../utils/logger';
import type {
  ISearchProvider,
  SearchQueryParams,
  SearchResponse,
  SearchResultItem,
  SearchEntityType,
} from './types';

export class PostgresSearchProvider implements ISearchProvider {
  name = 'postgres_fulltext';

  async search(params: SearchQueryParams): Promise<SearchResponse> {
    const startTime = Date.now();
    const query = (params.query || '').trim();
    const targetType = params.entity_type || 'all';
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const sortBy = params.sort_by || 'relevance';

    const results: SearchResultItem[] = [];
    const counts: Record<SearchEntityType, number> = {
      all: 0,
      papers: 0,
      methods: 0,
      datasets: 0,
      metrics: 0,
      concepts: 0,
      topics: 0,
      limitations: 0,
      research_gaps: 0,
      hypotheses: 0,
    };

    try {
      // 1. Papers
      if (targetType === 'all' || targetType === 'papers') {
        const paperItems = await this._searchPapers(query);
        counts.papers = paperItems.length;
        results.push(...paperItems);
      }

      // 2. Extracted Entities (methods, datasets, metrics, concepts, limitations)
      const entityTypesToFetch: Array<{ etype: string; searchType: SearchEntityType }> = [];
      if (targetType === 'all' || targetType === 'methods') entityTypesToFetch.push({ etype: 'method', searchType: 'methods' });
      if (targetType === 'all' || targetType === 'datasets') entityTypesToFetch.push({ etype: 'dataset', searchType: 'datasets' });
      if (targetType === 'all' || targetType === 'metrics') entityTypesToFetch.push({ etype: 'metric', searchType: 'metrics' });
      if (targetType === 'all' || targetType === 'concepts') entityTypesToFetch.push({ etype: 'concept', searchType: 'concepts' });
      if (targetType === 'all' || targetType === 'limitations') entityTypesToFetch.push({ etype: 'limitation', searchType: 'limitations' });

      for (const { etype, searchType } of entityTypesToFetch) {
        const items = await this._searchExtractedEntities(query, etype, searchType);
        counts[searchType] = items.length;
        results.push(...items);
      }

      // 3. Topics
      if (targetType === 'all' || targetType === 'topics') {
        const topicItems = await this._searchTopics(query);
        counts.topics = topicItems.length;
        results.push(...topicItems);
      }

      // 4. Research Gaps
      if (targetType === 'all' || targetType === 'research_gaps') {
        const gapItems = await this._searchResearchGaps(query);
        counts.research_gaps = gapItems.length;
        results.push(...gapItems);
      }

      // 5. Hypotheses
      if (targetType === 'all' || targetType === 'hypotheses') {
        const hypItems = await this._searchHypotheses(query);
        counts.hypotheses = hypItems.length;
        results.push(...hypItems);
      }

      // Calculate total count across queried types
      counts.all = results.length;

      // Sort results
      this._sortResults(results, sortBy);

      // Paginate
      const total = results.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginatedResults = results.slice(startIndex, startIndex + limit);

      const executionTime = Date.now() - startTime;

      return {
        query,
        total,
        page,
        limit,
        total_pages: totalPages,
        counts_by_type: counts,
        results: paginatedResults,
        execution_time_ms: executionTime,
        provider: this.name,
      };
    } catch (err: any) {
      logger.error('Postgres search failed:', err);
      // Return safe empty response
      return {
        query,
        total: 0,
        page,
        limit,
        total_pages: 1,
        counts_by_type: counts,
        results: [],
        execution_time_ms: Date.now() - startTime,
        provider: this.name,
      };
    }
  }

  private _sortResults(results: SearchResultItem[], sortBy: string): void {
    if (sortBy === 'date_desc') {
      results.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'date_asc') {
      results.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return da - db;
      });
    } else if (sortBy === 'title_asc') {
      results.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // 'relevance' (default)
      results.sort((a, b) => b.relevance_score - a.relevance_score);
    }
  }

  private _computeRelevance(title: string, snippet: string, query: string, baseScore = 0.5): number {
    if (!query) return baseScore;
    const qLower = query.toLowerCase();
    const tLower = title.toLowerCase();
    const sLower = snippet.toLowerCase();

    if (tLower === qLower) return 1.0;
    if (tLower.startsWith(qLower)) return 0.92;
    if (tLower.includes(qLower)) return 0.85;
    if (sLower.includes(qLower)) return 0.65;

    // Word token overlap
    const qWords = qLower.split(/\s+/).filter(w => w.length > 2);
    let matchedWords = 0;
    for (const w of qWords) {
      if (tLower.includes(w) || sLower.includes(w)) matchedWords++;
    }
    if (qWords.length > 0) {
      return Math.min(1.0, 0.4 + (matchedWords / qWords.length) * 0.45);
    }
    return baseScore;
  }

  private async _searchPapers(query: string): Promise<SearchResultItem[]> {
    try {
      let sql = `
        SELECT id, title, abstract, venue, doi, authors, publication_year, created_at
        FROM papers
      `;
      const values: any[] = [];
      if (query) {
        sql += ` WHERE title ILIKE $1 OR abstract ILIKE $1 OR venue ILIKE $1`;
        values.push(`%${query}%`);
      }
      sql += ` ORDER BY created_at DESC LIMIT 100`;

      const res = await pgPool.query(sql, values);
      return res.rows.map((row: any) => {
        const snippet = row.abstract
          ? (row.abstract.length > 220 ? row.abstract.slice(0, 220) + '…' : row.abstract)
          : `Paper published in ${row.venue || 'scientific literature'}.`;

        return {
          id: row.id,
          entity_type: 'papers',
          title: row.title || 'Untitled Research Paper',
          snippet,
          relevance_score: this._computeRelevance(row.title, snippet, query, 0.75),
          source_paper_id: row.id,
          source_paper_title: row.title,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          url: `/papers/${row.id}`,
          metadata: {
            venue: row.venue,
            doi: row.doi,
            publication_year: row.publication_year,
            author_count: Array.isArray(row.authors) ? row.authors.length : 0,
          },
        };
      });
    } catch {
      return [];
    }
  }

  private async _searchExtractedEntities(
    query: string,
    entityType: string,
    targetSearchType: SearchEntityType
  ): Promise<SearchResultItem[]> {
    try {
      let sql = `
        SELECT e.id, e.paper_id, e.text, e.normalized_name, e.confidence, e.created_at, p.title as paper_title
        FROM extracted_entities e
        LEFT JOIN papers p ON p.id = e.paper_id
        WHERE e.entity_type = $1
      `;
      const values: any[] = [entityType];
      if (query) {
        sql += ` AND (e.normalized_name ILIKE $2 OR e.text ILIKE $2)`;
        values.push(`%${query}%`);
      }
      sql += ` ORDER BY e.confidence DESC LIMIT 80`;

      const res = await pgPool.query(sql, values);
      return res.rows.map((row: any) => {
        const displayTitle = row.normalized_name || row.text.slice(0, 60);
        const snippet = row.text || `Extracted ${entityType} entity from corpus.`;
        const url = targetSearchType === 'limitations'
          ? '/evidence-clusters'
          : targetSearchType === 'datasets'
          ? '/patterns'
          : row.paper_id ? `/papers/${row.paper_id}` : '/papers';

        return {
          id: row.id,
          entity_type: targetSearchType,
          title: displayTitle,
          snippet: snippet.length > 200 ? snippet.slice(0, 200) + '…' : snippet,
          relevance_score: this._computeRelevance(displayTitle, snippet, query, parseFloat(row.confidence || '0.7')),
          source_paper_id: row.paper_id,
          source_paper_title: row.paper_title,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          url,
          metadata: {
            confidence: row.confidence,
            entity_type: entityType,
          },
        };
      });
    } catch {
      return [];
    }
  }

  private async _searchTopics(query: string): Promise<SearchResultItem[]> {
    try {
      let sql = `
        SELECT id, topic_index, name, representation, frequency, representative_docs, created_at
        FROM topics
      `;
      const values: any[] = [];
      if (query) {
        sql += ` WHERE name ILIKE $1 OR representation::text ILIKE $1`;
        values.push(`%${query}%`);
      }
      sql += ` ORDER BY frequency DESC LIMIT 50`;

      const res = await pgPool.query(sql, values);
      return res.rows.map((row: any) => {
        const snippet = Array.isArray(row.representative_docs) && row.representative_docs[0]
          ? String(row.representative_docs[0]).slice(0, 200) + '…'
          : `Topic cluster containing ${row.frequency || 0} associated documents.`;

        return {
          id: row.id,
          entity_type: 'topics',
          title: `Topic #${row.topic_index}: ${row.name}`,
          snippet,
          relevance_score: this._computeRelevance(row.name, snippet, query, 0.65),
          source_paper_id: null,
          source_paper_title: null,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          url: '/topics',
          metadata: {
            topic_index: row.topic_index,
            frequency: row.frequency,
          },
        };
      });
    } catch {
      return [];
    }
  }

  private async _searchResearchGaps(query: string): Promise<SearchResultItem[]> {
    try {
      let sql = `
        SELECT gap_id, title, description, why_identified, composite_score, confidence, rank, evidence_type, created_at
        FROM ranked_research_gaps
      `;
      const values: any[] = [];
      if (query) {
        sql += ` WHERE title ILIKE $1 OR description ILIKE $1 OR why_identified ILIKE $1`;
        values.push(`%${query}%`);
      }
      sql += ` ORDER BY composite_score DESC LIMIT 60`;

      const res = await pgPool.query(sql, values);
      return res.rows.map((row: any) => {
        const snippet = row.why_identified
          ? (row.why_identified.length > 200 ? row.why_identified.slice(0, 200) + '…' : row.why_identified)
          : row.description;

        return {
          id: row.gap_id,
          entity_type: 'research_gaps',
          title: `#${row.rank} ${row.title}`,
          snippet,
          relevance_score: this._computeRelevance(row.title, snippet, query, parseFloat(row.composite_score || '0.7')),
          source_paper_id: null,
          source_paper_title: null,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          url: `/research-gaps/${row.gap_id}`,
          metadata: {
            rank: row.rank,
            composite_score: row.composite_score,
            confidence: row.confidence,
            evidence_type: row.evidence_type,
          },
        };
      });
    } catch {
      return [];
    }
  }

  private async _searchHypotheses(query: string): Promise<SearchResultItem[]> {
    try {
      let sql = `
        SELECT hypothesis_id, gap_id, title, hypothesis, research_question, rationale, possible_methodology, confidence_score, created_at
        FROM grounded_hypotheses
      `;
      const values: any[] = [];
      if (query) {
        sql += ` WHERE title ILIKE $1 OR hypothesis ILIKE $1 OR research_question ILIKE $1 OR rationale ILIKE $1`;
        values.push(`%${query}%`);
      }
      sql += ` ORDER BY created_at DESC LIMIT 50`;

      const res = await pgPool.query(sql, values);
      return res.rows.map((row: any) => {
        const snippet = `Hypothesis: "${row.hypothesis.slice(0, 180)}…"`;

        return {
          id: row.hypothesis_id,
          entity_type: 'hypotheses',
          title: row.title,
          snippet,
          relevance_score: this._computeRelevance(row.title, row.hypothesis, query, parseFloat(row.confidence_score || '0.8')),
          source_paper_id: null,
          source_paper_title: null,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          url: `/hypotheses?gap_id=${row.gap_id}`,
          metadata: {
            gap_id: row.gap_id,
            confidence: row.confidence_score,
          },
        };
      });
    } catch {
      return [];
    }
  }
}
