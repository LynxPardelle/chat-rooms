import { Module } from '@nestjs/common';
import { SecurityModule } from '../../infrastructure/security';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../../application/services';

@Module({
  imports: [SecurityModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
