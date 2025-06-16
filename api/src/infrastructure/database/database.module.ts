import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import databaseConfig from './config/database.config';
import { User, UserSchema } from './models/user.schema';
import { Message, MessageSchema } from './models/message.schema';
import { UserRepository } from './repositories/user.repository';
import { DatabaseMonitoringService } from './monitoring/database-monitoring.service';

@Module({
  imports: [
    ConfigModule.forFeature(databaseConfig),
    ScheduleModule.forRoot(), // Enable cron jobs for monitoring
    // MongoDB configuration enabled for Phase 3
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database') as {
          uri: string;
          user?: string;
          password?: string;
          options?: Record<string, unknown>;
          dbName?: string;
        };

        if (!dbConfig) {
          throw new Error('Database configuration not found');
        }

        // Build connection string
        let uri = dbConfig.uri;

        // If username and password are provided, add them to the connection string
        if (dbConfig.user && dbConfig.password) {
          const [protocol, rest] = uri.split('://');
          uri = `${protocol}://${dbConfig.user}:${dbConfig.password}@${rest}`;
        }

        return {
          uri,
          ...dbConfig.options,
          dbName: dbConfig.dbName,
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  providers: [UserRepository, DatabaseMonitoringService], // Re-enabled for Phase 3
  exports: [UserRepository, DatabaseMonitoringService], // Re-enabled for Phase 3
})
export class DatabaseModule {}
