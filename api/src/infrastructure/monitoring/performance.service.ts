import { Injectable, Logger, Inject } from '@nestjs/common';
import * as os from 'os';
import * as process from 'process';
import { RedisCacheService } from '../cache/redis-cache.service';

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  connections: {
    websocket: number;
    database: number;
  };
  database: {
    slowQueries: number;
    totalQueries: number;
    averageResponseTime: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    operations: number;
  };
  uptime: number;
}

export interface AlertThreshold {
  cpuUsage: number;
  memoryUsage: number;
  slowQueries: number;
  responseTime: number;
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private metricsHistory: PerformanceMetrics[] = [];
  private readonly maxHistorySize = 100;
  private monitoringInterval: NodeJS.Timeout;
  private readonly customMetrics = new Map<string, number>();
  
  private alertThresholds: AlertThreshold = {
    cpuUsage: 80, // 80%
    memoryUsage: 85, // 85%
    slowQueries: 10, // 10 slow queries per minute
    responseTime: 1000, // 1 second
  };
  private currentMetrics: PerformanceMetrics = {
    timestamp: 0,
    cpu: { usage: 0, loadAverage: [] },
    memory: { used: 0, free: 0, total: 0, percentage: 0, heapUsed: 0, heapTotal: 0 },
    connections: { websocket: 0, database: 0 },
    database: { slowQueries: 0, totalQueries: 0, averageResponseTime: 0 },
    cache: { hitRate: 0, missRate: 0, operations: 0 },
    uptime: 0,
  };

