export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  recentOperations: PerformanceMetrics[];
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 operations
  
  private constructor() {}
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  startOperation(operation: string, metadata?: Record<string, any>): string {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.push({
      operation,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      metadata: { ...metadata, operationId }
    });
    
    // Clean up old metrics if we exceed the limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    return operationId;
  }

  /**
   * End timing an operation
   */
  endOperation(operationId: string, success: boolean = true, error?: string): void {
    const metric = this.metrics.find(m => m.metadata?.operationId === operationId);
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = success;
      if (error) metric.error = error;
    }
  }

  /**
   * Time an async operation
   */
  async timeOperation<T>(
    operation: string,
    operationFn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const operationId = this.startOperation(operation, metadata);
    
    try {
      const result = await operationFn();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Time a sync operation
   */
  timeSyncOperation<T>(
    operation: string,
    operationFn: () => T,
    metadata?: Record<string, any>
  ): T {
    const operationId = this.startOperation(operation, metadata);
    
    try {
      const result = operationFn();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getOperationStats(operation: string): PerformanceStats {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        recentOperations: []
      };
    }

    const durations = operationMetrics.map(m => m.duration);
    const successful = operationMetrics.filter(m => m.success);
    
    return {
      totalOperations: operationMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successful.length / operationMetrics.length) * 100,
      recentOperations: operationMetrics.slice(-10) // Last 10 operations
    };
  }

  /**
   * Get overall performance statistics
   */
  getOverallStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        recentOperations: []
      };
    }

    const durations = this.metrics.map(m => m.duration);
    const successful = this.metrics.filter(m => m.success);
    
    return {
      totalOperations: this.metrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successful.length / this.metrics.length) * 100,
      recentOperations: this.metrics.slice(-20) // Last 20 operations
    };
  }

  /**
   * Get performance comparison between operations
   */
  compareOperations(operations: string[]): Record<string, PerformanceStats> {
    const comparison: Record<string, PerformanceStats> = {};
    
    operations.forEach(operation => {
      comparison[operation] = this.getOperationStats(operation);
    });
    
    return comparison;
  }

  /**
   * Get slowest operations
   */
  getSlowestOperations(limit: number = 10): Array<{ operation: string; avgDuration: number }> {
    const operationStats = new Map<string, { total: number; count: number }>();
    
    this.metrics.forEach(metric => {
      const existing = operationStats.get(metric.operation);
      if (existing) {
        existing.total += metric.duration;
        existing.count += 1;
      } else {
        operationStats.set(metric.operation, { total: metric.duration, count: 1 });
      }
    });
    
    return Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        avgDuration: stats.total / stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(hours: number = 24): Array<{ hour: string; avgDuration: number; count: number }> {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const trends: Record<string, { total: number; count: number }> = {};
    
    this.metrics.forEach(metric => {
      if (metric.endTime > now - (hours * hourMs)) {
        const hour = new Date(metric.startTime).toISOString().substring(0, 13) + ':00:00.000Z';
        const existing = trends[hour];
        if (existing) {
          existing.total += metric.duration;
          existing.count += 1;
        } else {
          trends[hour] = { total: metric.duration, count: 1 };
        }
      }
    });
    
    return Object.entries(trends)
      .map(([hour, stats]) => ({
        hour,
        avgDuration: stats.total / stats.count,
        count: stats.count
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { metricsCount: number; memoryUsage: string } {
    const memoryUsage = process.memoryUsage();
    return {
      metricsCount: this.metrics.length,
      memoryUsage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
    };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();


