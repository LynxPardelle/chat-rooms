# Step 7.2: Sistema de Analytics y Métricas

## Objetivos

- Implementar sistema de analytics en tiempo real
- Crear dashboard de métricas de chat y usuarios
- Desarrollar sistema de reportes automatizado
- Implementar tracking de eventos y comportamiento de usuarios

## Arquitectura del Sistema

### 1. Event Tracking System

```typescript
// src/analytics/domain/entities/event.entity.ts
export class AnalyticsEvent {
  constructor(
    public readonly id: EventId,
    public readonly userId: UserId | null,
    public readonly sessionId: SessionId,
    public readonly eventType: EventType,
    public readonly eventName: string,
    public readonly properties: EventProperties,
    public readonly context: EventContext,
    public readonly timestamp: Date = new Date()
  ) {}

  static createUserEvent(
    userId: UserId,
    sessionId: SessionId,
    eventName: string,
    properties: Record<string, any> = {},
    context: Record<string, any> = {}
  ): AnalyticsEvent {
    return new AnalyticsEvent(
      EventId.generate(),
      userId,
      sessionId,
      EventType.USER_ACTION,
      eventName,
      new EventProperties(properties),
      new EventContext(context)
    );
  }

  static createSystemEvent(
    eventName: string,
    properties: Record<string, any> = {},
    context: Record<string, any> = {}
  ): AnalyticsEvent {
    return new AnalyticsEvent(
      EventId.generate(),
      null,
      SessionId.generate(),
      EventType.SYSTEM,
      eventName,
      new EventProperties(properties),
      new EventContext(context)
    );
  }
}

export class EventProperties {
  constructor(
    private readonly data: Record<string, any> = {}
  ) {
    // Validate and sanitize properties
    this.validateProperties();
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, value: any): void {
    this.validateProperty(key, value);
    this.data[key] = value;
  }

  toObject(): Record<string, any> {
    return { ...this.data };
  }

  private validateProperties(): void {
    for (const [key, value] of Object.entries(this.data)) {
      this.validateProperty(key, value);
    }
  }

  private validateProperty(key: string, value: any): void {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Property key must be a non-empty string');
    }
    
    // Check for PII and sensitive data
    if (this.containsSensitiveData(key, value)) {
      throw new Error(`Property ${key} contains sensitive data`);
    }
  }

  private containsSensitiveData(key: string, value: any): boolean {
    const sensitiveKeys = ['password', 'email', 'phone', 'ssn', 'credit_card'];
    const sensitivePattern = /\b(?:password|email|phone|ssn|credit.?card)\b/i;
    
    return sensitiveKeys.includes(key.toLowerCase()) ||
           sensitivePattern.test(key) ||
           (typeof value === 'string' && sensitivePattern.test(value));
  }
}

export class EventContext {
  constructor(
    public readonly userAgent?: string,
    public readonly ipAddress?: string,
    public readonly referrer?: string,
    public readonly deviceInfo?: DeviceInfo,
    public readonly location?: LocationInfo,
    public readonly customData: Record<string, any> = {}
  ) {}

  static fromRequest(request: any): EventContext {
    return new EventContext(
      request.headers['user-agent'],
      request.ip,
      request.headers.referer,
      DeviceInfo.fromUserAgent(request.headers['user-agent']),
      undefined, // Location would need geolocation service
      {}
    );
  }
}

export enum EventType {
  USER_ACTION = 'user_action',
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  ERROR = 'error'
}
```

### 2. Metrics Aggregation