  constructor(
    @Inject(RedisCacheService) private readonly cacheService: RedisCacheService
  ) {
    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Collect metrics every 30 seconds

    this.logger.log('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.logger.log('Performance monitoring stopped');
    }
  }

  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cpu: this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      connections: { ...this.currentMetrics.connections },
      database: { ...this.currentMetrics.database },
      cache: { ...this.currentMetrics.cache },
      uptime: process.uptime(),
    };

    // Add to history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Check for alerts
    this.checkAlerts(metrics);

    return metrics;
  }

  /**
   * Get CPU metrics
   */
  private getCpuMetrics(): PerformanceMetrics['cpu'] {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage,
      loadAverage: os.loadavg(),
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): PerformanceMetrics['memory'] {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      used: usedMem,
      free: freeMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    };
  }

  /**
   * Update WebSocket connection count
   */
  updateWebSocketConnections(count: number): void {
    this.currentMetrics.connections.websocket = count;
  }

  /**
   * Update database connection count
   */
  updateDatabaseConnections(count: number): void {
    this.currentMetrics.connections.database = count;
  }

  /**
   * Record slow query
   */
  recordSlowQuery(queryTime: number): void {
    this.currentMetrics.database.slowQueries++;
    this.currentMetrics.database.totalQueries++;
    
    // Update average response time
    const current = this.currentMetrics.database.averageResponseTime || 0;
    const total = this.currentMetrics.database.totalQueries;
    this.currentMetrics.database.averageResponseTime = 
      (current * (total - 1) + queryTime) / total;
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(queryTime: number): void {
    this.currentMetrics.database.totalQueries++;
    
    // Update average response time
    const current = this.currentMetrics.database.averageResponseTime || 0;
    const total = this.currentMetrics.database.totalQueries;
    this.currentMetrics.database.averageResponseTime = 
      (current * (total - 1) + queryTime) / total;
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.currentMetrics.cache.operations++;
    const ops = this.currentMetrics.cache.operations;
    const currentHitRate = this.currentMetrics.cache.hitRate || 0;
    this.currentMetrics.cache.hitRate = (currentHitRate * (ops - 1) + 1) / ops;
    this.currentMetrics.cache.missRate = 1 - this.currentMetrics.cache.hitRate;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.currentMetrics.cache.operations++;
    const ops = this.currentMetrics.cache.operations;
    const currentHitRate = this.currentMetrics.cache.hitRate || 0;
    this.currentMetrics.cache.hitRate = (currentHitRate * (ops - 1)) / ops;
    this.currentMetrics.cache.missRate = 1 - this.currentMetrics.cache.hitRate;
  }

  /**
   * Record WebSocket-specific metrics
   */
  async recordWebSocketMetrics(metrics: {
    connectedClients: number;
    connectedUsers: number;
    activeRooms: number;
    activeThreads: number;
    messageBufferSize: number;
    memoryUsage: NodeJS.MemoryUsage;
    timestamp: number;
  }): Promise<void> {
    try {      // Store WebSocket metrics in cache for monitoring
      await this.cacheService.set(
        'websocket:metrics',
        JSON.stringify(metrics),
        { ttl: 300 } // 5 minutes TTL
      );

      // Update internal metrics
      this.customMetrics.set('websocket_connections', metrics.connectedClients);
      this.customMetrics.set('websocket_users', metrics.connectedUsers);
      this.customMetrics.set('websocket_rooms', metrics.activeRooms);
      this.customMetrics.set('websocket_memory_mb', metrics.memoryUsage.heapUsed / 1024 / 1024);

      // Check for alerts
      if (metrics.connectedClients > 5000) {
        await this.generateAlert({
          type: 'websocket_high_connections',
          message: `High WebSocket connection count: ${metrics.connectedClients}`,
          severity: 'warning',
          timestamp: Date.now(),
          metadata: { connectedClients: metrics.connectedClients }
        });
      }

      if (metrics.memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
        await this.generateAlert({
          type: 'websocket_high_memory',
          message: `High WebSocket memory usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          severity: 'critical',
          timestamp: Date.now(),
          metadata: { memoryUsageMB: metrics.memoryUsage.heapUsed / 1024 / 1024 }
        });
      }

    } catch (error) {
      this.logger.error(`Failed to record WebSocket metrics: ${error.message}`);
    }
  }

  /**
   * Generate performance alert
   */
  private async generateAlert(alert: {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: number;
    metadata?: any;
  }): Promise<void> {
    try {
      // Store alert in cache
      const alertKey = `alert:${alert.type}:${alert.timestamp}`;
      await this.cacheService.set(alertKey, JSON.stringify(alert), { ttl: 3600 }); // 1 hour

      // Log alert based on severity
      switch (alert.severity) {
        case 'critical':
          this.logger.error(`CRITICAL ALERT: ${alert.message}`, alert.metadata);
          break;
        case 'warning':
          this.logger.warn(`WARNING: ${alert.message}`, alert.metadata);
          break;
        default:
          this.logger.log(`INFO: ${alert.message}`, alert.metadata);
      }

      // In a real implementation, you might also send to external monitoring systems
      // like Slack, PagerDuty, etc.

    } catch (error) {
      this.logger.error(`Failed to generate alert: ${error.message}`);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts: string[] = [];

    if (metrics.cpu.usage > this.alertThresholds.cpuUsage) {
      alerts.push(`High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
    }

    if (metrics.memory.percentage > this.alertThresholds.memoryUsage) {
      alerts.push(`High memory usage: ${metrics.memory.percentage.toFixed(2)}%`);
    }

    if (metrics.database.slowQueries > this.alertThresholds.slowQueries) {
      alerts.push(`Too many slow queries: ${metrics.database.slowQueries}`);
    }

    if (metrics.database.averageResponseTime > this.alertThresholds.responseTime) {
      alerts.push(`High database response time: ${metrics.database.averageResponseTime.toFixed(2)}ms`);
    }    if (alerts.length > 0) {
      this.logger.warn(`Performance alerts: ${alerts.join(', ')}`);
      // Could emit events here if EventEmitter2 is available
    }
  }

  /**
   * Get current metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    return this.collectMetrics();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): any {
    if (this.metricsHistory.length === 0) {
      return null;
    }

    const recent = this.metricsHistory.slice(-10); // Last 10 readings
    const avgCpu = recent.reduce((sum, m) => sum + m.cpu.usage, 0) / recent.length;
    const avgMemory = recent.reduce((sum, m) => sum + m.memory.percentage, 0) / recent.length;
    const avgResponseTime = recent.reduce((sum, m) => sum + m.database.averageResponseTime, 0) / recent.length;

    return {
      averageCpuUsage: avgCpu.toFixed(2),
      averageMemoryUsage: avgMemory.toFixed(2),
      averageResponseTime: avgResponseTime.toFixed(2),
      totalQueries: this.currentMetrics.database.totalQueries,
      slowQueries: this.currentMetrics.database.slowQueries,
      cacheHitRate: (this.currentMetrics.cache.hitRate * 100).toFixed(2),
      uptime: process.uptime(),
      connections: this.currentMetrics.connections,
    };
  }

  /**
   * Reset metrics counters
   */
  resetCounters(): void {
    this.currentMetrics.database.slowQueries = 0;
    this.currentMetrics.database.totalQueries = 0;
    this.currentMetrics.database.averageResponseTime = 0;
    this.currentMetrics.cache.operations = 0;
    this.currentMetrics.cache.hitRate = 0;
    this.currentMetrics.cache.missRate = 0;
    
    this.logger.log('Performance counters reset');
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<AlertThreshold>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.logger.log('Alert thresholds updated', thresholds);
  }

  /**
   * Get system health status
   */
  getHealthStatus(): { status: 'healthy' | 'warning' | 'critical'; details: any } {
    if (this.metricsHistory.length === 0) {
      return { status: 'warning', details: 'No metrics available' };
    }

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const issues: string[] = [];

    if (latest.cpu.usage > this.alertThresholds.cpuUsage) {
      issues.push('High CPU usage');
    }

    if (latest.memory.percentage > this.alertThresholds.memoryUsage) {
      issues.push('High memory usage');
    }

    if (latest.database.averageResponseTime > this.alertThresholds.responseTime) {
      issues.push('Slow database responses');
    }

    if (issues.length === 0) {
      return { status: 'healthy', details: 'All systems operating normally' };
    } else if (issues.length <= 2) {
      return { status: 'warning', details: issues };
    } else {
      return { status: 'critical', details: issues };
    }
  }
}
