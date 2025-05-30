# Step 9.2: Performance Optimization and Monitoring

## Overview

Implement comprehensive performance optimization strategies and real-time monitoring systems to ensure the chat application maintains optimal performance under various load conditions.

## Performance Optimization Strategy

### 1. Backend Performance Optimization

#### Database Query Optimization

```typescript
// src/database/optimizations/query-optimizer.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class QueryOptimizer {
  constructor(
    @InjectModel('Message') private messageModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>
  ) {}

  // Optimized message retrieval with proper indexing
  async getChannelMessages(channelId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    return await this.messageModel
      .find({ channelId })
      .sort({ createdAt: -1 }) // Index on channelId + createdAt
      .skip(skip)
      .limit(limit)
      .populate('author', 'name avatar')
      .lean() // Return plain objects for better performance
      .exec();
  }

  // Optimized user search with text indexing
  async searchUsers(query: string, limit: number = 20) {
    return await this.userModel
      .find({
        $text: { $search: query }
      }, {
        score: { $meta: 'textScore' }
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .select('name email avatar status')
      .lean()
      .exec();
  }

  // Batch operations for bulk updates
  async updateMultipleUserStatuses(updates: Array<{userId: string, status: string}>) {
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update.userId },
        update: { status: update.status, lastSeen: new Date() }
      }
    }));

    return await this.userModel.bulkWrite(bulkOps);
  }
}
```

#### Caching Strategy Implementation

```typescript
// src/cache/cache-manager.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CacheManager {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  // Multi-level caching strategy
  async getWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Try L1 cache (Redis)
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from source
    const data = await fetcher();
    
    // Store in cache
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Smart cache warming
  async warmCache(keys: Array<{key: string, fetcher: () => Promise<any>, ttl: number}>) {
    const promises = keys.map(async ({ key, fetcher, ttl }) => {
      const exists = await this.redis.exists(key);
      if (!exists) {
        const data = await fetcher();
        await this.redis.setex(key, ttl, JSON.stringify(data));
      }
    });

    await Promise.all(promises);
  }
}
```

#### API Response Optimization

```typescript
// src/interceptors/compression.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as zlib from 'zlib';

@Injectable()
export class CompressionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    return next.handle().pipe(
      map((data) => {
        // Apply compression for large responses
        if (this.shouldCompress(request, data)) {
          response.setHeader('Content-Encoding', 'gzip');
          return this.compressData(data);
        }
        return data;
      })
    );
  }

  private shouldCompress(request: any, data: any): boolean {
    const acceptsGzip = request.headers['accept-encoding']?.includes('gzip');
    const dataSize = JSON.stringify(data).length;
    return acceptsGzip && dataSize > 1024; // Compress if > 1KB
  }

  private compressData(data: any): Buffer {
    const jsonString = JSON.stringify(data);
    return zlib.gzipSync(jsonString);
  }
}
```

### 2. Frontend Performance Optimization

#### React Component Optimization

```typescript
// src/components/optimized/VirtualizedMessageList.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Message } from '../types/message';

interface VirtualizedMessageListProps {
  messages: Message[];
  height: number;
  onLoadMore: () => void;
}

const MessageItem = memo<{ index: number; style: any; data: Message[] }>(
  ({ index, style, data }) => {
    const message = data[index];
    
    return (
      <div style={style} className="message-item">
        <div className="message-author">{message.author.name}</div>
        <div className="message-content">{message.content}</div>
        <div className="message-time">{message.createdAt}</div>
      </div>
    );
  }
);

export const VirtualizedMessageList = memo<VirtualizedMessageListProps>(
  ({ messages, height, onLoadMore }) => {
    const itemData = useMemo(() => messages, [messages]);
    
    const onItemsRendered = useCallback(
      ({ visibleStartIndex }: any) => {
        if (visibleStartIndex < 10) {
          onLoadMore();
        }
      },
      [onLoadMore]
    );

    return (
      <List
        height={height}
        itemCount={messages.length}
        itemSize={80}
        itemData={itemData}
        onItemsRendered={onItemsRendered}
      >
        {MessageItem}
      </List>
    );
  }
);
```

#### State Management Optimization

```typescript
// src/store/optimized-chat-store.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Message, Channel } from '../types';

interface ChatState {
  channels: Map<string, Channel>;
  messages: Map<string, Message[]>;
  activeChannelId: string | null;
  
  // Actions
  addMessage: (channelId: string, message: Message) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  updateMessage: (channelId: string, messageId: string, updates: Partial<Message>) => void;
  setActiveChannel: (channelId: string) => void;
}

export const useChatStore = create<ChatState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      channels: new Map(),
      messages: new Map(),
      activeChannelId: null,

      addMessage: (channelId, message) =>
        set((state) => {
          const channelMessages = state.messages.get(channelId) || [];
          channelMessages.unshift(message); // Add to beginning for chronological order
          state.messages.set(channelId, channelMessages);
        }),

      setMessages: (channelId, messages) =>
        set((state) => {
          state.messages.set(channelId, messages);
        }),

      updateMessage: (channelId, messageId, updates) =>
        set((state) => {
          const channelMessages = state.messages.get(channelId);
          if (channelMessages) {
            const messageIndex = channelMessages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
              Object.assign(channelMessages[messageIndex], updates);
            }
          }
        }),

      setActiveChannel: (channelId) =>
        set((state) => {
          state.activeChannelId = channelId;
        }),
    }))
  )
);

// Optimized selectors
export const useActiveChannelMessages = () =>
  useChatStore((state) => {
    if (!state.activeChannelId) return [];
    return state.messages.get(state.activeChannelId) || [];
  });
```