```typescript
// src/analytics/domain/entities/metric.entity.ts
export class Metric {
  constructor(
    public readonly id: MetricId,
    public readonly name: string,
    public readonly type: MetricType,
    public readonly value: number,
    public readonly dimensions: MetricDimensions,
    public readonly timestamp: Date,
    public readonly interval: TimeInterval
  ) {}

  static counter(
    name: string,
    value: number = 1,
    dimensions: Record<string, string> = {},
    timestamp: Date = new Date()
  ): Metric {
    return new Metric(
      MetricId.generate(),
      name,
      MetricType.COUNTER,
      value,
      new MetricDimensions(dimensions),
      timestamp,
      TimeInterval.INSTANT
    );
  }

  static gauge(
    name: string,
    value: number,
    dimensions: Record<string, string> = {},
    timestamp: Date = new Date()
  ): Metric {
    return new Metric(
      MetricId.generate(),
      name,
      MetricType.GAUGE,
      value,
      new MetricDimensions(dimensions),
      timestamp,
      TimeInterval.INSTANT
    );
  }

  static histogram(
    name: string,
    value: number,
    dimensions: Record<string, string> = {},
    timestamp: Date = new Date()
  ): Metric {
    return new Metric(
      MetricId.generate(),
      name,
      MetricType.HISTOGRAM,
      value,
      new MetricDimensions(dimensions),
      timestamp,
      TimeInterval.INSTANT
    );
  }
}

export class MetricDimensions {
  constructor(
    private readonly dimensions: Record<string, string> = {}
  ) {}

  get(key: string): string | undefined {
    return this.dimensions[key];
  }

  set(key: string, value: string): void {
    this.dimensions[key] = value;
  }

  toObject(): Record<string, string> {
    return { ...this.dimensions };
  }

  toString(): string {
    return Object.entries(this.dimensions)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer'
}

export enum TimeInterval {
  INSTANT = 'instant',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}
```

### 3. Real-time Dashboard Data

```typescript
// src/analytics/domain/entities/dashboard.entity.ts
export class DashboardData {
  constructor(
    public readonly id: DashboardId,
    public readonly name: string,
    public readonly widgets: DashboardWidget[],
    public readonly timeRange: TimeRange,
    public readonly refreshInterval: number = 30000, // 30 seconds
    public readonly filters: DashboardFilter[] = [],
    private readonly _lastUpdated: Date = new Date()
  ) {}

  addWidget(widget: DashboardWidget): void {
    this.widgets.push(widget);
  }

  removeWidget(widgetId: WidgetId): void {
    const index = this.widgets.findIndex(w => w.id.equals(widgetId));
    if (index > -1) {
      this.widgets.splice(index, 1);
    }
  }

  updateWidget(widgetId: WidgetId, data: WidgetData): void {
    const widget = this.widgets.find(w => w.id.equals(widgetId));
    if (widget) {
      widget.updateData(data);
    }
  }

  get lastUpdated(): Date {
    return this._lastUpdated;
  }
}

export class DashboardWidget {
  constructor(
    public readonly id: WidgetId,
    public readonly type: WidgetType,
    public readonly title: string,
    public readonly query: MetricQuery,
    public readonly config: WidgetConfig,
    private _data: WidgetData | null = null,
    private _lastUpdated: Date | null = null
  ) {}

  updateData(data: WidgetData): void {
    this._data = data;
    this._lastUpdated = new Date();
  }

  get data(): WidgetData | null {
    return this._data;
  }

  get lastUpdated(): Date | null {
    return this._lastUpdated;
  }
}

export enum WidgetType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  NUMBER = 'number',
  TABLE = 'table',
  HEATMAP = 'heatmap',
  FUNNEL = 'funnel'
}

export class MetricQuery {
  constructor(
    public readonly metric: string,
    public readonly aggregation: AggregationType,
    public readonly groupBy: string[] = [],
    public readonly filters: QueryFilter[] = [],
    public readonly timeRange: TimeRange
  ) {}
}

export enum AggregationType {
  SUM = 'sum',
  AVG = 'avg',
  COUNT = 'count',
  MIN = 'min',
  MAX = 'max',
  PERCENTILE = 'percentile'
}
```

### 4. Use Cases

