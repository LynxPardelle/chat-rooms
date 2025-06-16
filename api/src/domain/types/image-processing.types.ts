// Image processing types for advanced media handling
import { Timestamp } from './index';

// Image processing configuration
export type ImageProcessingConfig = {
  enableOptimization: boolean;
  enableThumbnails: boolean;
  enableFormatConversion: boolean;
  enableWatermark: boolean;
  enableMetadataExtraction: boolean;
  enableAutoCrop: boolean;
  qualitySettings: QualitySettings;
  thumbnailSizes: ThumbnailConfiguration[];
  formatPriority: ImageFormat[];
  compressionSettings: CompressionSettings;
};

export type QualitySettings = {
  jpeg: number; // 1-100
  webp: number; // 1-100
  avif: number; // 1-100
  png: CompressionLevel;
  preserveTransparency: boolean;
  preserveExif: boolean;
  preserveColorProfile: boolean;
};

export enum CompressionLevel {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 8,
  MAXIMUM = 9,
}

export type ThumbnailConfiguration = {
  name: string;
  size: ThumbnailSize;
  width: number;
  height: number;
  format: ImageFormat;
  quality: number;
  resizeMode: ResizeMode;
  cropStrategy: CropStrategy;
};

export enum ThumbnailSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  XLARGE = 'xlarge',
}

export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  GIF = 'gif',
  SVG = 'svg',
}

export enum ResizeMode {
  FIT = 'fit',           // Resize to fit within dimensions
  FILL = 'fill',         // Resize to fill dimensions (may crop)
  STRETCH = 'stretch',   // Stretch to exact dimensions
  COVER = 'cover',       // Cover entire area (maintain aspect ratio)
  CONTAIN = 'contain',   // Contain within area (maintain aspect ratio)
}

export enum CropStrategy {
  CENTER = 'center',
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
  SMART = 'smart',       // AI-based cropping
  FACE = 'face',         // Face-detection cropping
  ATTENTION = 'attention', // Content-aware cropping
}

export type CompressionSettings = {
  algorithm: CompressionAlgorithm;
  level: CompressionLevel;
  progressive: boolean;
  optimizeForWeb: boolean;
  stripMetadata: boolean;
  preserveQuality: boolean;
};

export enum CompressionAlgorithm {
  MOZJPEG = 'mozjpeg',
  LIBJPEG = 'libjpeg',
  OXIPNG = 'oxipng',
  PNGQUANT = 'pngquant',
  WEBP_LOSSLESS = 'webp-lossless',
  WEBP_LOSSY = 'webp-lossy',
}

// Image analysis and metadata
export type ImageAnalysis = {
  dimensions: ImageDimensions;
  format: ImageFormat;
  colorSpace: ColorSpace;
  hasTransparency: boolean;
  dominantColors: ColorPalette;
  faces: FaceDetection[];
  objects: ObjectDetection[];
  textContent: TextDetection[];
  quality: ImageQualityMetrics;
  exifData: ExifData;
};

export type ImageDimensions = {
  width: number;
  height: number;
  aspectRatio: number;
  megapixels: number;
};

export enum ColorSpace {
  SRGB = 'sRGB',
  ADOBE_RGB = 'Adobe RGB',
  DISPLAY_P3 = 'Display P3',
  CMYK = 'CMYK',
  GRAYSCALE = 'Grayscale',
}

export type ColorPalette = {
  primary: ColorInfo;
  secondary: ColorInfo;
  accent: ColorInfo;
  background: ColorInfo;
  palette: ColorInfo[];
};

export type ColorInfo = {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  prominence: number; // 0-1
};

export type RGB = {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
};

export type HSL = {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
};

export type FaceDetection = {
  boundingBox: BoundingBox;
  confidence: number;
  landmarks?: FaceLandmarks;
  emotions?: EmotionScores;
  age?: number;
  gender?: 'male' | 'female';
};

export type ObjectDetection = {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
  category: ObjectCategory;
};

