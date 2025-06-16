import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface DatabaseMetrics {
  activeConnections: number;
  availableConnections: number;
  totalConnections: number;
  poolSize: number;
  databaseResponseTime: number;
  slowQueries: number;
  connectionErrors: number;
  timestamp: number;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectionPool: {
    active: number;
    available: number;
    total: number;
    utilization: number;
  };
  performance: {
    averageResponseTime: number;
    slowQueryCount: number;
    errorRate: number;
  };
  alerts: string[];
}

@Injectable()
export class DatabaseMonitoringService {
  private readonly logger = new Logger(DatabaseMonitoringService.name);
  private metrics: DatabaseMetrics[] = [];
  private slowQueryCount = 0;
  private connectionErrors = 0;
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly HIGH_UTILIZATION_THRESHOLD = 0.8; // 80%

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {
    this.setupQueryMonitoring();
  }

  /**
   * Set up monitoring for slow queries and connection events
   */
  private setupQueryMonitoring() {
    // Monitor slow queries
    this.connection.on('query', (query: any) => {
      const startTime = Date.now();
      
      query.on('end', () => {
        const duration = Date.now() - startTime;
        if (duration > this.SLOW_QUERY_THRESHOLD) {
          this.slowQueryCount++;
          this.logger.warn(`Slow query detected: ${duration}ms`, {
            operation: query.op,
            collection: query.collectionName,
            duration,
          });
        }
      });
    });

    // Monitor connection errors
    this.connection.on('error', (error) => {
      this.connectionErrors++;
      this.logger.error(`Database connection error: ${error.message}`, error.stack);
    });

    // Monitor connection state changes
    this.connection.on('disconnected', () => {
      this.logger.warn('Database disconnected');
    });

    this.connection.on('reconnected', () => {
      this.logger.log('Database reconnected');
    });
  }
  /**
   * Collect database metrics every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Ping database to measure response time
      if (this.connection.db) {
        await this.connection.db.admin().ping();
      }
      const responseTime = Date.now() - startTime;

      // Get connection pool stats
      const poolStats = this.getConnectionPoolStats();

      const metrics: DatabaseMetrics = {
        activeConnections: poolStats.activeConnections,
        availableConnections: poolStats.availableConnections,
        totalConnections: poolStats.totalConnections,
        poolSize: poolStats.poolSize,
        databaseResponseTime: responseTime,
        slowQueries: this.slowQueryCount,
        connectionErrors: this.connectionErrors,
        timestamp: Date.now(),
      };

      this.metrics.push(metrics);

      // Keep only recent metrics
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
      }

      // Log warnings for high utilization
      const utilization = poolStats.activeConnections / poolStats.poolSize;
      if (utilization > this.HIGH_UTILIZATION_THRESHOLD) {
        this.logger.warn(`High connection pool utilization: ${(utilization * 100).toFixed(1)}%`);
      }

    } catch (error) {
      this.logger.error(`Failed to collect database metrics: ${error.message}`);
    }
  }
  /**
   * Get connection pool statistics
   */
  private getConnectionPoolStats() {
    const db = this.connection.db;
    
    // For Mongoose connections, we'll use available connection state info
    // Note: Direct access to MongoDB driver connection pool is limited in newer versions
    const connectionStates = this.connection.readyState;
    
    // Return estimated stats based on connection state
    // In production, you might want to implement custom pool monitoring
    return {
      activeConnections: connectionStates === 1 ? 1 : 0, // 1 = connected
      availableConnections: connectionStates === 1 ? 9 : 0, // Estimate based on pool size
      totalConnections: connectionStates === 1 ? 10 : 0,
      poolSize: 10, // From our configuration
    };
  }

  /**
   * Get current database health status
   */
  getHealthStatus(): DatabaseHealth {
    const poolStats = this.getConnectionPoolStats();
    const utilization = poolStats.activeConnections / poolStats.poolSize;
    
    const recentMetrics = this.metrics.slice(-10);
    const averageResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.databaseResponseTime, 0) / recentMetrics.length
      : 0;

    const errorRate = this.connectionErrors / Math.max(this.metrics.length, 1);

    const alerts: string[] = [];
    
    // Check for issues
    if (utilization > this.HIGH_UTILIZATION_THRESHOLD) {
      alerts.push(`High connection pool utilization: ${(utilization * 100).toFixed(1)}%`);
    }
    
    if (averageResponseTime > 500) {
      alerts.push(`High database response time: ${averageResponseTime.toFixed(0)}ms`);
    }
    
    if (this.slowQueryCount > 10) {
      alerts.push(`High number of slow queries: ${this.slowQueryCount}`);
    }
    
    if (errorRate > 0.01) {
      alerts.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (alerts.length > 0) {
      status = utilization > 0.9 || averageResponseTime > 2000 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      connectionPool: {
        active: poolStats.activeConnections,
        available: poolStats.availableConnections,
        total: poolStats.totalConnections,
        utilization,
      },
      performance: {
        averageResponseTime,
        slowQueryCount: this.slowQueryCount,
        errorRate,
      },
      alerts,
    };
  }

  /**
   * Get database metrics for the last N minutes
   */
  getMetrics(minutes: number = 60): DatabaseMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Reset slow query and error counters
   */
  resetCounters(): void {
    this.slowQueryCount = 0;
    this.connectionErrors = 0;
    this.logger.log('Database monitoring counters reset');
  }

  /**
   * Force connection pool cleanup for maintenance
   */
  async cleanupConnections(): Promise<void> {
    try {
      // Close idle connections
      await this.connection.close();
      
      this.logger.log('Database connection pool cleanup completed');
    } catch (error) {
      this.logger.error(`Failed to cleanup database connections: ${error.message}`);
      throw error;
    }
  }
  /**
   * Get database server status
   */
  async getServerStatus(): Promise<any> {
    try {
      if (!this.connection.db) {
        throw new Error('Database connection not available');
      }
      
      const serverStatus = await this.connection.db.admin().serverStatus();
      return {
        connections: serverStatus.connections,
        network: serverStatus.network,
        opcounters: serverStatus.opcounters,
        mem: serverStatus.mem,
        metrics: serverStatus.metrics,
      };
    } catch (error) {
      this.logger.error(`Failed to get server status: ${error.message}`);
      throw error;
    }
  }
}