```typescript
// src/analytics/application/use-cases/track-event.use-case.ts
@Injectable()
export class TrackEventUseCase {
  constructor(
    private readonly eventRepository: IAnalyticsEventRepository,
    private readonly metricsService: MetricsService,
    private readonly eventBus: IEventBus
  ) {}

  async execute(command: TrackEventCommand): Promise<void> {
    const event = AnalyticsEvent.createUserEvent(
      command.userId,
      command.sessionId,
      command.eventName,
      command.properties,
      command.context
    );

    try {
      // Store event
      await this.eventRepository.save(event);

      // Update real-time metrics
      await this.updateMetrics(event);

      // Publish for real-time processing
      await this.eventBus.publish(new EventTrackedEvent(event));

    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to track event:', error);
    }
  }

  private async updateMetrics(event: AnalyticsEvent): Promise<void> {
    // Update various metrics based on event
    const metrics: Metric[] = [];

    // Total events counter
    metrics.push(Metric.counter('events.total', 1, {
      event_name: event.eventName,
      event_type: event.eventType
    }));

    // User activity
    if (event.userId) {
      metrics.push(Metric.counter('users.active', 1, {
        user_id: event.userId.value
      }));
    }

    // Event-specific metrics
    switch (event.eventName) {
      case 'message_sent':
        metrics.push(Metric.counter('messages.sent', 1));
        break;
      case 'file_uploaded':
        const fileSize = event.properties.get('file_size') || 0;
        metrics.push(Metric.histogram('files.size', fileSize));
        break;
      case 'user_login':
        metrics.push(Metric.counter('auth.logins', 1));
        break;
    }

    await this.metricsService.record(metrics);
  }
}

// src/analytics/application/use-cases/get-dashboard-data.use-case.ts
@Injectable()
export class GetDashboardDataUseCase {
  constructor(
    private readonly dashboardRepository: IDashboardRepository,
    private readonly metricsRepository: IMetricsRepository,
    private readonly queryEngine: MetricsQueryEngine
  ) {}

  async execute(query: GetDashboardDataQuery): Promise<DashboardDataDto> {
    const dashboard = await this.dashboardRepository.findById(query.dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const widgetData = await Promise.all(
      dashboard.widgets.map(widget => this.getWidgetData(widget, query.timeRange))
    );

    return DashboardDataDto.fromEntity(dashboard, widgetData);
  }

  private async getWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetDataDto> {
    const effectiveTimeRange = timeRange || widget.query.timeRange;
    
    const queryWithTimeRange = new MetricQuery(
      widget.query.metric,
      widget.query.aggregation,
      widget.query.groupBy,
      widget.query.filters,
      effectiveTimeRange
    );

    const result = await this.queryEngine.execute(queryWithTimeRange);
    
    return new WidgetDataDto(
      widget.id.value,
      widget.type,
      result.data,
      result.labels,
      new Date()
    );
  }
}

// src/analytics/application/use-cases/generate-report.use-case.ts
@Injectable()
export class GenerateReportUseCase {
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly metricsRepository: IMetricsRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService
  ) {}

  async execute(command: GenerateReportCommand): Promise<ReportResult> {
    const reportConfig = await this.reportRepository.findConfigById(command.configId);
    if (!reportConfig) {
      throw new Error('Report configuration not found');
    }

    const reportData = await this.gatherReportData(reportConfig, command.timeRange);
    
    const report = new Report(
      ReportId.generate(),
      reportConfig.name,
      reportConfig.type,
      reportData,
      command.timeRange,
      reportConfig.template
    );

    await this.reportRepository.save(report);

    // Generate and send report
    if (reportConfig.delivery.email && reportConfig.delivery.recipients.length > 0) {
      await this.sendReportByEmail(report, reportConfig.delivery.recipients);
    }

    return ReportResult.success(report.id);
  }

  private async gatherReportData(
    config: ReportConfig,
    timeRange: TimeRange
  ): Promise<ReportData> {
    const sections: ReportSection[] = [];

    for (const sectionConfig of config.sections) {
      const sectionData = await this.getSectionData(sectionConfig, timeRange);
      sections.push(new ReportSection(
        sectionConfig.name,
        sectionConfig.type,
        sectionData
      ));
    }

    return new ReportData(sections);
  }

  private async getSectionData(
    config: ReportSectionConfig,
    timeRange: TimeRange
  ): Promise<any> {
    switch (config.type) {
      case 'user_activity':
        return this.getUserActivityData(timeRange);
      case 'message_stats':
        return this.getMessageStatsData(timeRange);
      case 'file_usage':
        return this.getFileUsageData(timeRange);
      case 'performance':
        return this.getPerformanceData(timeRange);
      default:
        return {};
    }
  }
}
```

