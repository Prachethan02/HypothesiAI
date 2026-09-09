/**
 * arXiv Academic Search Provider — Priority 2
 * ============================================
 * Implements ISearchProvider using the official arXiv API (Atom/XML feed).
 * Endpoint: https://export.arxiv.org/api/query
 *
 * arXiv API is free and does not require an API key. Per arXiv ToS, results
 * must not be scraped — this uses the official export API.
 *
 * Reference: https://arxiv.org/help/api/user-manual
 */

import type { ISearchProvider, SearchQueryParams, SearchResponse, SearchResultItem } from './types';

const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';

// Polyfill: Node 18+ has DOMParser-free XML parsing via regex (sufficient for arXiv Atom)
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/<[^>]+>/g, '').trim());
  }
  return results;
}

function extractEntries(feed: string): string[] {
  const regex = /<entry>([\s\S]*?)<\/entry>/gi;
  const entries: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(feed)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function extractArxivId(entry: string): string {
  const idUrl = extractTag(entry, 'id');
  // e.g., http://arxiv.org/abs/2301.12345v1 -> 2301.12345
  const m = idUrl.match(/arxiv\.org\/abs\/([\w.]+)/i);
  return m ? m[1].replace(/v\d+$/, '') : idUrl;
}

function extractAuthors(entry: string): string {
  const names = extractAllTags(entry, 'name');
  if (names.length === 0) return 'Unknown Authors';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} et al.`;
}

export class ArxivSearchProvider implements ISearchProvider {
  readonly name = 'arxiv';

  async search(params: SearchQueryParams): Promise<SearchResponse> {
    const startTime = Date.now();
    const query = params.query.trim();
    const maxResults = Math.min(params.limit ?? 10, 25); // arXiv max is 2000 but we cap at 25 per page
    const start = ((params.page ?? 1) - 1) * maxResults;

    // Build arXiv search query: ti: for title, abs: for abstract, all: for full-text
    // Default to all: which searches title+abstract+authors
    const searchQuery = encodeURIComponent(`all:${query}`);
    const url = `${ARXIV_API_BASE}?search_query=${searchQuery}&start=${start}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

    let feedXml: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);

      const resp = await fetch(url, {
        headers: { 'User-Agent': 'HypothesiAI/1.0 (research-gap-discovery; contact@hypothesiai.app)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`arXiv API returned HTTP ${resp.status}`);
      }
      feedXml = await resp.text();
    } catch (err: any) {
      throw new Error(`arXiv API request failed: ${err.message}`);
    }

    // Parse total results count
    const totalResultsStr = extractTag(feedXml, 'opensearch:totalResults');
    const total = parseInt(totalResultsStr, 10) || 0;

    // Parse individual entries
    const entries = extractEntries(feedXml);
    const results: SearchResultItem[] = entries.map((entry, idx): SearchResultItem => {
      const arxivId = extractArxivId(entry);
      const title = extractTag(entry, 'title').replace(/\s+/g, ' ');
      const summary = extractTag(entry, 'summary').replace(/\s+/g, ' ');
      const authors = extractAuthors(entry);
      const published = extractTag(entry, 'published');
      const year = published ? new Date(published).getFullYear() : null;

      // Snippet: first 300 chars of abstract
      const snippet = summary.length > 300 ? `${summary.substring(0, 297)}...` : summary;

      return {
        id: `arxiv:${arxivId}`,
        entity_type: 'papers',
        title: title || `arXiv:${arxivId}`,
        snippet: snippet || 'No abstract available.',
        relevance_score: Math.max(0, 1 - (start + idx) * 0.02), // Approximated decay
        url: `https://arxiv.org/abs/${arxivId}`,
        metadata: {
          arxiv_id: arxivId,
          authors,
          publication_year: year,
          pdf_url: `https://arxiv.org/pdf/${arxivId}.pdf`,
          source: 'arxiv',
        },
      };
    });

    const executionTime = Date.now() - startTime;
    const totalPages = maxResults > 0 ? Math.ceil(total / maxResults) : 0;

    return {
      query,
      total,
      page: params.page ?? 1,
      limit: maxResults,
      total_pages: totalPages,
      counts_by_type: { papers: results.length },
      results,
      execution_time_ms: executionTime,
      provider: this.name,
    };
  }

  async suggest(query: string): Promise<string[]> {
    // arXiv does not provide a native suggestion API — return empty
    return [];
  }
}
