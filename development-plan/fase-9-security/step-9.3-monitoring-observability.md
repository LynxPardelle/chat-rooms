# Step 9.3: Monitoring and Observability

## Overview

Implement comprehensive monitoring, logging, and observability solutions to ensure system reliability, facilitate troubleshooting, and provide insights into application performance and user behavior.

## Observability Architecture

### 1. Logging Strategy

#### Structured Logging Implementation

```typescript
// src/logging/logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, transports, format } from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AppLogger implements LoggerService {
  private logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json(),
      format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          service: 'chat-rooms-api',
          environment: process.env.NODE_ENV,
          ...meta,
        });
      })
    ),
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        ),
      }),
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ],
  });

  // Add Elasticsearch transport in production
  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.ELASTICSEARCH_URL) {
      this.logger.add(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
          },
          index: 'chat-rooms-logs',
        })
      );
    }
  }

  log(message: string, context?: LogContext) {
    this.logger.info(message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.logger.error(message, { trace, ...context });
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, context);
  }

  verbose(message: string, context?: LogContext) {
    this.logger.verbose(message, context);
  }

  // Business-specific logging methods
  logUserAction(userId: string, action: string, details?: Record<string, any>) {
    this.log(`User action: ${action}`, {
      userId,
      operation: action,
      metadata: details,
    });
  }

  logSystemEvent(event: string, severity: 'low' | 'medium' | 'high', details?: Record<string, any>) {
    const logMethod = severity === 'high' ? this.error : severity === 'medium' ? this.warn : this.log;
    logMethod(`System event: ${event}`, {
      operation: 'system_event',
      metadata: { severity, ...details },
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context?: LogContext) {
    this.log(`Performance metric: ${metric} = ${value}${unit}`, {
      operation: 'performance_metric',
      metadata: { metric, value, unit },
      ...context,
    });
  }
}
```

#### Request Correlation and Tracing

```typescript
// src/middleware/correlation.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export const correlationStorage = new AsyncLocalStorage<Map<string, any>>();

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    const sessionId = req.headers['x-session-id'] as string;
    const userId = req.user?.id;

    const store = new Map();
    store.set('correlationId', correlationId);
    store.set('sessionId', sessionId);
    store.set('userId', userId);
    store.set('requestPath', req.path);
    store.set('requestMethod', req.method);

    res.setHeader('x-correlation-id', correlationId);

    correlationStorage.run(store, () => {
      next();
    });
  }
}

// Utility to get correlation context
export function getCorrelationContext(): Record<string, any> {
  const store = correlationStorage.getStore();
  if (!store) return {};

  return {
    correlationId: store.get('correlationId'),
    sessionId: store.get('sessionId'),
    userId: store.get('userId'),
    requestPath: store.get('requestPath'),
    requestMethod: store.get('requestMethod'),
  };
}
```

### 2. Metrics and Monitoring

#### Custom Metrics Service

```typescript
// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';

@Injectable()
export class MetricsService {
  // HTTP metrics
  private httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  });

  // WebSocket metrics
  private websocketConnections = new Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
    labelNames: ['type'],
  });

  private websocketMessages = new Counter({
    name: 'websocket_messages_total',
    help: 'Total number of WebSocket messages',
    labelNames: ['type', 'event'],
  });

  // Database metrics
  private databaseOperations = new Counter({
    name: 'database_operations_total',
    help: 'Total number of database operations',
    labelNames: ['operation', 'collection', 'status'],
  });

  private databaseOperationDuration = new Histogram({
    name: 'database_operation_duration_seconds',
    help: 'Duration of database operations in seconds',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  });

  // Business metrics
  private messagesProcessed = new Counter({
    name: 'messages_processed_total',
    help: 'Total number of messages processed',
    labelNames: ['channel_type', 'message_type'],
  });

  private fileUploads = new Counter({
    name: 'file_uploads_total',
    help: 'Total number of file uploads',
    labelNames: ['file_type', 'status'],
  });

  private userSessions = new Summary({
    name: 'user_session_duration_seconds',
    help: 'Duration of user sessions',
    labelNames: ['user_type'],
    maxAgeSeconds: 600,
    ageBuckets: 5,
  });

  // Record HTTP request metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
    this.httpRequestDuration.labels(method, route).observe(duration);
  }

  // Record WebSocket metrics
  recordWebSocketConnection(type: string, action: 'connect' | 'disconnect') {
    if (action === 'connect') {
      this.websocketConnections.labels(type).inc();
    } else {
      this.websocketConnections.labels(type).dec();
    }
  }

  recordWebSocketMessage(type: string, event: string) {
    this.websocketMessages.labels(type, event).inc();
  }

  // Record database metrics
  recordDatabaseOperation(operation: string, collection: string, status: string, duration: number) {
    this.databaseOperations.labels(operation, collection, status).inc();
    this.databaseOperationDuration.labels(operation, collection).observe(duration);
  }

  // Record business metrics
  recordMessage(channelType: string, messageType: string) {
    this.messagesProcessed.labels(channelType, messageType).inc();
  }

  recordFileUpload(fileType: string, status: string) {
    this.fileUploads.labels(fileType, status).inc();
  }

  recordUserSession(userType: string, duration: number) {
    this.userSessions.labels(userType).observe(duration);
  }

  // Get all metrics
  getMetrics(): string {
    return register.metrics();
  }
}
```