### 5. Real-time Metrics Service

```typescript
// src/analytics/infrastructure/services/metrics.service.ts
@Injectable()
export class MetricsService {
  private readonly metricsBuffer: Metric[] = [];
  private readonly bufferSize = 1000;
  private flushInterval: NodeJS.Timer;

  constructor(
    private readonly metricsRepository: IMetricsRepository,
    private readonly websocketGateway: AnalyticsGateway,
    private readonly redisService: RedisService
  ) {
    // Flush metrics every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000);
  }

  async record(metrics: Metric | Metric[]): Promise<void> {
    const metricsArray = Array.isArray(metrics) ? metrics : [metrics];
    
    this.metricsBuffer.push(...metricsArray);

    // Update real-time dashboard
    await this.updateRealTimeDashboard(metricsArray);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetrics();
    }
  }

  async counter(name: string, value: number = 1, dimensions: Record<string, string> = {}): Promise<void> {
    await this.record(Metric.counter(name, value, dimensions));
  }

  async gauge(name: string, value: number, dimensions: Record<string, string> = {}): Promise<void> {
    await this.record(Metric.gauge(name, value, dimensions));
  }

  async histogram(name: string, value: number, dimensions: Record<string, string> = {}): Promise<void> {
    await this.record(Metric.histogram(name, value, dimensions));
  }

  async timer<T>(name: string, fn: () => Promise<T>, dimensions: Record<string, string> = {}): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      await this.histogram(`${name}.duration`, Date.now() - start, {
        ...dimensions,
        status: 'success'
      });
      return result;
    } catch (error) {
      await this.histogram(`${name}.duration`, Date.now() - start, {
        ...dimensions,
        status: 'error'
      });
      throw error;
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = this.metricsBuffer.splice(0, this.bufferSize);
    
    try {
      await this.metricsRepository.saveBatch(metricsToFlush);
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Could implement retry logic here
    }
  }

  private async updateRealTimeDashboard(metrics: Metric[]): Promise<void> {
    const updates: DashboardUpdate[] = [];

    for (const metric of metrics) {
      // Cache latest values in Redis for fast dashboard updates
      const key = `metric:${metric.name}:${metric.dimensions.toString()}`;
      await this.redisService.set(key, metric.value, 3600); // 1 hour TTL

      updates.push(new DashboardUpdate(
        metric.name,
        metric.value,
        metric.dimensions.toObject(),
        metric.timestamp
      ));
    }

    // Broadcast to connected dashboards
    await this.websocketGateway.broadcastUpdates(updates);
  }

  onApplicationShutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush
    this.flushMetrics();
  }
}

// src/analytics/infrastructure/websocket/analytics.gateway.ts
@WebSocketGateway({
  namespace: 'analytics',
  cors: { origin: '*' }
})
export class AnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private dashboardSubscriptions = new Map<string, Set<string>>();

  async handleConnection(client: Socket) {
    try {
      const user = await this.authService.validateSocketConnection(client);
      // Check if user has analytics access
      if (!user.hasPermission('analytics.view')) {
        client.disconnect();
        return;
      }
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Clean up subscriptions
    for (const [dashboardId, clients] of this.dashboardSubscriptions.entries()) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.dashboardSubscriptions.delete(dashboardId);
      }
    }
  }

  @SubscribeMessage('subscribe-dashboard')
  async handleSubscribeDashboard(
    client: Socket,
    payload: { dashboardId: string }
  ) {
    if (!this.dashboardSubscriptions.has(payload.dashboardId)) {
      this.dashboardSubscriptions.set(payload.dashboardId, new Set());
    }
    this.dashboardSubscriptions.get(payload.dashboardId).add(client.id);
    
    client.join(`dashboard:${payload.dashboardId}`);
  }

  @SubscribeMessage('unsubscribe-dashboard')
  async handleUnsubscribeDashboard(
    client: Socket,
    payload: { dashboardId: string }
  ) {
    const clients = this.dashboardSubscriptions.get(payload.dashboardId);
    if (clients) {
      clients.delete(client.id);
    }
    
    client.leave(`dashboard:${payload.dashboardId}`);
  }

  async broadcastUpdates(updates: DashboardUpdate[]): Promise<void> {
    // Group updates by metric for efficient broadcasting
    const updatesByMetric = new Map<string, DashboardUpdate[]>();
    
    for (const update of updates) {
      if (!updatesByMetric.has(update.metricName)) {
        updatesByMetric.set(update.metricName, []);
      }
      updatesByMetric.get(update.metricName).push(update);
    }

    // Broadcast to all connected dashboards
    for (const [metricName, metricUpdates] of updatesByMetric.entries()) {
      this.server.emit('metric-updates', {
        metric: metricName,
        updates: metricUpdates
      });
    }
  }
}
```

