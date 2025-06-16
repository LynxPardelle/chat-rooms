import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as sharp from 'sharp';
import { spawn } from 'child_process';
import { promisify } from 'util';

export interface FileSecurityValidation {
  isValid: boolean;
  violations: string[];
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  quarantined?: boolean;
}

export interface FileMetadata {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  magicNumber: string;
  isEncrypted: boolean;
  scanResults?: VirusScanResult;
}

export interface VirusScanResult {
  isClean: boolean;
  threats: string[];
  scanEngine: string;
  scanTime: Date;
  signature: string;
}

@Injectable()
export class FileSecurityService {
  private readonly logger = new Logger(FileSecurityService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;
  private readonly dangerousExtensions: Set<string>;
  private readonly quarantinePath: string;
  private readonly encryptionKey: Buffer;

  // Magic number signatures for common file types
  private readonly magicNumbers = new Map<string, string[]>([
    ['image/jpeg', ['FFD8FF']],
    ['image/png', ['89504E47']],
    ['image/gif', ['474946']],
    ['image/webp', ['52494646']],
    ['application/pdf', ['25504446']],
    ['text/plain', ['']],
    ['application/zip', ['504B0304']],
    ['application/x-rar', ['526172211A0700']],
    ['video/mp4', ['00000020667479706D703432', '66747970']],
    ['audio/mpeg', ['494433', 'FFFB']],
  ]);

  constructor(private configService: ConfigService) {
    this.maxFileSize = this.configService.get<number>('file.maxSize', 10 * 1024 * 1024); // 10MB default
    this.allowedMimeTypes = new Set(this.configService.get<string[]>('file.allowedMimeTypes', [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'application/pdf',
    ]));
    this.dangerousExtensions = new Set([
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'ws', 'wsf',
      'msc', 'msi', 'msp', 'dll', 'application', 'gadget', 'hta', 'cpl', 'inf',
      'ins', 'isp', 'u3p', 'isu', 'job', 'jse', 'ksh', 'lnk', 'mde', 'mdt',
      'mdw', 'mdz', 'msh', 'msh1', 'msh2', 'mshxml', 'msh1xml', 'msh2xml',
      'ps1', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2', 'reg', 'scf', 'sh',
    ]);
    this.quarantinePath = this.configService.get<string>('file.quarantinePath', './quarantine');
    this.encryptionKey = Buffer.from(
      this.configService.get<string>('file.encryptionKey', crypto.randomBytes(32).toString('hex')),
      'hex'
    );
    this.ensureQuarantineDirectory();
  }

  async validateFile(
    filePath: string,
    filename: string,
    mimeType?: string
  ): Promise<FileSecurityValidation> {
    const violations: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let quarantined = false;

    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      
      // Size validation
      if (stats.size > this.maxFileSize) {
        violations.push(`File size (${stats.size} bytes) exceeds maximum allowed (${this.maxFileSize} bytes)`);
        riskLevel = 'MEDIUM';
      }

      // Extension validation
      const extension = path.extname(filename).toLowerCase().slice(1);
      if (this.dangerousExtensions.has(extension)) {
        violations.push(`Dangerous file extension detected: .${extension}`);
        riskLevel = 'CRITICAL';
        quarantined = true;
      }

      // Magic number validation
      const magicNumber = await this.getMagicNumber(filePath);
      const mimeValidation = this.validateMimeType(magicNumber, mimeType, extension);
      if (!mimeValidation.isValid) {
        violations.push(...mimeValidation.violations);
        riskLevel = 'HIGH';
      }

      // MIME type validation
      if (mimeType && !this.allowedMimeTypes.has(mimeType)) {
        violations.push(`MIME type not allowed: ${mimeType}`);
        riskLevel = 'MEDIUM';
      }

      // Virus scanning
      const scanResult = await this.scanForMalware(filePath);
      if (!scanResult.isClean) {
        violations.push(`Malware detected: ${scanResult.threats.join(', ')}`);
        riskLevel = 'CRITICAL';
        quarantined = true;
      }

      // Content validation for images
      if (mimeType?.startsWith('image/')) {
        const imageValidation = await this.validateImageSecurity(filePath);
        if (!imageValidation.isValid) {
          violations.push(...imageValidation.violations);
          if (riskLevel === 'LOW' || riskLevel === 'MEDIUM') {
            riskLevel = 'MEDIUM';
          }
        }
      }

      // Quarantine if necessary
      if (quarantined) {
        await this.quarantineFile(filePath, filename, violations);
      }

      // Generate recommendations
      if (violations.length === 0) {
        recommendations.push('File passed all security checks');
      } else {
        recommendations.push('Consider rejecting this file upload');
        if (riskLevel === 'CRITICAL') {
          recommendations.push('File has been quarantined automatically');
        }
      }

      return {
        isValid: violations.length === 0,
        violations,
        recommendations,
        riskLevel,
        quarantined,
      };
    } catch (error) {
      this.logger.error(`File validation error for ${filename}:`, error);
      return {
        isValid: false,
        violations: [`File validation failed: ${error.message}`],
        recommendations: ['Reject file upload due to validation error'],
        riskLevel: 'HIGH',
      };
    }
  }

