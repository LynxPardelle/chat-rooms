import { Controller, Get } from '@nestjs/common';

const MONGODB_CONNECTED_STATE = 1; // mongoose connection state for 'connected'

@Controller('health')
export class HealthController {
  constructor() {}

  @Get()
  checkHealth() {
    // TODO: Re-enable MongoDB health check once connection injection is resolved
    // For now, return basic health status since MongoDB is working but injection needs fix
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: {
          status: 'pending', // Temporary - will be fixed once injection is resolved
          message: 'Connection validation temporarily disabled'
        },
        api: {
          status: 'up',
        },
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    return healthStatus;
  }
}
