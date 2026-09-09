import type {
  ISearchProvider,
  SearchQueryParams,
  SearchResponse,
  SearchEntityType,
} from './types';
import { PostgresSearchProvider } from './postgresSearchProvider';
import { logger } from '../../utils/logger';

export class SearchService {
  private static provider: ISearchProvider = new PostgresSearchProvider();

  /**
   * Pluggable provider setter — allows injecting Elasticsearch / OpenSearch provider
   * without modifying frontend or controller layers.
   */
  static setProvider(newProvider: ISearchProvider): void {
    logger.info(`Switching search provider to: ${newProvider.name}`);
    this.provider = newProvider;
  }

  static getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Execute global search across all 9 research entity types.
   */
  static async search(params: SearchQueryParams): Promise<SearchResponse> {
    return this.provider.search(params);
  }

  /**
   * Fast counts breakdown for a query across all 9 entity types.
   */
  static async getCounts(query: string): Promise<Record<SearchEntityType, number>> {
    const res = await this.provider.search({
      query,
      entity_type: 'all',
      page: 1,
      limit: 1,
    });
    return res.counts_by_type as Record<SearchEntityType, number>;
  }
}