#### Bundle Optimization

```typescript
// vite.config.performance.ts
import { defineConfig } from 'vite';
import { splitVendorChunkPlugin } from 'vite';

export default defineConfig({
  plugins: [
    splitVendorChunkPlugin(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom'],
          
          // Router and state management
          'app-core': ['react-router-dom', 'zustand'],
          
          // UI libraries
          'ui-vendor': ['@headlessui/react', 'framer-motion'],
          
          // Date and utility libraries
          'utils': ['date-fns', 'lodash-es'],
          
          // Chart and visualization
          'charts': ['recharts', 'd3'],
        },
      },
    },
    
    // Optimize for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    
    // Enable source maps in production for debugging
    sourcemap: true,
  },
  
  // Optimize dev server
  server: {
    fs: {
      strict: true,
    },
  },
});
```

### 3. Real-time Monitoring Implementation

#### Application Performance Monitoring

```typescript
// src/monitoring/performance-monitor.ts
import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class PerformanceMonitor {
  constructor(
    @InjectMetric('http_requests_total') public httpRequestsTotal: Counter<string>,
    @InjectMetric('http_request_duration') public httpRequestDuration: Histogram<string>,
    @InjectMetric('websocket_connections') public websocketConnections: Gauge<string>,
    @InjectMetric('database_query_duration') public dbQueryDuration: Histogram<string>
  ) {}

  // Track HTTP request metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestsTotal
      .labels({ method, route, status_code: statusCode.toString() })
      .inc();
      
    this.httpRequestDuration
      .labels({ method, route })
      .observe(duration);
  }

  // Track WebSocket metrics
  recordWebSocketConnection(action: 'connect' | 'disconnect') {
    if (action === 'connect') {
      this.websocketConnections.inc();
    } else {
      this.websocketConnections.dec();
    }
  }

  // Track database performance
  recordDatabaseQuery(operation: string, collection: string, duration: number) {
    this.dbQueryDuration
      .labels({ operation, collection })
      .observe(duration);
  }

  // Custom business metrics
  recordMessageSent(channelType: string) {
    const messagesSent = register.getSingleMetric('messages_sent_total') as Counter<string>;
    if (messagesSent) {
      messagesSent.labels({ channel_type: channelType }).inc();
    }
  }

  recordFileUpload(fileType: string, sizeBytes: number) {
    const fileUploads = register.getSingleMetric('file_uploads_total') as Counter<string>;
    const fileSizes = register.getSingleMetric('file_upload_bytes') as Histogram<string>;
    
    if (fileUploads) {
      fileUploads.labels({ file_type: fileType }).inc();
    }
    
    if (fileSizes) {
      fileSizes.labels({ file_type: fileType }).observe(sizeBytes);
    }
  }
}
```

#### Real-time Error Tracking

```typescript
// src/monitoring/error-tracker.ts
import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class ErrorTracker {
  private readonly logger = new Logger(ErrorTracker.name);

  constructor() {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }

  // Track application errors
  captureError(error: Error, context?: Record<string, any>) {
    this.logger.error(error.message, error.stack);
    
    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext('additional_info', context);
      }
      Sentry.captureException(error);
    });
  }

  // Track performance issues
  capturePerformanceIssue(operation: string, duration: number, threshold: number) {
    if (duration > threshold) {
      const message = `Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`;
      
      Sentry.withScope((scope) => {
        scope.setTag('performance_issue', true);
        scope.setContext('performance', {
          operation,
          duration,
          threshold,
        });
        Sentry.captureMessage(message, 'warning');
      });
    }
  }

  // Track user interactions
  captureUserAction(userId: string, action: string, metadata?: Record<string, any>) {
    Sentry.addBreadcrumb({
      message: `User ${userId} performed ${action}`,
      category: 'user_action',
      data: metadata,
      level: 'info',
    });
  }
}
```

### 4. Performance Analytics Dashboard

#### Metrics Collection Service