export type TextDetection = {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  language?: string;
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FaceLandmarks = {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  leftMouth: Point;
  rightMouth: Point;
};

export type Point = {
  x: number;
  y: number;
};

export type EmotionScores = {
  happiness: number;
  sadness: number;
  anger: number;
  surprise: number;
  fear: number;
  disgust: number;
  neutral: number;
};

export enum ObjectCategory {
  PERSON = 'person',
  ANIMAL = 'animal',
  VEHICLE = 'vehicle',
  OBJECT = 'object',
  FOOD = 'food',
  NATURE = 'nature',
  BUILDING = 'building',
  TECHNOLOGY = 'technology',
}

export type ImageQualityMetrics = {
  sharpness: number;      // 0-100
  brightness: number;     // 0-100
  contrast: number;       // 0-100
  saturation: number;     // 0-100
  exposure: number;       // -100 to 100
  highlights: number;     // 0-100
  shadows: number;        // 0-100
  noise: number;          // 0-100
  blur: number;           // 0-100
  overallScore: number;   // 0-100
};

export type ExifData = {
  camera?: CameraInfo;
  lens?: LensInfo;
  settings?: CameraSettings;
  location?: LocationInfo;
  datetime?: DateTimeInfo;
  software?: string;
  copyright?: string;
  artist?: string;
  description?: string;
};

export type CameraInfo = {
  make?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
};

export type LensInfo = {
  make?: string;
  model?: string;
  focalLength?: number;
  maxAperture?: number;
  serialNumber?: string;
};

export type CameraSettings = {
  aperture?: number;       // f-stop
  shutterSpeed?: string;   // e.g., "1/125"
  iso?: number;
  exposureTime?: number;   // seconds
  exposureMode?: string;
  meteringMode?: string;
  flash?: boolean;
  whiteBalance?: string;
  focusMode?: string;
};

export type LocationInfo = {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  direction?: number;
  country?: string;
  city?: string;
  region?: string;
};

export type DateTimeInfo = {
  original?: Timestamp;
  digitized?: Timestamp;
  modified?: Timestamp;
  timezone?: string;
};

// Processing operations
export type ProcessingOperation = {
  type: ProcessingOperationType;
  parameters: ProcessingParameters;
  order: number;
  condition?: ProcessingCondition;
};

export enum ProcessingOperationType {
  RESIZE = 'resize',
  CROP = 'crop',
  ROTATE = 'rotate',
  FLIP = 'flip',
  BRIGHTNESS = 'brightness',
  CONTRAST = 'contrast',
  SATURATION = 'saturation',
  SHARPEN = 'sharpen',
  BLUR = 'blur',
  NOISE_REDUCTION = 'noise_reduction',
  COLOR_CORRECTION = 'color_correction',
  WATERMARK = 'watermark',
  FORMAT_CONVERT = 'format_convert',
  COMPRESS = 'compress',
  OPTIMIZE = 'optimize',
}

export type ProcessingParameters = Record<string, any>;

export type ProcessingCondition = {
  field: 'width' | 'height' | 'size' | 'format' | 'quality';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'in' | 'not_in';
  value: any;
};

// Processing results
export type ProcessingResult = {
  success: boolean;
  inputMetadata: ImageAnalysis;
  outputMetadata: ImageAnalysis;
  operations: ProcessingOperationResult[];
  performance: ProcessingPerformance;
  warnings: ProcessingWarning[];
  error?: ProcessingError;
};

export type ProcessingOperationResult = {
  operation: ProcessingOperationType;
  success: boolean;
  executionTime: number;
  inputSize: number;
  outputSize: number;
  qualityScore?: number;
  error?: string;
};

export type ProcessingPerformance = {
  totalTime: number;
  memoryUsed: number;
  cpuUsage: number;
  throughput: number; // MB/s
};

export type ProcessingWarning = {
  code: string;
  message: string;
  operation?: ProcessingOperationType;
  severity: 'low' | 'medium' | 'high';
};

export type ProcessingError = {
  code: string;
  message: string;
  operation?: ProcessingOperationType;
  stack?: string;
  retryable: boolean;
};
