import { Module } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { MetricsController } from './metrics.controller';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [MetricsController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class MonitoringModule {}
