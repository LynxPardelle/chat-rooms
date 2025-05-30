import {
  onCLS,
  onLCP,
  onTTFB,
  onFCP,
  onINP
} from 'web-vitals';

/**
 * Interface for performance metric data
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string | undefined;
  entries: PerformanceEntry[];
}

/**
 * Core Web Vitals thresholds according to Google's standards
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint (ms)
  FID: { good: 100, poor: 300 },   // First Input Delay (ms)
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift (score)
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte (ms)
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint (ms)
  INP: { good: 200, poor: 500 }    // Interaction to Next Paint (ms)
};

/**
 * Service for monitoring and reporting Core Web Vitals metrics
 */
export class PerformanceMonitoringService {
  private static metricsLog: Record<string, PerformanceMetric[]> = {
    LCP: [],
    FID: [],
    CLS: [],
    TTFB: [],
    FCP: [],
    INP: []
  };

  private static callback: ((metric: PerformanceMetric) => void) | null = null;
  /**
   * Start monitoring Core Web Vitals metrics
   * @param reportCallback Optional callback to receive metrics as they're measured
   */
  static startMonitoring(reportCallback?: (metric: PerformanceMetric) => void): void {
    if (reportCallback) {
      this.callback = reportCallback;
    }    // Initialize metrics collection
    onCLS(this.handleMetric.bind(this));
    onLCP(this.handleMetric.bind(this));
    onTTFB(this.handleMetric.bind(this));
    onFCP(this.handleMetric.bind(this));
    onINP?.(this.handleMetric.bind(this));

    console.log('Performance monitoring started for Core Web Vitals');
  }

  /**
   * Handle incoming metrics and store them
   */
  private static handleMetric(metric: PerformanceMetric): void {
    const metricName = metric.name.toUpperCase();
    
    // Store the metric
    if (this.metricsLog[metricName]) {
      this.metricsLog[metricName].push(metric);
    }
    
    // Report via callback if available
    if (this.callback) {
      this.callback(metric);
    }
    
    // Report to console during development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Web Vital] ${metricName}:`, Math.round(metric.value), `(${metric.rating})`);
    }
  }

  /**
   * Get the latest values for all monitored metrics
   */
  static getLatestMetrics(): Record<string, PerformanceMetric | null> {
    const latest: Record<string, PerformanceMetric | null> = {};
    
    Object.keys(this.metricsLog).forEach(metricName => {
      const metrics = this.metricsLog[metricName];
      latest[metricName] = metrics.length > 0 ? metrics[metrics.length - 1] : null;
    });
    
    return latest;
  }

  /**
   * Get all collected metrics of a specific type
   * @param metricName The metric name (LCP, FID, CLS, etc.)
   */
  static getMetricHistory(metricName: string): PerformanceMetric[] {
    return this.metricsLog[metricName.toUpperCase()] || [];
  }

  /**
   * Check if all Core Web Vitals pass Google's "good" thresholds
   */
  static allVitalsGood(): boolean {
    const latest = this.getLatestMetrics();
    return (
      latest.LCP?.rating === 'good' &&
      latest.FID?.rating === 'good' &&
      latest.CLS?.rating === 'good'
    );
  }

  /**
   * Generate a summary report of all Core Web Vitals
   */
  static generateReport(): {
    metrics: Record<string, { value: number | null, rating: string | null }>,
    allGood: boolean,
    timestamp: string
  } {
    const latest = this.getLatestMetrics();
    const report = {
      metrics: {} as Record<string, { value: number | null, rating: string | null }>,
      allGood: this.allVitalsGood(),
      timestamp: new Date().toISOString()
    };

    Object.keys(latest).forEach(key => {
      const metric = latest[key];
      report.metrics[key] = {
        value: metric ? Math.round(metric.value * 100) / 100 : null,
        rating: metric ? metric.rating : null
      };
    });

    return report;
  }

  /**
   * Clear all collected metrics
   */
  static clearMetrics(): void {
    Object.keys(this.metricsLog).forEach(key => {
      this.metricsLog[key] = [];
    });
  }
}
