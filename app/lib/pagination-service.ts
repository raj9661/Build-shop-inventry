import { prisma } from '@/lib/prisma';
import redisService from './redis-service';
import { PaginationInput } from './validation-schemas';


interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage: number | null;
    prevPage: number | null;
  };
  performance: {
    cacheHit: boolean;
    queryTime: number;
    cacheTime: number;
  };
}

interface PaginationOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  includeCount?: boolean;
  optimizeQueries?: boolean;
}

class PaginationService {
  private defaultOptions: PaginationOptions = {
    enableCache: true,
    cacheTTL: 300, // 5 minutes
    includeCount: true,
    optimizeQueries: true,
  };

  /**
   * Generic pagination method with caching
   */
  async paginate<T>(
    model: any,
    pagination: PaginationInput,
    where: any = {},
    include: any = {},
    select: any = undefined,
    orderBy: any = { createdAt: 'desc' },
    options: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = performance.now();
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(model, pagination, where, include, select, orderBy);
    
    try {
      // Try to get from cache first
      if (opts.enableCache) {
        const cached = await redisService.get<PaginationResult<T>>(cacheKey);
        if (cached) {
          return {
            ...cached,
            performance: {
              cacheHit: true,
              queryTime: 0,
              cacheTime: performance.now() - startTime,
            },
          };
        }
      }

      // Calculate pagination parameters
      const { page, limit, sortBy, sortOrder } = pagination;
      const skip = (page - 1) * limit;
      
      // Build order by clause
      const finalOrderBy = sortBy ? { [sortBy]: sortOrder } : orderBy;

      // Execute queries in parallel for better performance
      const [data, total] = await Promise.all([
        // Get paginated data
        model.findMany({
          where,
          include: Object.keys(include).length > 0 ? include : undefined,
          select,
          orderBy: finalOrderBy,
          skip,
          take: limit,
          ...(opts.optimizeQueries && {
            // Add query hints for better performance
            _count: false,
          }),
        }),
        // Get total count (only if needed)
        opts.includeCount ? model.count({ where }) : Promise.resolve(0),
      ]);

      const queryTime = performance.now() - startTime;
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      const result: PaginationResult<T> = {
        data: data as T[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null,
        },
        performance: {
          cacheHit: false,
          queryTime,
          cacheTime: 0,
        },
      };

      // Cache the result
      if (opts.enableCache) {
        await redisService.set(cacheKey, result, opts.cacheTTL!);
      }

      return result;
    } catch (error) {
      console.error('Pagination error:', error);
      throw error;
    }
  }

