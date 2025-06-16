import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Services
import { UserSettingsService } from '../../infrastructure/user-settings/user-settings.service';
import { AvatarManagementService } from '../../infrastructure/user-settings/avatar-management.service';

// Controllers
import { UserSettingsController } from '../controllers/user-settings.controller';

// Database Models
import { User, UserSchema } from '../../infrastructure/database/models/user.schema';

// Database
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = configService.get('UPLOAD_PATH') || './uploads/avatars';
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
            cb(null, uniqueName);
          },
        }),
        fileFilter: (req, file, cb) => {
          // Allow only image files
          const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Only image files are allowed!'), false);
          }
        },
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB max file size
          files: 1, // Only one file per upload
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserSettingsController],
  providers: [
    UserSettingsService,
    AvatarManagementService,
  ],
  exports: [
    UserSettingsService,
    AvatarManagementService,
  ],
})
export class UserSettingsModule {}
