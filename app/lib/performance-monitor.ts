import { performance } from 'perf_hooks';
import redisService from './redis-service';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
  operations: {
    [key: string]: {
      count: number;
      averageDuration: number;
      successRate: number;
      lastOccurrence: number;
    };
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics in memory
  private readonly flushInterval = 60000; // Flush to Redis every minute
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicFlush();
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    performance.mark(`${timerId}_start`);
    return timerId;
  }

  /**
   * End timing an operation and record the metric
   */
  endTimer(timerId: string, success: boolean = true, error?: string, metadata?: Record<string, any>): number {
    performance.mark(`${timerId}_end`);
    performance.measure(timerId, `${timerId}_start`, `${timerId}_end`);
    
    const measure = performance.getEntriesByName(timerId)[0];
    const duration = measure.duration;
    
    // Extract operation name from timer ID
    const operation = timerId.split('_')[0];
    
    this.recordMetric({
      operation,
      duration,
      timestamp: Date.now(),
      success,
      error,
      metadata
    });

    // Clean up performance marks
    performance.clearMarks(`${timerId}_start`);
    performance.clearMarks(`${timerId}_end`);
    performance.clearMeasures(timerId);

    return duration;
  }

  /**
   * Record a metric directly
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        errorRate: 0,
        p95Duration: 0,
        p99Duration: 0,
        operations: {}
      };
    }

    const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b);
    const successful = this.metrics.filter(m => m.success);
    const failed = this.metrics.filter(m => !m.success);

    // Group by operation
    const operations: Record<string, PerformanceMetric[]> = {};
    this.metrics.forEach(metric => {
      if (!operations[metric.operation]) {
        operations[metric.operation] = [];
      }
      operations[metric.operation].push(metric);
    });

    const operationStats: Record<string, any> = {};
    Object.entries(operations).forEach(([operation, metrics]) => {
      const opDurations = metrics.map(m => m.duration);
      const opSuccessful = metrics.filter(m => m.success);
      
      operationStats[operation] = {
        count: metrics.length,
        averageDuration: opDurations.reduce((a, b) => a + b, 0) / opDurations.length,
        successRate: opSuccessful.length / metrics.length,
        lastOccurrence: Math.max(...metrics.map(m => m.timestamp))
      };
    });

    return {
      totalOperations: this.metrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: successful.length / this.metrics.length,
      errorRate: failed.length / this.metrics.length,
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      operations: operationStats
    };
  }

  /**
   * Get performance stats for a specific operation
   */
  getOperationStats(operation: string): any {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successful = operationMetrics.filter(m => m.success);
    const failed = operationMetrics.filter(m => !m.success);

    return {
      operation,
      count: operationMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      successRate: successful.length / operationMetrics.length,
      errorRate: failed.length / operationMetrics.length,
      lastOccurrence: Math.max(...operationMetrics.map(m => m.timestamp)),
      recentErrors: failed.slice(-5).map(m => ({
        timestamp: m.timestamp,
        error: m.error,
        duration: m.duration
      }))
    };
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(threshold: number = 1000): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): Record<string, number> {
    const errorCounts: Record<string, number> = {};
    
    this.metrics
      .filter(m => !m.success && m.error)
      .forEach(m => {
        errorCounts[m.error!] = (errorCounts[m.error!] || 0) + 1;
      });

    return errorCounts;
  }

  /**
   * Get performance trends (last N minutes)
   */
  getTrends(minutes: number = 60): any {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) {
      return null;
    }

    const durations = recentMetrics.map(m => m.duration);
    const successful = recentMetrics.filter(m => m.success);

    return {
      period: `${minutes} minutes`,
      totalOperations: recentMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      successRate: successful.length / recentMetrics.length,
      operationsPerMinute: recentMetrics.length / minutes
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Flush metrics to Redis for persistence
   */
  async flushToRedis(): Promise<void> {
    try {
      const stats = this.getStats();
      const timestamp = Date.now();
      
      await Promise.all([
        redisService.set(`performance:stats:${timestamp}`, stats, 86400), // Keep for 24 hours
        redisService.set('performance:stats:latest', stats, 3600), // Keep latest for 1 hour
        redisService.lpush('performance:history', { timestamp, stats }, 100) // Keep last 100 entries
      ]);

      console.log(`📊 Performance metrics flushed to Redis: ${this.metrics.length} metrics`);
    } catch (error) {
      console.error('Failed to flush performance metrics to Redis:', error);
    }
  }

  /**
   * Get historical performance data from Redis
   */
  async getHistoricalData(hours: number = 24): Promise<any[]> {
    try {
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      const history = await redisService.lrange<any>('performance:history', 0, -1);
      
      return history
        .filter(entry => entry.timestamp > cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to get historical performance data:', error);
      return [];
    }
  }

  /**
   * Start periodic flushing to Redis
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushToRedis();
    }, this.flushInterval);
  }

  /**
   * Stop periodic flushing
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[index] || 0;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): any {
    const memUsage = process.memoryUsage();
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
      metricsCount: this.metrics.length
    };
  }

  /**
   * Get system health score (0-100)
   */
  getHealthScore(): number {
    const stats = this.getStats();
    
    if (stats.totalOperations === 0) {
      return 100; // No operations means no issues
    }

    let score = 100;

    // Deduct points for high error rate
    score -= stats.errorRate * 50;

    // Deduct points for slow operations (p95 > 1000ms)
    if (stats.p95Duration > 1000) {
      score -= Math.min(30, (stats.p95Duration - 1000) / 100);
    }

    // Deduct points for very slow operations (p99 > 5000ms)
    if (stats.p99Duration > 5000) {
      score -= Math.min(20, (stats.p99Duration - 5000) / 500);
    }

    return Math.max(0, Math.round(score));
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export both the class and the singleton instance
export { PerformanceMonitor };
export default performanceMonitor; 