  /**
   * Paginate with search functionality
   */
  async paginateWithSearch<T>(
    model: any,
    pagination: PaginationInput,
    searchFields: string[],
    searchTerm: string,
    where: any = {},
    include: any = {},
    select: any = undefined,
    orderBy: any = { createdAt: 'desc' },
    options: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    // Build search conditions
    if (searchTerm && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive' as const,
        },
      }));
      
      where = {
        ...where,
        OR: searchConditions,
      };
    }

    return this.paginate(model, pagination, where, include, select, orderBy, options);
  }

  /**
   * Paginate with date range filtering
   */
  async paginateWithDateRange<T>(
    model: any,
    pagination: PaginationInput,
    dateField: string,
    startDate: Date,
    endDate: Date,
    where: any = {},
    include: any = {},
    select: any = undefined,
    orderBy: any = { createdAt: 'desc' },
    options: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    where = {
      ...where,
      [dateField]: {
        gte: startDate,
        lte: endDate,
      },
    };

    return this.paginate(model, pagination, where, include, select, orderBy, options);
  }

  /**
   * Paginate with multiple filters
   */
  async paginateWithFilters<T>(
    model: any,
    pagination: PaginationInput,
    filters: Record<string, any>,
    where: any = {},
    include: any = {},
    select: any = undefined,
    orderBy: any = { createdAt: 'desc' },
    options: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          where[key] = { ...where[key], ...value };
        } else {
          where[key] = value;
        }
      }
    }

    return this.paginate(model, pagination, where, include, select, orderBy, options);
  }

  /**
   * Batch pagination for multiple models
   */
  async batchPaginate<T extends Record<string, any>>(
    queries: Array<{
      model: any;
      pagination: PaginationInput;
      where?: any;
      include?: any;
      select?: any;
      orderBy?: any;
      options?: PaginationOptions;
    }>
  ): Promise<Record<string, PaginationResult<any>>> {
    const results: Record<string, PaginationResult<any>> = {};
    
    // Execute all queries in parallel
    const promises = queries.map(async (query, index) => {
      const result = await this.paginate(
        query.model,
        query.pagination,
        query.where || {},
        query.include || {},
        query.select,
        query.orderBy || { createdAt: 'desc' },
        query.options || {}
      );
      
      return { index, result };
    });

    const resolvedResults = await Promise.all(promises);
    
    // Organize results
    resolvedResults.forEach(({ index, result }) => {
      results[`query_${index}`] = result;
    });

    return results;
  }

  /**
   * Infinite scroll pagination
   */
  async infiniteScroll<T>(
    model: any,
    cursor: any,
    limit: number,
    where: any = {},
    include: any = {},
    select: any = undefined,
    orderBy: any = { createdAt: 'desc' },
    options: PaginationOptions = {}
  ): Promise<{
    data: T[];
    nextCursor: any;
    hasMore: boolean;
    performance: { cacheHit: boolean; queryTime: number; cacheTime: number };
  }> {
    const startTime = performance.now();
    const cacheKey = `infinite:${model.name}:${JSON.stringify({ cursor, limit, where, include, select, orderBy })}`;

    try {
      // Try cache first
      if (options.enableCache !== false) {
        const cached = await redisService.get<{
          data: T[];
          nextCursor: any;
          hasMore: boolean;
        }>(cacheKey);
        if (cached) {
          return {
            ...cached,
            performance: {
              cacheHit: true,
              queryTime: 0,
              cacheTime: performance.now() - startTime,
            },
          };
        }
      }

      // Build query
      const query: any = {
        where,
        include: Object.keys(include).length > 0 ? include : undefined,
        select,
        orderBy,
        take: limit + 1, // Take one extra to check if there are more
      };

      if (cursor) {
        query.cursor = cursor;
        query.skip = 1; // Skip the cursor
      }

      const data = await model.findMany(query);
      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, limit) : data;
      const nextCursor = hasMore ? data[limit - 1].id : null;

      const queryTime = performance.now() - startTime;
      
      const result = {
        data: items as T[],
        nextCursor,
        hasMore,
        performance: {
          cacheHit: false,
          queryTime,
          cacheTime: 0,
        },
      };

      // Cache result
      if (options.enableCache !== false) {
        await redisService.set(cacheKey, result, options.cacheTTL || 300);
      }

      return result;
    } catch (error) {
      console.error('Infinite scroll error:', error);
      throw error;
    }
  }

  /**
   * Clear pagination cache
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      const searchPattern = pattern || 'pagination:*';
      await redisService.delPattern(searchPattern);
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const keys = await redisService.keys('pagination:*');
      const infiniteKeys = await redisService.keys('infinite:*');
      
      return {
        paginationKeys: keys.length,
        infiniteKeys: infiniteKeys.length,
        totalKeys: keys.length + infiniteKeys.length,
        redisStats: await redisService.getPerformanceStats(),
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    model: any,
    pagination: PaginationInput,
    where: any,
    include: any,
    select: any,
    orderBy: any
  ): string {
    const modelName = model.name || 'unknown';
    const hash = JSON.stringify({
      pagination,
      where,
      include,
      select,
      orderBy,
    });
    
    return `pagination:${modelName}:${Buffer.from(hash).toString('base64').slice(0, 32)}`;
  }

  /**
   * Optimize query for better performance
   */
  private optimizeQuery(query: any): any {
    return {
      ...query,
      // Add query hints for better performance
      _count: false,
      // Use cursor-based pagination when possible
      ...(query.orderBy && { cursor: query.orderBy }),
    };
  }
}

// Singleton instance
const paginationService = new PaginationService();
export default paginationService; 