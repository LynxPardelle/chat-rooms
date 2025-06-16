import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ThumbnailSize, ImageFormat } from '../../domain/types/image-processing.types';
import { StorageProvider, VirusScanStatus } from '../../domain/types/file-storage.types';

export class FileUploadDto {
  @IsString()
  filename: string;

  @IsOptional()
  @IsString()
  originalName?: string;
}

export class ImageUploadDto extends FileUploadDto {
  @IsOptional()
  @IsArray()
  @IsEnum(ThumbnailSize, { each: true })
  thumbnailSizes?: ThumbnailSize[];
}

export class FileProcessingDto {
  @IsString()
  fileId: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ThumbnailSize, { each: true })
  thumbnails?: ThumbnailSize[];
}

export class FileSearchDto {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsEnum(StorageProvider)
  provider?: StorageProvider;

  @IsOptional()
  @IsEnum(VirusScanStatus)
  virusStatus?: VirusScanStatus;
}

export class FileBulkOperationDto {
  @IsArray()
  @IsString({ each: true })
  fileIds: string[];
}

export class FileAnalyticsDto {
  @IsOptional()
  @IsString()
  metric?: string;
}
