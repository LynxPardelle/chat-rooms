import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from '../../application/services/analytics.service';
import { JwtAuthGuard } from '../../infrastructure/security/guards/jwt-auth.guard';
import { AdminGuard } from '../../infrastructure/security/guards/admin.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  @ApiOperation({ summary: 'Track analytics event' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully' })
  async trackEvent(
    @Body() eventData: {
      type: string;
      data: Record<string, any>;
    },
    @Request() req: any
  ) {
    this.analyticsService.track(
      eventData.type,
      eventData.data,
      req.user.userId,
      req.headers['x-session-id']
    );
    
    return { success: true };
  }

  @Get('dashboard')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get analytics dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ) {
    return this.analyticsService.getDashboardMetrics(timeRange);
  }

  @Get('historical')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get historical analytics data' })
  @ApiResponse({ status: 200, description: 'Historical data retrieved successfully' })
  async getHistoricalData(
    @Query('metric') metric: 'messages' | 'users' | 'performance' | 'errors' = 'messages',
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
    @Query('granularity') granularity: 'minute' | 'hour' | 'day' = 'hour'
  ) {
    return this.analyticsService.getHistoricalData(metric, timeRange, granularity);
  }

  @Get('engagement')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get user engagement analytics' })
  @ApiResponse({ status: 200, description: 'Engagement data retrieved successfully' })
  async getEngagementAnalytics(
    @Query('userId') userId?: string
  ) {
    return this.analyticsService.getUserEngagementAnalytics(userId);
  }

  @Get('export')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({ status: 200, description: 'Data exported successfully' })
  async exportData(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('timeRange') timeRange: '24h' | '7d' | '30d' = '24h',
    @Query('dataType') dataType: 'events' | 'performance' | 'engagement' | 'all' = 'all'
  ) {
    return this.analyticsService.exportData(format, timeRange, dataType);
  }

  @Post('performance')
  @ApiOperation({ summary: 'Track performance metric' })
  @ApiResponse({ status: 201, description: 'Performance metric tracked successfully' })
  async trackPerformance(
    @Body() performanceData: {
      type: 'response_time' | 'database_query' | 'websocket_latency' | 'api_call';
      operation: string;
      duration: number;
      success: boolean;
      errorCode?: string;
      metadata?: Record<string, any>;
    }
  ) {
    this.analyticsService.trackPerformance(
      performanceData.type,
      performanceData.operation,
      performanceData.duration,
      performanceData.success,
      performanceData.errorCode,
      performanceData.metadata
    );
    
    return { success: true };
  }

  @Post('system-health')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Track system health metrics' })
  @ApiResponse({ status: 201, description: 'System health tracked successfully' })
  async trackSystemHealth(
    @Body() healthData: {
      cpu: number;
      memory: number;
      activeConnections: number;
      messagesPerSecond: number;
      errorRate: number;
      responseTime: number;
    }
  ) {
    this.analyticsService.trackSystemHealth(healthData);
    return { success: true };
  }

  @Get('performance')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  async getPerformanceMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ) {
    return this.analyticsService.getPerformanceMetrics(timeRange, startDate, endDate);
  }

  @Get('user-activity')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get user activity analytics' })
  @ApiResponse({ status: 200, description: 'User activity data retrieved successfully' })
  async getUserActivityData(
    @Query('period') period: '1d' | '7d' | '30d' = '30d',
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ) {
    return this.analyticsService.getUserActivityData(period, timeRange);
  }

  @Get('message-analytics')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get message analytics' })
  @ApiResponse({ status: 200, description: 'Message analytics retrieved successfully' })
  async getMessageAnalytics(
    @Query('roomId') roomId?: string,
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ) {
    return this.analyticsService.getMessageAnalytics(roomId, timeRange);
  }
}