#### Health Check System

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrometheusController } from '@willsoto/nestjs-prometheus';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  dependencies: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    elasticsearch: 'up' | 'down';
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private metricsService: MetricsService
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
    ]);
  }

  @Get('detailed')
  async getDetailedHealth(): Promise<HealthStatus> {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      version: process.env.APP_VERSION || '1.0.0',
      dependencies: {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        elasticsearch: await this.checkElasticsearchHealth(),
      },
      metrics: {
        memoryUsage: memoryUsage.heapUsed,
        cpuUsage: await this.getCpuUsage(),
        activeConnections: await this.getActiveConnectionCount(),
      },
    };
  }

  private async checkDatabaseHealth(): Promise<'up' | 'down'> {
    try {
      // Implement database ping
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedisHealth(): Promise<'up' | 'down'> {
    try {
      // Implement Redis ping
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkElasticsearchHealth(): Promise<'up' | 'down'> {
    try {
      // Implement Elasticsearch ping
      return 'up';
    } catch {
      return 'down';
    }
  }
}
```

### 3. Distributed Tracing

#### OpenTelemetry Integration

```typescript
// src/tracing/tracer.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'chat-rooms-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Custom tracing utilities
export class TracingService {
  private tracer = trace.getTracer('chat-rooms-api');

  // Create a custom span
  async withSpan<T>(
    name: string,
    operation: (span: any) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes,
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () =>
        operation(span)
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Trace database operations
  async traceDbOperation<T>(
    operation: string,
    collection: string,
    query: any,
    executor: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `db.${collection}.${operation}`,
      async (span) => {
        span.setAttributes({
          'db.operation': operation,
          'db.collection.name': collection,
          'db.query': JSON.stringify(query),
        });
        return await executor();
      },
      {
        'db.system': 'mongodb',
      }
    );
  }

  // Trace external API calls
  async traceExternalCall<T>(
    service: string,
    endpoint: string,
    method: string,
    executor: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `external.${service}`,
      async (span) => {
        span.setAttributes({
          'http.method': method,
          'http.url': endpoint,
          'external.service': service,
        });
        return await executor();
      },
      {
        'span.kind': 'client',
      }
    );
  }
}
```

### 4. Alerting System

#### Alert Manager Configuration

```typescript
// src/alerting/alert-manager.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppLogger } from '../logging/logger.service';
import { MetricsService } from '../monitoring/metrics.service';

interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

interface AlertRule {
  name: string;
  condition: () => Promise<boolean>;
  severity: 'info' | 'warning' | 'critical';
  cooldown: number; // Minutes
  channels: AlertChannel[];
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook';
  config: Record<string, any>;
}

@Injectable()
export class AlertManager {
  private activeAlerts = new Map<string, Alert>();
  private alertCooldowns = new Map<string, Date>();

  constructor(
    private logger: AppLogger,
    private metricsService: MetricsService
  ) {}

  private alertRules: AlertRule[] = [
    {
      name: 'High Error Rate',
      condition: async () => {
        const errorRate = await this.getErrorRate();
        return errorRate > 0.05; // 5% error rate
      },
      severity: 'critical',
      cooldown: 5,
      channels: [
        { type: 'email', config: { recipients: ['admin@example.com'] } },
        { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK } },
      ],
    },
    {
      name: 'High Response Time',
      condition: async () => {
        const avgResponseTime = await this.getAverageResponseTime();
        return avgResponseTime > 1000; // 1 second
      },
      severity: 'warning',
      cooldown: 10,
      channels: [
        { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK } },
      ],
    },
    {
      name: 'Database Connection Issues',
      condition: async () => {
        return !(await this.isDatabaseHealthy());
      },
      severity: 'critical',
      cooldown: 2,
      channels: [
        { type: 'email', config: { recipients: ['admin@example.com'] } },
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK } },
      ],
    },
    {
      name: 'High Memory Usage',
      condition: async () => {
        const memoryUsage = process.memoryUsage();
        const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        return memoryPercent > 0.9; // 90% memory usage
      },
      severity: 'warning',
      cooldown: 15,
      channels: [
        { type: 'slack', config: { webhook: process.env.SLACK_WEBHOOK } },
      ],
    },
  ];

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAlerts() {
    for (const rule of this.alertRules) {
      try {
        if (await this.shouldCheckAlert(rule)) {
          const isTriggered = await rule.condition();
          
          if (isTriggered) {
            await this.triggerAlert(rule);
          } else {
            await this.resolveAlert(rule.name);
          }
        }
      } catch (error) {
        this.logger.error(`Error checking alert rule ${rule.name}`, error.stack, {
          operation: 'alert_check',
          rule: rule.name,
        });
      }
    }
  }

  private async shouldCheckAlert(rule: AlertRule): Promise<boolean> {
    const cooldownKey = rule.name;
    const lastCheck = this.alertCooldowns.get(cooldownKey);
    
    if (!lastCheck) return true;
    
    const cooldownMinutes = rule.cooldown;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    
    return Date.now() - lastCheck.getTime() > cooldownMs;
  }

  private async triggerAlert(rule: AlertRule) {
    const alertId = `${rule.name}-${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      name: rule.name,
      severity: rule.severity,
      message: `Alert triggered: ${rule.name}`,
      timestamp: new Date(),
      resolved: false,
    };

    this.activeAlerts.set(rule.name, alert);
    this.alertCooldowns.set(rule.name, new Date());

    // Send alert to configured channels
    for (const channel of rule.channels) {
      await this.sendAlert(alert, channel);
    }

    this.logger.logSystemEvent(`Alert triggered: ${rule.name}`, rule.severity, {
      alertId,
      rule: rule.name,
    });
  }

  private async resolveAlert(ruleName: string) {
    const alert = this.activeAlerts.get(ruleName);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.metadata = { resolvedAt: new Date() };

      this.logger.logSystemEvent(`Alert resolved: ${ruleName}`, 'low', {
        alertId: alert.id,
        duration: Date.now() - alert.timestamp.getTime(),
      });
    }
  }

  private async sendAlert(alert: Alert, channel: AlertChannel) {
    switch (channel.type) {
      case 'email':
        await this.sendEmailAlert(alert, channel.config);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, channel.config);
        break;
    }
  }

  private async sendEmailAlert(alert: Alert, config: any) {
    // Implement email sending logic
    this.logger.log(`Sending email alert for ${alert.name}`, {
      operation: 'send_alert',
      channel: 'email',
      alertId: alert.id,
    });
  }

  private async sendSlackAlert(alert: Alert, config: any) {
    // Implement Slack webhook logic
    this.logger.log(`Sending Slack alert for ${alert.name}`, {
      operation: 'send_alert',
      channel: 'slack',
      alertId: alert.id,
    });
  }

  private async sendWebhookAlert(alert: Alert, config: any) {
    // Implement webhook logic
    this.logger.log(`Sending webhook alert for ${alert.name}`, {
      operation: 'send_alert',
      channel: 'webhook',
      alertId: alert.id,
    });
  }

  // Helper methods for alert conditions
  private async getErrorRate(): Promise<number> {
    // Implementation to calculate error rate from metrics
    return 0.01; // Placeholder
  }

  private async getAverageResponseTime(): Promise<number> {
    // Implementation to get average response time
    return 200; // Placeholder
  }

  private async isDatabaseHealthy(): Promise<boolean> {
    // Implementation to check database health
    return true; // Placeholder
  }
}
```

### 5. Dashboard and Visualization

#### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Chat Rooms Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "websocket_connections_active",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          },
          {
            "expr": "rate(http_requests_total{status_code=~\"4..\"}[5m])",
            "legendFormat": "4xx errors"
          }
        ]
      }
    ]
  }
}
```

## Implementation Tasks

### Phase 1: Logging Infrastructure (Week 1)

- [ ] Implement structured logging service
- [ ] Set up correlation and tracing middleware
- [ ] Configure log aggregation (ELK stack)
- [ ] Create log analysis dashboards

### Phase 2: Metrics and Monitoring (Week 2)

- [ ] Implement custom metrics service
- [ ] Set up Prometheus metrics collection
- [ ] Create health check endpoints
- [ ] Configure monitoring dashboards

### Phase 3: Distributed Tracing (Week 3)

- [ ] Integrate OpenTelemetry tracing
- [ ] Set up Jaeger for trace visualization
- [ ] Implement custom tracing utilities
- [ ] Create trace analysis workflows

### Phase 4: Alerting and Automation (Week 4)

- [ ] Implement alert management system
- [ ] Configure alert rules and thresholds
- [ ] Set up notification channels
- [ ] Create incident response automation

## Success Criteria

1. **Observability Coverage**: 100% of critical paths instrumented with logging and tracing
2. **Alert Response Time**: Critical alerts triggered within 1 minute of issue detection
3. **Mean Time to Resolution**: Average incident resolution time under 30 minutes
4. **Dashboard Accuracy**: Real-time dashboards with less than 5-second data lag
5. **Log Retention**: Centralized logging with 30-day retention for analysis
6. **Trace Completeness**: End-to-end request tracing across all services

## Monitoring Checklist

- [ ] Application performance metrics collected
- [ ] Error tracking and alerting configured
- [ ] Log aggregation and analysis setup
- [ ] Distributed tracing implemented
- [ ] Health checks and status pages created
- [ ] Alert management and escalation procedures
- [ ] Dashboard and visualization tools configured
- [ ] Incident response procedures documented

This comprehensive monitoring and observability implementation ensures complete visibility into system health, performance, and user experience while enabling rapid incident detection and resolution.