### 6. Controllers y APIs

```typescript
// src/analytics/infrastructure/controllers/analytics.controller.ts
@Controller('api/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('analytics.view')
export class AnalyticsController {
  constructor(
    private readonly trackEventUseCase: TrackEventUseCase,
    private readonly getDashboardDataUseCase: GetDashboardDataUseCase,
    private readonly generateReportUseCase: GenerateReportUseCase,
    private readonly getMetricsUseCase: GetMetricsUseCase
  ) {}

  @Post('events')
  async trackEvent(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: TrackEventDto
  ): Promise<void> {
    await this.trackEventUseCase.execute(
      new TrackEventCommand(
        UserId.fromString(user.id),
        SessionId.fromString(dto.sessionId),
        dto.eventName,
        dto.properties,
        dto.context
      )
    );
  }

  @Get('dashboards/:id')
  async getDashboardData(
    @Param('id') dashboardId: string,
    @Query() query: GetDashboardQueryDto
  ): Promise<DashboardDataDto> {
    return await this.getDashboardDataUseCase.execute(
      new GetDashboardDataQuery(
        DashboardId.fromString(dashboardId),
        query.timeRange ? TimeRange.fromDto(query.timeRange) : undefined
      )
    );
  }

  @Get('metrics')
  async getMetrics(
    @Query() query: GetMetricsQueryDto
  ): Promise<MetricsResponseDto> {
    return await this.getMetricsUseCase.execute(
      new GetMetricsQuery(
        query.metrics,
        query.aggregation,
        TimeRange.fromDto(query.timeRange),
        query.groupBy,
        query.filters
      )
    );
  }

  @Post('reports')
  async generateReport(
    @Body() dto: GenerateReportDto
  ): Promise<ReportResultDto> {
    const result = await this.generateReportUseCase.execute(
      new GenerateReportCommand(
        ReportConfigId.fromString(dto.configId),
        TimeRange.fromDto(dto.timeRange)
      )
    );
    
    return ReportResultDto.fromResult(result);
  }

  @Get('insights')
  async getInsights(
    @Query() query: GetInsightsQueryDto
  ): Promise<InsightsResponseDto> {
    return await this.getInsightsUseCase.execute(
      new GetInsightsQuery(
        TimeRange.fromDto(query.timeRange),
        query.categories
      )
    );
  }
}

// DTOs
export class TrackEventDto {
  @IsString()
  sessionId: string;

  @IsString()
  eventName: string;

  @IsObject()
  @IsOptional()
  properties?: Record<string, any>;

  @IsObject()
  @IsOptional()
  context?: Record<string, any>;
}

export class GetDashboardQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRangeDto)
  timeRange?: TimeRangeDto;
}

export class TimeRangeDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
```