```typescript
// src/analytics/metrics-collector.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface PerformanceMetric {
  timestamp: Date;
  metricType: string;
  value: number;
  labels: Record<string, string>;
}

@Injectable()
export class MetricsCollector {
  constructor(
    @InjectRepository(PerformanceMetric)
    private metricsRepository: Repository<PerformanceMetric>
  ) {}

  // Collect system metrics every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemMetrics() {
    const metrics = [
      await this.getCpuUsage(),
      await this.getMemoryUsage(),
      await this.getDiskUsage(),
      await this.getNetworkStats(),
    ];

    await this.metricsRepository.save(metrics);
  }

  // Collect application metrics every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectApplicationMetrics() {
    const metrics = [
      await this.getActiveUserCount(),
      await this.getMessageThroughput(),
      await this.getErrorRate(),
      await this.getResponseTimes(),
    ];

    await this.metricsRepository.save(metrics);
  }

  private async getCpuUsage(): Promise<PerformanceMetric> {
    const usage = process.cpuUsage();
    const cpuPercent = (usage.user + usage.system) / 1000000; // Convert to seconds
    
    return {
      timestamp: new Date(),
      metricType: 'cpu_usage',
      value: cpuPercent,
      labels: { unit: 'percent' },
    };
  }

  private async getMemoryUsage(): Promise<PerformanceMetric> {
    const usage = process.memoryUsage();
    
    return {
      timestamp: new Date(),
      metricType: 'memory_usage',
      value: usage.heapUsed,
      labels: { unit: 'bytes', type: 'heap' },
    };
  }

  private async getActiveUserCount(): Promise<PerformanceMetric> {
    // Implementation would query active WebSocket connections
    const activeUsers = await this.getConnectedUsersCount();
    
    return {
      timestamp: new Date(),
      metricType: 'active_users',
      value: activeUsers,
      labels: { type: 'websocket_connections' },
    };
  }

  private async getMessageThroughput(): Promise<PerformanceMetric> {
    // Calculate messages per minute
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    const messageCount = await this.getMessageCountSince(oneMinuteAgo);
    
    return {
      timestamp: new Date(),
      metricType: 'message_throughput',
      value: messageCount,
      labels: { unit: 'per_minute' },
    };
  }
}
```

#### Performance Dashboard API

```typescript
// src/analytics/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Analytics')
@Controller('analytics/performance')
export class PerformanceDashboardController {
  constructor(
    private readonly metricsCollector: MetricsCollector,
    private readonly performanceMonitor: PerformanceMonitor
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get performance overview' })
  async getPerformanceOverview() {
    return {
      systemHealth: await this.getSystemHealth(),
      applicationMetrics: await this.getApplicationMetrics(),
      alerts: await this.getActiveAlerts(),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get historical metrics' })
  async getMetrics(
    @Query('type') type: string,
    @Query('from') from: string,
    @Query('to') to: string
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    return await this.metricsCollector.getMetricsInRange(type, fromDate, toDate);
  }

  @Get('real-time')
  @ApiOperation({ summary: 'Get real-time performance data' })
  async getRealTimeMetrics() {
    return {
      timestamp: new Date(),
      cpu: await this.getCurrentCpuUsage(),
      memory: await this.getCurrentMemoryUsage(),
      activeConnections: await this.getActiveConnectionCount(),
      throughput: await this.getCurrentThroughput(),
    };
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get performance alerts' })
  async getPerformanceAlerts() {
    return await this.getActivePerformanceAlerts();
  }
}
```

## Implementation Tasks

### Phase 1: Backend Optimization (Week 1)

- [ ] Implement database query optimization
- [ ] Set up multi-level caching strategy
- [ ] Create API response compression
- [ ] Optimize WebSocket performance

### Phase 2: Frontend Optimization (Week 2)

- [ ] Implement component virtualization
- [ ] Optimize state management
- [ ] Configure bundle splitting
- [ ] Add performance monitoring hooks

### Phase 3: Monitoring Infrastructure (Week 3)

- [ ] Set up application performance monitoring
- [ ] Implement error tracking
- [ ] Create metrics collection system
- [ ] Build performance dashboard

### Phase 4: Analytics and Alerting (Week 4)

- [ ] Create performance analytics
- [ ] Set up automated alerting
- [ ] Implement performance regression detection
- [ ] Create optimization recommendations

## Success Criteria

1. **Response Times**: API responses under 200ms for 95% of requests
2. **Page Load Speed**: Initial page load under 2 seconds
3. **Real-time Performance**: WebSocket message delivery under 50ms
4. **Memory Efficiency**: Memory usage growth under 10% per hour
5. **Error Rate**: Application error rate under 0.1%
6. **Throughput**: Support 1000+ concurrent users with stable performance

## Performance Benchmarks

- **Database Queries**: Average response time under 50ms
- **Cache Hit Rate**: Over 80% for frequently accessed data
- **Bundle Size**: Total JavaScript bundle under 500KB gzipped
- **CPU Usage**: Average CPU utilization under 60%
- **Memory Usage**: Heap size growth under 50MB per hour
- **Network**: API payload sizes optimized to under 100KB per request

This comprehensive performance optimization and monitoring strategy ensures the chat application maintains excellent performance while providing visibility into system health and user experience.
