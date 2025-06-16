// Domain interfaces - Repository contracts
import { User, Message, Room, Attachment, EntityId } from '../entities';
import { 
  FileStorageTypes, 
  ImageProcessingTypes 
} from '../types';

// Export repository interfaces
export * from './message-repository.interface';
export * from './thread-repository.interface';
export * from './reaction-repository.interface';
export * from './mention-service.interface';

// File upload type (to avoid Express.Multer.File dependency in domain)
export type UploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename?: string;
};

// Pagination types
export type PaginationOptions = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Search options
export type SearchOptions = {
  query: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: EntityId;
  roomId?: EntityId;
} & PaginationOptions;

// Repository interfaces following hexagonal architecture
export interface IUserRepository {
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  findById(id: EntityId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(id: EntityId, user: Partial<User>): Promise<User | null>;
  delete(id: EntityId): Promise<boolean>;
  findOnlineUsers(roomId?: EntityId): Promise<User[]>;
  updateStatus(
    id: EntityId,
    status: User['status'],
    isOnline: boolean,
  ): Promise<boolean>;
}

export interface IMessageRepository {
  create(
    message: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Message>;
  findById(id: EntityId): Promise<Message | null>;
  findByRoomId(
    roomId: EntityId,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Message>>;
  update(id: EntityId, message: Partial<Message>): Promise<Message | null>;
  delete(id: EntityId): Promise<boolean>;
  search(options: SearchOptions): Promise<PaginatedResult<Message>>;
  findRecentMessages(roomId: EntityId, limit?: number): Promise<Message[]>;
}

export interface IRoomRepository {
  create(room: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<Room>;
  findById(id: EntityId): Promise<Room | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<Room>>;
  update(id: EntityId, room: Partial<Room>): Promise<Room | null>;
  delete(id: EntityId): Promise<boolean>;
  addUser(roomId: EntityId, userId: EntityId): Promise<boolean>;
  removeUser(roomId: EntityId, userId: EntityId): Promise<boolean>;
  getUserRooms(userId: EntityId): Promise<Room[]>;
}

export interface IAttachmentRepository {
  create(
    attachment: Omit<Attachment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Attachment>;
  findById(id: EntityId): Promise<Attachment | null>;
  findByFileId(fileId: string): Promise<Attachment | null>;
  findByMessageId(messageId: EntityId): Promise<Attachment[]>;
  findByUserId(
    userId: EntityId,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Attachment>>;
  findByChecksum(checksum: string): Promise<Attachment | null>;
  update(id: EntityId, attachment: Partial<Attachment>): Promise<Attachment | null>;
  delete(id: EntityId): Promise<boolean>;
  findOrphanedAttachments(olderThan: Date): Promise<Attachment[]>;
  getStorageAnalytics(): Promise<FileStorageTypes.FileAnalytics>;
  updateAccessLog(id: EntityId, access: any): Promise<boolean>;
}

// Enhanced Service interfaces
export interface IFileStorageService {
  uploadFile(
    file: UploadedFile, 
    options: FileStorageTypes.FileUploadOptions
  ): Promise<FileStorageTypes.FileUploadResult>;
  downloadFile(fileId: string, userId: EntityId): Promise<Buffer>;
  deleteFile(fileId: string): Promise<boolean>;
  getFileUrl(fileId: string, expiresIn?: number): Promise<string>;
  getSignedUrl(fileId: string, expiresIn: number): Promise<string>;
  generateThumbnails(
    fileId: string, 
    sizes: FileStorageTypes.ThumbnailSize[]
  ): Promise<FileStorageTypes.ThumbnailResult[]>;
  validateFile(file: UploadedFile): Promise<FileStorageTypes.FileOperationError | null>;
  getStorageStats(): Promise<FileStorageTypes.FileAnalytics>;
  cleanupOrphanedFiles(): Promise<number>;
}

export interface IImageProcessingService {
  processImage(
    file: UploadedFile,
    config: ImageProcessingTypes.ImageProcessingConfig
  ): Promise<ImageProcessingTypes.ProcessingResult>;
  analyzeImage(file: UploadedFile): Promise<ImageProcessingTypes.ImageAnalysis>;
  optimizeImage(
    file: UploadedFile,
    quality: number
  ): Promise<Buffer>;
  generateThumbnail(
    file: UploadedFile,
    config: ImageProcessingTypes.ThumbnailConfiguration
  ): Promise<Buffer>;
  validateImageType(mimeType: string): boolean;
  extractMetadata(file: UploadedFile): Promise<ImageProcessingTypes.ExifData>;
  detectFaces(file: UploadedFile): Promise<ImageProcessingTypes.FaceDetection[]>;
  detectObjects(file: UploadedFile): Promise<ImageProcessingTypes.ObjectDetection[]>;
  applyWatermark(
    file: UploadedFile,
    watermark: FileStorageTypes.WatermarkConfig
  ): Promise<Buffer>;
}

export interface IVirusScanService {
  scanFile(file: UploadedFile): Promise<FileStorageTypes.VirusScanStatus>;
  scanBuffer(buffer: Buffer, filename: string): Promise<FileStorageTypes.VirusScanStatus>;
  isFileClean(scanResult: FileStorageTypes.VirusScanStatus): boolean;
  quarantineFile(fileId: string, reason: string): Promise<boolean>;
  getQuarantinedFiles(): Promise<Attachment[]>;
}

export interface IFileAnalyticsService {
  trackUpload(attachment: Attachment, metadata: FileStorageTypes.UploadMetadata): Promise<void>;
  trackDownload(fileId: string, userId: EntityId): Promise<void>;
  trackProcessing(fileId: string, result: ImageProcessingTypes.ProcessingResult): Promise<void>;
  getUsageMetrics(timeframe: 'day' | 'week' | 'month'): Promise<FileStorageTypes.FileAnalytics>;
  getUserStorageUsage(userId: EntityId): Promise<{
    totalFiles: number;
    totalSize: number;
    quotaUsed: number;
    quotaRemaining: number;
  }>;
  getPopularFiles(limit: number): Promise<Attachment[]>;
  generateReport(type: 'usage' | 'security' | 'performance'): Promise<any>;
}
