import imageCompression from 'browser-image-compression';

export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  quality?: number;
  preserveExif?: boolean;
  convertToWebp?: boolean;
}

export interface OptimizedImage {
  file: File;
  url: string;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
  compressionRatio: number;
  placeholder?: string; // Base64 placeholder image for blur-up effect
  srcset?: string;      // For responsive images
  sizes?: string;       // For responsive images
}

// Responsive breakpoints for different device sizes
export const RESPONSIVE_BREAKPOINTS = [320, 480, 640, 768, 960, 1280, 1920];

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxSizeMB: 0.5, // 500KB max file size
  maxWidthOrHeight: 1200, // Max dimension
  useWebWorker: true, // Use Web Worker for better UI performance
  fileType: 'image/webp', // Convert to WebP when possible
  quality: 0.8, // 80% quality
  preserveExif: false, // Strip metadata
  convertToWebp: true // Try to convert to WebP if supported
};

export class ImageOptimizationService {
  /**
   * Compresses an image file before upload
   * @param file Original image file
   * @param customOptions Override default options
   * @returns Promise with compressed file result
   */
  static async compressImage(file: File, customOptions?: ImageOptimizationOptions): Promise<OptimizedImage> {
    try {
      // Check WebP support and adjust options accordingly
      const webpSupported = await this.checkWebpSupport();
      const options = { 
        ...DEFAULT_OPTIONS, 
        ...customOptions 
      };
      
      // Only use WebP if supported and conversion is requested
      if (!webpSupported || options.convertToWebp === false) {
        options.fileType = file.type; // Use original file type as fallback
      }
      
      // Original file info
      const originalSize = file.size / 1024 / 1024; // in MB
      
      // Process image with browser-image-compression
      const compressedFile = await imageCompression(file, options);
      
      // Get dimensions
      const dimensions = await this.getImageDimensions(compressedFile);
      
      // Calculate compressed size in MB
      const compressedSize = compressedFile.size / 1024 / 1024;
      
      // Create object URL for preview
      const previewUrl = URL.createObjectURL(compressedFile);
      
      return {
        file: compressedFile,
        url: previewUrl,
        originalSize,
        optimizedSize: compressedSize,
        width: dimensions.width,
        height: dimensions.height,
        compressionRatio: originalSize / compressedSize
      };    } catch (error) {
      console.error('Image compression failed:', error);
      throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Creates multiple resized versions of an image for responsive usage
   * @param file Image file to resize
   * @returns Promise with array of resized images for different viewports
   */
  static async createResponsiveVersions(file: File): Promise<OptimizedImage[]> {
    // Use our responsive breakpoints for better coverage
    const sizes = RESPONSIVE_BREAKPOINTS;
    const results: OptimizedImage[] = [];
    
    // Check WebP support first
    const webpSupported = await this.checkWebpSupport();
    
    for (const size of sizes) {
      const options = {
        ...DEFAULT_OPTIONS,
        maxWidthOrHeight: size,
        maxSizeMB: size < 768 ? 0.2 : 0.5, // Smaller file size for mobile
        convertToWebp: webpSupported
      };
      
      try {
        const result = await this.compressImage(file, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to create ${size}px version:`, error);
        // Continue with other sizes even if one fails
      }
    }
    
    return results;
  }
  
  /**
   * Creates a low-quality placeholder for blur-up loading technique
   * @param file Image file
   * @returns Promise with tiny placeholder image with base64 data
   */
  static async createPlaceholder(file: File): Promise<OptimizedImage> {
    const placeholderOptions = {
      maxSizeMB: 0.01, // 10KB max for placeholder
      maxWidthOrHeight: 64, // Tiny dimension
      useWebWorker: true,
      fileType: 'image/webp',
      quality: 0.3, // Low quality for placeholder
      convertToWebp: await this.checkWebpSupport()
    };
    
    const compressed = await this.compressImage(file, placeholderOptions);
    
    // Convert to base64 for inline use in blur-up technique
    const base64 = await this.fileToBase64(compressed.file);
    
    return {
      ...compressed,
      placeholder: base64
    };
  }
  
  /**
   * Generates an optimal srcset attribute for responsive images
   * @param images Array of optimized images at different sizes
   * @returns srcset string for use in <img> or <source> elements
   */
  static generateSrcset(images: OptimizedImage[]): string {
    return images
      .map(image => `${image.url} ${image.width}w`)
      .join(', ');
  }
  
  /**
   * Generates sizes attribute for responsive images
   * @param defaultSize Default size as fallback
   * @returns sizes string for use in <img> or <source> elements
   */
  static generateSizes(defaultSize = '100vw'): string {
    return [
      '(max-width: 480px) 100vw',
      '(max-width: 768px) 75vw',
      '(max-width: 1280px) 50vw',
      defaultSize
    ].join(', ');
  }
  
  /**
   * Creates a complete responsive image set with srcset, sizes, and placeholder
   * @param file Original image file
   * @returns Promise with optimized image containing all responsive data
   */
  static async createResponsiveImage(file: File): Promise<OptimizedImage> {
    const [responsiveVersions, placeholder] = await Promise.all([
      this.createResponsiveVersions(file),
      this.createPlaceholder(file)
    ]);
    
    const srcset = this.generateSrcset(responsiveVersions);
    const sizes = this.generateSizes();
    
    // Return the largest version as the main image, with responsive data
    const mainImage = responsiveVersions.reduce(
      (largest, current) => current.width > largest.width ? current : largest,
      responsiveVersions[0]
    );
    
    return {
      ...mainImage,
      placeholder: placeholder.placeholder,
      srcset,
      sizes
    };
  }
  
  /**
   * Gets the dimensions of an image file
   * @param file Image file
   * @returns Promise with width and height
   */
  private static getImageDimensions(file: File): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
        URL.revokeObjectURL(img.src); // Clean up
      };
      img.onerror = () => reject(new Error('Failed to load image for dimension calculation'));
      img.src = URL.createObjectURL(file);
    });
  }
  
  /**
   * Converts a file to base64 string for data URLs
   * @param file File to convert
   * @returns Promise with base64 string
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
  
  /**
   * Checks if WebP is supported in current browser
   * @returns Promise resolving to boolean indicating WebP support
   */
  static checkWebpSupport(): Promise<boolean> {
    return new Promise(resolve => {
      const webp = new Image();
      webp.onload = () => resolve(webp.height === 1);
      webp.onerror = () => resolve(false);
      webp.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    });
  }
  
  /**
   * Selects the optimal image size based on device width and pixel ratio
   * @param deviceWidth Current device width
   * @param pixelRatio Device pixel ratio (defaults to window.devicePixelRatio)
   * @returns Optimal image width to use
   */
  static getOptimalImageSize(deviceWidth: number, pixelRatio = window.devicePixelRatio || 1): number {
    // Account for device pixel ratio for crisp images
    const targetWidth = deviceWidth * pixelRatio;
    
    // Find the smallest breakpoint that is larger than our target
    for (const breakpoint of RESPONSIVE_BREAKPOINTS) {
      if (breakpoint >= targetWidth) {
        return breakpoint;
      }
    }
    
    // If device is larger than our largest breakpoint, use the largest
    return RESPONSIVE_BREAKPOINTS[RESPONSIVE_BREAKPOINTS.length - 1];
  }
  
  /**
   * Releases all object URLs created by this service to prevent memory leaks
   * @param urls Array of object URLs to release
   */
  static releaseObjectUrls(urls: string[]): void {
    urls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }
}
