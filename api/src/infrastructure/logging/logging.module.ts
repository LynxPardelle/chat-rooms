import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppLoggerService } from './app-logger.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: (configService: ConfigService) => {
        return new AppLoggerService('Application', configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AppLoggerService],
})
export class LoggingModule {}
