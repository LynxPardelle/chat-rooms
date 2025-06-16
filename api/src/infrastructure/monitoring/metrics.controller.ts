import { Controller, Get, Post, Logger, UseGuards } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';

@Controller('admin/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(
    private readonly performanceService: PerformanceService,
    private readonly cacheService: RedisCacheService,
  ) {}

  @Get()
  async getMetrics() {
    try {
      const [performance, cacheStats] = await Promise.all([
        this.performanceService.getCurrentMetrics(),
        this.cacheService.getStats(),
      ]);

      return {
        success: true,
        data: {
          performance,
          cache: cacheStats,
          summary: this.performanceService.getPerformanceSummary(),
          health: this.performanceService.getHealthStatus(),
        },
      };
    } catch (error) {
      this.logger.error('Error getting metrics:', error);
      return {
        success: false,
        error: 'Failed to retrieve metrics',
      };
    }
  }

  @Get('health')
  async getHealth() {
    try {
      const [cacheHealth, systemHealth] = await Promise.all([
        this.cacheService.healthCheck(),
        Promise.resolve(this.performanceService.getHealthStatus()),
      ]);

      return {
        success: true,
        data: {
          cache: cacheHealth ? 'healthy' : 'unhealthy',
          system: systemHealth,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Error checking health:', error);
      return {
        success: false,
        error: 'Health check failed',
      };
    }
  }

  @Get('history')
  async getMetricsHistory() {
    try {
      const history = this.performanceService.getMetricsHistory();
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error('Error getting metrics history:', error);
      return {
        success: false,
        error: 'Failed to retrieve metrics history',
      };
    }
  }

  @Post('reset')
  async resetCounters() {
    try {
      this.performanceService.resetCounters();
      return {
        success: true,
        message: 'Performance counters reset successfully',
      };
    } catch (error) {
      this.logger.error('Error resetting counters:', error);
      return {
        success: false,
        error: 'Failed to reset counters',
      };
    }
  }

  @Get('summary')
  async getSummary() {
    try {
      const summary = this.performanceService.getPerformanceSummary();
      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error('Error getting summary:', error);
      return {
        success: false,
        error: 'Failed to retrieve performance summary',
      };
    }
  }
}
