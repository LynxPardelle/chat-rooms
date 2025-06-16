import { Controller, Get } from '@nestjs/common';
import { SocketService } from './socket.service';
import { WebSocketConfigService } from './websocket.config';

@Controller('websocket')
export class WebSocketHealthController {
  constructor(
    private readonly socketService: SocketService,
    private readonly wsConfigService: WebSocketConfigService,
  ) {}

  @Get('health')
  getHealth() {
    const stats = this.socketService.getStats();
    const config = this.wsConfigService.config;
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      websocket: {
        namespace: config.namespace,
        corsOrigin: config.corsOrigin,
        connectedUsers: stats.connectedUsers,
        activeRooms: stats.activeRooms,
        totalTypingUsers: stats.totalTypingUsers,
      },
      features: {
        detailedLogging: this.wsConfigService.enableDetailedLogging,
        metrics: this.wsConfigService.enableMetrics,
        heartbeat: this.wsConfigService.enableHeartbeat,
      },
      rateLimits: config.rateLimit,
    };
  }
  @Get('stats')
  getDetailedStats() {
    return {
      timestamp: new Date().toISOString(),
      ...this.socketService.getDetailedStats(),
    };
  }
}