  async processSecureUpload(
    filePath: string,
    filename: string,
    mimeType: string
  ): Promise<FileMetadata> {
    const validation = await this.validateFile(filePath, filename, mimeType);
    
    if (!validation.isValid || validation.quarantined) {
      throw new Error(`File upload rejected: ${validation.violations.join(', ')}`);
    }

    // Generate file hash
    const hash = await this.generateFileHash(filePath);
    
    // Get magic number
    const magicNumber = await this.getMagicNumber(filePath);
    
    // Process image if applicable
    if (mimeType.startsWith('image/')) {
      await this.processImageSecurity(filePath);
    }

    // Encrypt file
    const encryptedPath = await this.encryptFile(filePath);
    
    // Get file stats
    const stats = await fs.stat(encryptedPath);

    return {
      filename: path.basename(encryptedPath),
      originalName: filename,
      mimeType,
      size: stats.size,
      hash,
      magicNumber,
      isEncrypted: true,
    };
  }

  private async getMagicNumber(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      const magicBytes = buffer.slice(0, 16);
      return magicBytes.toString('hex').toUpperCase();
    } catch (error) {
      this.logger.error(`Failed to read magic number from ${filePath}:`, error);
      return '';
    }
  }

  private validateMimeType(
    magicNumber: string,
    declaredMimeType?: string,
    extension?: string
  ): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check if magic number matches any known file type
    let detectedMimeType: string | null = null;
    for (const [mimeType, signatures] of this.magicNumbers.entries()) {
      for (const signature of signatures) {
        if (signature && magicNumber.startsWith(signature)) {
          detectedMimeType = mimeType;
          break;
        }
      }
      if (detectedMimeType) break;
    }

    // Validate declared MIME type against magic number
    if (declaredMimeType && detectedMimeType && declaredMimeType !== detectedMimeType) {
      violations.push(
        `MIME type mismatch: declared ${declaredMimeType}, detected ${detectedMimeType}`
      );
    }

    // Validate file extension against MIME type
    if (declaredMimeType && extension) {
      const expectedExtensions = this.getExpectedExtensions(declaredMimeType);
      if (expectedExtensions.length > 0 && !expectedExtensions.includes(extension)) {
        violations.push(
          `Extension mismatch: .${extension} not expected for MIME type ${declaredMimeType}`
        );
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private getExpectedExtensions(mimeType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'text/plain': ['txt'],
      'application/pdf': ['pdf'],
      'application/zip': ['zip'],
      'video/mp4': ['mp4'],
      'audio/mpeg': ['mp3'],
    };
    return extensionMap[mimeType] || [];
  }

  private async scanForMalware(filePath: string): Promise<VirusScanResult> {
    try {
      // Check if ClamAV is available
      const clamAvailable = await this.isClamAvailable();
      
      if (clamAvailable) {
        return await this.scanWithClamAV(filePath);
      } else {
        // Fallback to basic signature-based detection
        return await this.basicMalwareDetection(filePath);
      }
    } catch (error) {
      this.logger.warn(`Malware scanning failed for ${filePath}:`, error);
      return {
        isClean: false,
        threats: ['Scan failed - treating as suspicious'],
        scanEngine: 'error',
        scanTime: new Date(),
        signature: 'unknown',
      };
    }
  }

  private async isClamAvailable(): Promise<boolean> {
    try {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const child = spawn('clamscan', ['--version']);
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
      });
    } catch {
      return false;
    }
  }

  private async scanWithClamAV(filePath: string): Promise<VirusScanResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('clamscan', ['--no-summary', '--infected', filePath]);
      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        const threats: string[] = [];
        
        // Parse ClamAV output
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('FOUND')) {
            const match = line.match(/: (.+) FOUND/);
            if (match) {
              threats.push(match[1]);
            }
          }
        }

        resolve({
          isClean: code === 0 && threats.length === 0,
          threats,
          scanEngine: 'ClamAV',
          scanTime: new Date(),
          signature: crypto.createHash('sha256').update(output).digest('hex').slice(0, 16),
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async basicMalwareDetection(filePath: string): Promise<VirusScanResult> {
    const buffer = await fs.readFile(filePath);
    const content = buffer.toString('hex').toUpperCase();
    const threats: string[] = [];

    // Basic signature detection for common malware patterns
    const malwareSignatures = [
      { pattern: '4D5A', name: 'Potential PE executable' },
      { pattern: '504B0304', name: 'ZIP archive - requires deeper inspection' },
      { pattern: '377ABCAF271C', name: 'Potential 7-Zip archive' },
      // Add more signatures as needed
    ];

    for (const signature of malwareSignatures) {
      if (content.includes(signature.pattern)) {
        threats.push(signature.name);
      }
    }

    return {
      isClean: threats.length === 0,
      threats,
      scanEngine: 'Basic signature detection',
      scanTime: new Date(),
      signature: crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16),
    };
  }

  private async validateImageSecurity(filePath: string): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    try {
      const metadata = await sharp(filePath).metadata();
      
      // Check image dimensions
      const maxDimension = 4096; // 4K max
      if (metadata.width && metadata.width > maxDimension) {
        violations.push(`Image width (${metadata.width}) exceeds maximum (${maxDimension})`);
      }
      if (metadata.height && metadata.height > maxDimension) {
        violations.push(`Image height (${metadata.height}) exceeds maximum (${maxDimension})`);
      }

      // Check for suspicious metadata
      if (metadata.exif || metadata.icc || metadata.iptc || metadata.xmp) {
        violations.push('Image contains metadata that will be stripped for security');
      }

      // Validate image format
      const allowedFormats = ['jpeg', 'png', 'gif', 'webp'];
      if (metadata.format && !allowedFormats.includes(metadata.format)) {
        violations.push(`Unsupported image format: ${metadata.format}`);
      }

    } catch (error) {
      violations.push(`Image validation failed: ${error.message}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private async processImageSecurity(filePath: string): Promise<void> {
    try {      // Strip metadata and process image securely
      const processedImage = sharp(filePath)
        .withMetadata({}) // Remove all metadata
        .jpeg({ quality: 85, progressive: true }) // Standardize format
        .png({ compressionLevel: 6 })
        .gif()
        .webp({ quality: 85 });

      const outputPath = `${filePath}.processed`;
      await processedImage.toFile(outputPath);
      
      // Replace original with processed version
      await fs.rename(outputPath, filePath);
      
      this.logger.log(`Image processed and metadata stripped: ${filePath}`);
    } catch (error) {
      this.logger.error(`Image processing failed for ${filePath}:`, error);
      throw error;
    }
  }

  private async generateFileHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  private async encryptFile(filePath: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);
    
    const inputBuffer = await fs.readFile(filePath);
    const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    const encryptedWithAuth = Buffer.concat([iv, authTag, encrypted]);
    
    const encryptedPath = `${filePath}.encrypted`;
    await fs.writeFile(encryptedPath, encryptedWithAuth);
    
    // Remove original file
    await fs.unlink(filePath);
    
    return encryptedPath;
  }
  async decryptFile(encryptedPath: string, outputPath: string): Promise<void> {
    const algorithm = 'aes-256-gcm';
    const encryptedBuffer = await fs.readFile(encryptedPath);
    
    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(16, 32);
    const encrypted = encryptedBuffer.slice(32);
    
    const decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    await fs.writeFile(outputPath, decrypted);
  }

  private async quarantineFile(filePath: string, filename: string, violations: string[]): Promise<void> {
    const quarantineFilename = `${Date.now()}_${filename}`;
    const quarantinePath = path.join(this.quarantinePath, quarantineFilename);
    
    try {
      await fs.copyFile(filePath, quarantinePath);
      
      // Create quarantine metadata
      const metadata = {
        originalPath: filePath,
        originalFilename: filename,
        quarantineTime: new Date().toISOString(),
        violations,
        hash: await this.generateFileHash(filePath),
      };
      
      await fs.writeFile(
        `${quarantinePath}.metadata.json`,
        JSON.stringify(metadata, null, 2)
      );
      
      this.logger.warn(`File quarantined: ${filename} -> ${quarantineFilename}`);
    } catch (error) {
      this.logger.error(`Failed to quarantine file ${filename}:`, error);
    }
  }

  private async ensureQuarantineDirectory(): Promise<void> {
    try {
      await fs.access(this.quarantinePath);
    } catch {
      await fs.mkdir(this.quarantinePath, { recursive: true });
      this.logger.log(`Created quarantine directory: ${this.quarantinePath}`);
    }
  }
  async getQuarantinedFiles(): Promise<Array<{
    originalPath: string;
    originalFilename: string;
    quarantineTime: string;
    violations: string[];
    hash: string;
  }>> {
    try {
      const files = await fs.readdir(this.quarantinePath);
      const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
      
      const quarantinedFiles: Array<{
        originalPath: string;
        originalFilename: string;
        quarantineTime: string;
        violations: string[];
        hash: string;
      }> = [];
      
      for (const metadataFile of metadataFiles) {
        const metadataPath = path.join(this.quarantinePath, metadataFile);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        quarantinedFiles.push(metadata);
      }
      
      return quarantinedFiles;
    } catch (error) {
      this.logger.error('Failed to get quarantined files:', error);
      return [];
    }
  }

  async cleanupQuarantine(olderThanDays: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.quarantinePath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      for (const file of files) {
        const filePath = path.join(this.quarantinePath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          this.logger.log(`Cleaned up quarantined file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup quarantine:', error);
    }
  }
}