### 7. Interceptor para Auto-tracking

```typescript
// src/analytics/infrastructure/interceptors/analytics.interceptor.ts
@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  constructor(
    private readonly trackEventUseCase: TrackEventUseCase
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        // Track successful API calls
        this.trackApiCall(request, Date.now() - startTime, 'success');
      }),
      catchError((error) => {
        // Track failed API calls
        this.trackApiCall(request, Date.now() - startTime, 'error');
        throw error;
      })
    );
  }

  private async trackApiCall(
    request: any,
    duration: number,
    status: string
  ): Promise<void> {
    try {
      const user = request.user;
      if (!user) return;

      await this.trackEventUseCase.execute(
        new TrackEventCommand(
          UserId.fromString(user.id),
          SessionId.fromString(request.sessionId || 'unknown'),
          'api_call',
          {
            endpoint: request.route?.path || request.url,
            method: request.method,
            status,
            duration,
            user_agent: request.headers['user-agent']
          },
          EventContext.fromRequest(request).toObject()
        )
      );
    } catch (error) {
      // Silently fail - don't affect main operation
      console.error('Analytics tracking failed:', error);
    }
  }
}
```

## Tareas de Implementación

### Fase 1: Event Tracking (Días 1-2)

- [ ] Crear entities y value objects para events
- [ ] Implementar TrackEventUseCase
- [ ] Configurar repositorio con base de datos de series temporales
- [ ] Crear interceptor para auto-tracking

### Fase 2: Metrics System (Días 3-4)

- [ ] Implementar sistema de métricas en tiempo real
- [ ] Crear MetricsService con buffer
- [ ] Configurar agregaciones automáticas
- [ ] Integrar con Redis para caching

### Fase 3: Dashboard System (Días 5-6)

- [ ] Crear entities para dashboards y widgets
- [ ] Implementar query engine para métricas
- [ ] Desarrollar WebSocket gateway para real-time
- [ ] Crear APIs REST para dashboards

### Fase 4: Reporting System (Días 7-8)

- [ ] Implementar generación de reportes
- [ ] Crear templates para diferentes tipos de reporte
- [ ] Configurar entrega automática por email
- [ ] Implementar scheduler para reportes periódicos

### Fase 5: Advanced Analytics (Días 9-10)

- [ ] Sistema de insights automáticos
- [ ] Análisis de comportamiento de usuarios
- [ ] Alertas basadas en métricas
- [ ] Integración con herramientas externas

## Testing

```typescript
// test/analytics/track-event.use-case.spec.ts
describe('TrackEventUseCase', () => {
  let useCase: TrackEventUseCase;
  let eventRepository: MockType<IAnalyticsEventRepository>;
  let metricsService: MockType<MetricsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TrackEventUseCase,
        {
          provide: IAnalyticsEventRepository,
          useFactory: createMockRepository
        },
        {
          provide: MetricsService,
          useFactory: createMockService
        }
      ]
    }).compile();

    useCase = module.get(TrackEventUseCase);
    eventRepository = module.get(IAnalyticsEventRepository);
    metricsService = module.get(MetricsService);
  });

  it('should track user event successfully', async () => {
    // Test implementation
  });

  it('should update metrics when event is tracked', async () => {
    // Test implementation
  });

  it('should not track events with sensitive data', async () => {
    // Test implementation
  });
});
```

## Métricas Clave

### User Engagement

- **Daily Active Users (DAU)**
- **Monthly Active Users (MAU)**
- **Session Duration**
- **Messages per Session**
- **File Uploads per User**

### System Performance

- **API Response Times**
- **WebSocket Connection Count**
- **Message Delivery Rate**
- **Error Rates**
- **Resource Utilization**

### Business Metrics

- **User Retention Rate**
- **Feature Adoption**
- **Conversion Funnels**
- **User Journey Analysis**

Este sistema proporcionará visibilidad completa del comportamiento de usuarios y rendimiento del sistema, permitiendo tomar decisiones basadas en datos.
