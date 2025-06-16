import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ModerationService, UserReport } from '../../application/services/moderation.service';
import { JwtAuthGuard } from '../../infrastructure/security/guards/jwt-auth.guard';
import { AdminGuard } from '../../infrastructure/security/guards/admin.guard';

@ApiTags('moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('content/moderate')
  @ApiOperation({ summary: 'Moderate content' })
  @ApiResponse({ status: 201, description: 'Content moderated successfully' })
  async moderateContent(
    @Body() contentData: {
      content: string;
      roomId: string;
      messageId?: string;
    },
    @Request() req: any
  ) {
    const result = await this.moderationService.moderateContent(
      contentData.content,
      {
        userId: req.user.userId,
        roomId: contentData.roomId,
        messageId: contentData.messageId,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now()
      }
    );
    
    return result;
  }

  @Post('reports')
  @ApiOperation({ summary: 'Submit user report' })
  @ApiResponse({ status: 201, description: 'Report submitted successfully' })
  async submitReport(
    @Body() reportData: {
      targetUserId: string;
      targetMessageId?: string;
      reason: UserReport['reason'];
      description: string;
      evidence?: string[];
    },
    @Request() req: any
  ) {
    const report = await this.moderationService.submitReport(
      req.user.userId,
      reportData.targetUserId,
      reportData.reason,
      reportData.description,
      reportData.targetMessageId,
      reportData.evidence
    );
    
    return report;
  }

  @Get('reports/pending')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get pending reports' })
  @ApiResponse({ status: 200, description: 'Pending reports retrieved successfully' })
  async getPendingReports(
    @Query('priority') priority?: UserReport['priority']
  ) {
    return this.moderationService.getPendingReports(priority);
  }

  @Post('reports/:reportId/review')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Review user report' })
  @ApiResponse({ status: 200, description: 'Report reviewed successfully' })
  async reviewReport(
    @Param('reportId') reportId: string,
    @Body() reviewData: {
      decision: 'dismiss' | 'warn' | 'mute' | 'ban';
      resolution: string;
    },
    @Request() req: any
  ) {
    const report = await this.moderationService.reviewReport(
      reportId,
      req.user.userId,
      reviewData.decision,
      reviewData.resolution
    );
    
    return report;
  }

  @Post('actions')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Take moderation action' })
  @ApiResponse({ status: 201, description: 'Moderation action taken successfully' })
  async takeModerationAction(
    @Body() actionData: {
      type: 'warn' | 'mute' | 'kick' | 'ban' | 'delete_message' | 'edit_message';
      targetUserId: string;
      targetMessageId?: string;
      reason: string;
      duration?: number;
    },
    @Request() req: any
  ) {
    const action = await this.moderationService.takeModerationAction(
      actionData.type,
      actionData.targetUserId,
      req.user.userId,
      actionData.reason,
      actionData.targetMessageId,
      actionData.duration
    );
    
    return action;
  }

  @Get('dashboard')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get moderation dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getModerationDashboard(
    @Query('timeRange') timeRange: '24h' | '7d' | '30d' = '24h'
  ) {
    return this.moderationService.getModerationDashboard(timeRange);
  }

  @Get('users/:userId/history')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get user moderation history' })
  @ApiResponse({ status: 200, description: 'User history retrieved successfully' })
  async getUserModerationHistory(
    @Param('userId') userId: string
  ) {
    return this.moderationService.getUserModerationHistory(userId);
  }
}
