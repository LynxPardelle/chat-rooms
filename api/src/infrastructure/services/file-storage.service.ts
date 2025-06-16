import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { 
  FileUploadOptions, 
  FileUploadResult,
  FileErrorCode,
  FileProcessingMetadata,
  ProcessingStatus,
  ThumbnailResult,
  ThumbnailSize,
  FileAnalytics,
  ProcessingQuality,
  FileOperationError,
  StorageProvider
} from '../../domain/types/file-storage.types';
import { 
  ImageProcessingConfig,
  ImageFormat,
  ThumbnailConfiguration,
  ResizeMode,
  CropStrategy,
  CompressionLevel
} from '../../domain/types/image-processing.types';
import { IFileStorageService, UploadedFile } from '../../domain/interfaces';

@Injectable()
export class FileStorageService implements IFileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadDir: string;
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;
  private readonly storageProvider: StorageProvider;
  private readonly imageProcessingConfig: ImageProcessingConfig;
  
  constructor(private readonly configService: ConfigService) {
    // Initialize from configuration
    this.uploadDir = this.configService.get('FILE_UPLOAD_DIR') || join(process.cwd(), 'uploads');
    this.allowedMimeTypes = this.configService.get('ALLOWED_MIME_TYPES')?.split(',') || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'
    ];
    this.maxFileSize = this.configService.get('MAX_FILE_SIZE') || 5 * 1024 * 1024; // 5MB default
    this.storageProvider = this.configService.get('STORAGE_PROVIDER') || StorageProvider.LOCAL;
      // Default image processing configuration
    this.imageProcessingConfig = {
      enableOptimization: true,
      enableThumbnails: true,
      enableFormatConversion: true,
      enableWatermark: false,
      enableMetadataExtraction: true,
      enableAutoCrop: false,      qualitySettings: {
        jpeg: 85,
        webp: 85,
        avif: 85,
        png: CompressionLevel.MEDIUM,
        preserveTransparency: true,
        preserveExif: false,
        preserveColorProfile: false,
      },
      thumbnailSizes: [
        { 
          name: 'small',
          size: ThumbnailSize.SMALL, 
          width: 100, 
          height: 100,
          format: ImageFormat.WEBP,
          quality: 80,
          resizeMode: ResizeMode.COVER,
          cropStrategy: CropStrategy.CENTER
        },
        { 
          name: 'medium',
          size: ThumbnailSize.MEDIUM, 
          width: 300, 
          height: 300,
          format: ImageFormat.WEBP,
          quality: 80,
          resizeMode: ResizeMode.COVER,
          cropStrategy: CropStrategy.CENTER
        },
        { 
          name: 'large',
          size: ThumbnailSize.LARGE, 
          width: 600, 
          height: 600,
          format: ImageFormat.WEBP,
          quality: 80,
          resizeMode: ResizeMode.COVER,
          cropStrategy: CropStrategy.CENTER
        }
      ],
      formatPriority: [ImageFormat.WEBP, ImageFormat.JPEG],      compressionSettings: {
        algorithm: 'webp-lossy' as any,
        level: CompressionLevel.MEDIUM,
        progressive: true,        optimizeForWeb: true,
        stripMetadata: true,
        preserveQuality: false,
      },
    };
    
    // Ensure upload directory exists
    this.ensureUploadDirectoryExists();
  }
  
  private async ensureUploadDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Upload directory created/confirmed at: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`, error.stack);
      throw new Error(`Failed to create upload directory: ${error.message}`);
    }
  }
    async uploadFile(
    file: UploadedFile,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    this.logger.debug(`Starting upload process for file: ${file.originalname}`);
      // Validate file
    const validationError = await this.validateFile(file);
    if (validationError) {
      return {
        success: false,
        fileId: '',
        url: '',
        thumbnails: [],
        metadata: {} as FileProcessingMetadata,
        processingStatus: ProcessingStatus.FAILED,
        error: validationError
      };
    }
    
    // Generate a unique file ID
    const fileId = uuidv4();
    
    // Calculate checksum for deduplication and integrity
    const checksum = await this.calculateChecksum(file.buffer);
    
    // Determine file extension and generate safe filename
    const extension = extname(file.originalname).toLowerCase();
    const safeFilename = `${fileId}${extension}`;
    const filePath = join(this.uploadDir, safeFilename);
    
    // Process metadata
    const metadata = await this.processFileMetadata(file);
    
    // Save the file
    await this.saveFile(file.buffer, filePath);
      // Process image if it's an image file
    const thumbnails: ThumbnailResult[] = [];
    if (file.mimetype.startsWith('image/')) {
      thumbnails.push(...await this.generateImageThumbnails(filePath, fileId));
    }
      // Return upload result
    return {
      success: true,
      fileId,
      url: this.generateFileUrl(safeFilename),
      thumbnails,
      metadata,
      processingStatus: ProcessingStatus.READY
    };
  }
    async validateFile(file: UploadedFile): Promise<FileOperationError | null> {
    // Check file size
    if (file.size > this.maxFileSize) {
      this.logger.warn(`File too large: ${file.originalname} (${file.size} bytes)`);      return {
        code: FileErrorCode.FILE_TOO_LARGE,
        message: `File exceeds maximum size of ${this.maxFileSize} bytes`,
        retryable: false,
        timestamp: new Date()
      };
    }
    
    // Check mime type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      this.logger.warn(`Invalid file type: ${file.mimetype} for file ${file.originalname}`);      return {
        code: FileErrorCode.INVALID_FILE_TYPE,
        message: `File type ${file.mimetype} not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
        retryable: false,
        timestamp: new Date()
      };
    }

    return null;
  }
  
  private async calculateChecksum(buffer: Buffer): Promise<string> {
    return createHash('sha256').update(buffer).digest('hex');
  }
  
  private async saveFile(buffer: Buffer, filePath: string): Promise<void> {
    try {
      await fs.writeFile(filePath, buffer);
      this.logger.debug(`File saved successfully to: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to save file: ${error.message}`, error.stack);
      throw {
        code: FileErrorCode.STORAGE_ERROR,
        message: `Failed to save file: ${error.message}`
      };
    }
  }
    private async processFileMetadata(file: UploadedFile): Promise<FileProcessingMetadata> {
    const startTime = Date.now();
    
    const metadata: FileProcessingMetadata = {
      uploadedAt: new Date().toISOString(),
      originalSize: file.size,
      processedSize: file.size,
      compressionRatio: 1.0,
      processingTime: 0,
      operations: [{
        type: 'optimize',
        parameters: { originalSize: file.size },
        executionTime: 0,
        result: 'success'
      }],
      quality: ProcessingQuality.HIGH,
      processingDetails: {
        steps: [],
        totalTime: 0,
        errors: []
      }
    };
    
    // If it's an image, extract additional metadata (mock implementation without sharp)
    if (file.mimetype.startsWith('image/')) {
      try {
        // Mock image info extraction
        metadata.dimensions = {
          width: 1920, // Default values since we don't have sharp
          height: 1080
        };
        metadata.imageMetadata = {
          format: file.mimetype.split('/')[1],
          colorSpace: 'srgb',
          hasAlpha: file.mimetype.includes('png'),
          density: 72
        };
        
        // Add processing step
        metadata.processingDetails.steps.push({
          type: 'format-convert',
          parameters: { format: file.mimetype },
          executionTime: Date.now() - startTime,
          result: 'success'
        });
      } catch (error) {
        this.logger.warn(`Failed to extract image metadata: ${error.message}`, error.stack);
        metadata.processingDetails.steps.push({
          type: 'format-convert',
          parameters: { error: error.message },
          executionTime: Date.now() - startTime,
          result: 'failed',
          error: error.message
        });
        metadata.processingDetails.errors.push(error.message);
      }
    }
    
    metadata.processingTime = Date.now() - startTime;
    metadata.processingDetails.totalTime = metadata.processingTime;
    
    return metadata;
  }
    private async generateImageThumbnails(filePath: string, fileId: string): Promise<ThumbnailResult[]> {
    const thumbnails: ThumbnailResult[] = [];
    const thumbnailDir = join(this.uploadDir, 'thumbnails');
    
    // Ensure thumbnail directory exists
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    // Generate thumbnails for different sizes (mock implementation without sharp)
    for (const size of this.imageProcessingConfig.thumbnailSizes) {
      try {
        const thumbnailFilename = `${fileId}_${size.name}.webp`;
        const thumbnailPath = join(thumbnailDir, thumbnailFilename);
        
        // Mock thumbnail generation - in a real implementation, this would use sharp
        // For now, just copy the original file as a placeholder
        const originalBuffer = await fs.readFile(filePath);
        await fs.writeFile(thumbnailPath, originalBuffer);
        
        thumbnails.push({
          size: size.size,
          width: size.width,
          height: size.height,
          url: this.generateFileUrl(`thumbnails/${thumbnailFilename}`),
          format: 'webp',
          sizeBytes: originalBuffer.length
        });
        
        this.logger.debug(`Generated thumbnail: ${size.name} for file ${fileId}`);
      } catch (error) {
        this.logger.error(`Failed to generate ${size.name} thumbnail: ${error.message}`, error.stack);
      }
    }
    
    return thumbnails;
  }
  
  private generateFileUrl(filename: string): string {
    const baseUrl = this.configService.get('FILE_BASE_URL') || `http://localhost:3001/media`;
    return `${baseUrl}/${filename}`;
  }
  
  async getFileById(fileId: string): Promise<Buffer> {
    try {
      const files = await fs.readdir(this.uploadDir);
      const file = files.find(f => f.startsWith(fileId));
      
      if (!file) {
        throw {
          code: FileErrorCode.FILE_NOT_FOUND,
          message: `File with ID ${fileId} not found`
        };
      }
      
      const filePath = join(this.uploadDir, file);
      return fs.readFile(filePath);
    } catch (error) {
      if (error.code === FileErrorCode.FILE_NOT_FOUND) {
        throw error;
      }
      
      this.logger.error(`Failed to retrieve file: ${error.message}`, error.stack);
      throw {
        code: FileErrorCode.RETRIEVAL_ERROR,
        message: `Failed to retrieve file: ${error.message}`
      };
    }
  }
  
  async getThumbnail(fileId: string, size: ThumbnailSize): Promise<Buffer> {
    try {
      const thumbnailPath = join(this.uploadDir, 'thumbnails', `${fileId}_${size}.webp`);
      return fs.readFile(thumbnailPath);
    } catch (error) {
      this.logger.error(`Failed to retrieve thumbnail: ${error.message}`, error.stack);
      throw {
        code: FileErrorCode.THUMBNAIL_NOT_FOUND,
        message: `Thumbnail not found for file ${fileId} with size ${size}`
      };
    }
  }
  
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      // Find the main file
      const files = await fs.readdir(this.uploadDir);
      const file = files.find(f => f.startsWith(fileId));
      
      if (!file) {
        throw {
          code: FileErrorCode.FILE_NOT_FOUND,
          message: `File with ID ${fileId} not found`
        };
      }
      
      // Delete the main file
      await fs.unlink(join(this.uploadDir, file));
      
      // Delete thumbnails if they exist
      const thumbnailDir = join(this.uploadDir, 'thumbnails');
      try {
        const thumbnails = await fs.readdir(thumbnailDir);
        for (const thumbnail of thumbnails) {
          if (thumbnail.startsWith(fileId)) {
            await fs.unlink(join(thumbnailDir, thumbnail));
          }
        }
      } catch (err) {
        // Thumbnails directory might not exist, that's fine
        this.logger.debug(`No thumbnails found for file ${fileId}`);
      }
        this.logger.log(`File deleted successfully: ${fileId}`);
      return true;
    } catch (error) {
      if (error.code === FileErrorCode.FILE_NOT_FOUND) {
        return false;
      }
      
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw {
        code: FileErrorCode.DELETION_ERROR,
        message: `Failed to delete file: ${error.message}`
      };
    }
  }

  async downloadFile(fileId: string, userId: string): Promise<Buffer> {
    try {
      // Find the file
      const files = await fs.readdir(this.uploadDir);
      const file = files.find(f => f.startsWith(fileId));
      
      if (!file) {
        throw {
          code: FileErrorCode.FILE_NOT_FOUND,
          message: `File with ID ${fileId} not found`
        };
      }
      
      const filePath = join(this.uploadDir, file);
      return await fs.readFile(filePath);
    } catch (error) {
      this.logger.error(`Failed to download file: ${error.message}`, error.stack);
      throw {
        code: FileErrorCode.RETRIEVAL_ERROR,
        message: `Failed to download file: ${error.message}`
      };
    }
  }

  async getFileUrl(fileId: string, expiresIn?: number): Promise<string> {
    return this.generateFileUrl(fileId);
  }

  async getSignedUrl(fileId: string, expiresIn: number): Promise<string> {
    // For local storage, just return the regular URL
    // In production, this would generate a signed URL for cloud storage
    return this.generateFileUrl(fileId);
  }

  async generateThumbnails(
    fileId: string, 
    sizes: ThumbnailSize[]
  ): Promise<ThumbnailResult[]> {
    const thumbnails: ThumbnailResult[] = [];
    
    // Find the original file
    const files = await fs.readdir(this.uploadDir);
    const file = files.find(f => f.startsWith(fileId));
    
    if (!file) {
      throw {
        code: FileErrorCode.FILE_NOT_FOUND,
        message: `File with ID ${fileId} not found`
      };
    }
    
    const filePath = join(this.uploadDir, file);
    
    // Generate thumbnails for requested sizes
    for (const size of sizes) {
      const sizeConfig = this.imageProcessingConfig.thumbnailSizes.find(s => s.size === size);
      if (sizeConfig) {
        const thumbnail = await this.generateSingleThumbnail(filePath, fileId, sizeConfig);
        thumbnails.push(thumbnail);
      }
    }
    
    return thumbnails;
  }

  async getStorageStats(): Promise<FileAnalytics> {
    // Mock implementation - in production this would query actual analytics
    return {
      uploadCount: 0,
      totalSize: 0,
      averageSize: 0,
      topMimeTypes: [],
      uploadTrends: [],
      errorRates: [],
      performanceMetrics: {
        averageUploadTime: 0,
        averageProcessingTime: 0,
        throughputMbps: 0,
        successRate: 100,
        p95UploadTime: 0,
        p99UploadTime: 0
      }
    };
  }

  async cleanupOrphanedFiles(): Promise<number> {
    // Mock implementation - in production this would clean up orphaned files
    return 0;
  }

  private async generateSingleThumbnail(
    filePath: string, 
    fileId: string, 
    config: ThumbnailConfiguration
  ): Promise<ThumbnailResult> {
    const thumbnailDir = join(this.uploadDir, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    const thumbnailFilename = `${fileId}_${config.name}.webp`;
    const thumbnailPath = join(thumbnailDir, thumbnailFilename);
    
    // Mock thumbnail generation - copy original for now
    const originalBuffer = await fs.readFile(filePath);
    await fs.writeFile(thumbnailPath, originalBuffer);
    
    return {
      size: config.size,
      width: config.width,
      height: config.height,
      url: this.generateFileUrl(`thumbnails/${thumbnailFilename}`),
      format: 'webp',
      sizeBytes: originalBuffer.length
    };
  }
}
