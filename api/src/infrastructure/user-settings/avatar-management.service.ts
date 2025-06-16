import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/index';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface AvatarUploadResult {
  filename: string;
  url: string;
  sizes: {
    small: string; // 32x32
    medium: string; // 64x64
    large: string; // 128x128
    original: string; // 256x256
  };
}

@Injectable()
export class AvatarManagementService {
  private readonly logger = new Logger(AvatarManagementService.name);
  private readonly uploadPath = process.env.AVATAR_UPLOAD_PATH || './uploads/avatars';
  private readonly baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
  ) {
    this.ensureUploadDirectoryExists();
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<AvatarUploadResult> {
    try {
      this.logger.log(`Uploading avatar for user ${userId}`);
      
      // Validate file
      await this.validateFile(file);
      
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const filename = `${userId}_${uuidv4()}${fileExtension}`;
      
      // Process image and create multiple sizes
      const sizes = await this.processImage(file.buffer, filename);
      
      // Update user avatar in database
      const avatarUrl = `${this.baseUrl}/uploads/avatars/${sizes.large}`;
      await this.updateUserAvatar(userId, avatarUrl, filename);
      
      this.logger.log(`Avatar uploaded successfully for user ${userId}`);
      
      return {
        filename,
        url: avatarUrl,
        sizes: {
          small: `${this.baseUrl}/uploads/avatars/${sizes.small}`,
          medium: `${this.baseUrl}/uploads/avatars/${sizes.medium}`,
          large: `${this.baseUrl}/uploads/avatars/${sizes.large}`,
          original: `${this.baseUrl}/uploads/avatars/${sizes.original}`,
        },
      };
    } catch (error) {
      this.logger.error(`Error uploading avatar for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteAvatar(userId: string): Promise<void> {
    try {
      this.logger.log(`Deleting avatar for user ${userId}`);
      
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      if (user.avatar) {
        // Delete physical files
        await this.deleteAvatarFiles(user.avatar);
        
        // Update user in database
        await this.userModel.findByIdAndUpdate(
          userId,
          {
            $unset: { avatar: '', avatarUrl: '' },
            $set: { updatedAt: new Date() },
          }
        ).exec();
      }

      this.logger.log(`Avatar deleted successfully for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting avatar for user ${userId}:`, error);
      throw error;
    }
  }

  async generateAvatar(userId: string, type: 'identicon' | 'initials', options?: any): Promise<AvatarUploadResult> {
    try {
      this.logger.log(`Generating ${type} avatar for user ${userId}`);
      
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      let imageBuffer: Buffer;
      const filename = `${userId}_generated_${type}_${uuidv4()}.png`;

      if (type === 'identicon') {
        imageBuffer = await this.generateIdenticon(userId, options);
      } else if (type === 'initials') {
        imageBuffer = await this.generateInitialsAvatar(user.username, options);
      } else {
        throw new BadRequestException('Invalid avatar type');
      }

      // Process the generated image
      const sizes = await this.processImage(imageBuffer, filename);
      
      // Update user avatar in database
      const avatarUrl = `${this.baseUrl}/uploads/avatars/${sizes.large}`;
      await this.updateUserAvatar(userId, avatarUrl, filename);

      this.logger.log(`Generated ${type} avatar successfully for user ${userId}`);

      return {
        filename,
        url: avatarUrl,
        sizes: {
          small: `${this.baseUrl}/uploads/avatars/${sizes.small}`,
          medium: `${this.baseUrl}/uploads/avatars/${sizes.medium}`,
          large: `${this.baseUrl}/uploads/avatars/${sizes.large}`,
          original: `${this.baseUrl}/uploads/avatars/${sizes.original}`,
        },
      };
    } catch (error) {
      this.logger.error(`Error generating ${type} avatar for user ${userId}:`, error);
      throw error;
    }
  }

  private async validateFile(file: Express.Multer.File): Promise<void> {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File size exceeds limit of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Validate image dimensions (minimum 32x32)
    try {
      const metadata = await sharp(file.buffer).metadata();
      if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32) {
        throw new BadRequestException('Image must be at least 32x32 pixels');
      }
    } catch (error) {
      throw new BadRequestException('Invalid image file');
    }
  }

  private async processImage(buffer: Buffer, filename: string): Promise<{
    small: string;
    medium: string;
    large: string;
    original: string;
  }> {
    const baseName = path.parse(filename).name;
    const sizes = {
      small: `${baseName}_32x32.webp`,
      medium: `${baseName}_64x64.webp`,
      large: `${baseName}_128x128.webp`,
      original: `${baseName}_256x256.webp`,
    };

    // Process and save different sizes
    await Promise.all([
      sharp(buffer)
        .resize(32, 32, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(path.join(this.uploadPath, sizes.small)),
      
      sharp(buffer)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(path.join(this.uploadPath, sizes.medium)),
      
      sharp(buffer)
        .resize(128, 128, { fit: 'cover' })
        .webp({ quality: 90 })
        .toFile(path.join(this.uploadPath, sizes.large)),
      
      sharp(buffer)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 95 })
        .toFile(path.join(this.uploadPath, sizes.original)),
    ]);

    return sizes;
  }

  private async updateUserAvatar(userId: string, avatarUrl: string, filename: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          avatar: filename,
          avatarUrl: avatarUrl,
          updatedAt: new Date(),
        },
      }
    ).exec();
  }

  private async deleteAvatarFiles(filename: string): Promise<void> {
    const baseName = path.parse(filename).name;
    const filesToDelete = [
      `${baseName}_32x32.webp`,
      `${baseName}_64x64.webp`,
      `${baseName}_128x128.webp`,
      `${baseName}_256x256.webp`,
    ];

    await Promise.all(
      filesToDelete.map(async (file) => {
        try {
          await fs.unlink(path.join(this.uploadPath, file));
        } catch (error) {
          this.logger.warn(`Could not delete file ${file}: ${error.message}`);
        }
      })
    );
  }

  private async generateIdenticon(seed: string, options?: any): Promise<Buffer> {
    // Simple identicon generation using geometric patterns
    // In production, use a library like 'identicon.js' or 'jdenticon'
    const size = 256;
    const canvas = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    // This is a simplified implementation
    // In production, implement proper identicon generation
    return canvas;
  }

  private async generateInitialsAvatar(username: string, options?: any): Promise<Buffer> {
    const initials = username
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);

    const size = 256;
    const backgroundColor = options?.backgroundColor || '#007bff';
    const textColor = options?.textColor || '#ffffff';

    // Create SVG for initials
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" 
              fill="${textColor}" text-anchor="middle" dy="0.35em">${initials}</text>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async ensureUploadDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadPath}`);
    }
  }
}
