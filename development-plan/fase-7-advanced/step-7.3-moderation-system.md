# Step 7.3: Sistema de Moderación y Control de Contenido

## Objetivos

- Implementar sistema de moderación automatizada y manual
- Crear herramientas de control de contenido en tiempo real
- Desarrollar sistema de reportes y sanciones
- Implementar filtros de contenido y detección de spam

## Arquitectura del Sistema

### 1. Content Moderation System

```typescript
// src/moderation/domain/entities/moderation-rule.entity.ts
export class ModerationRule {
  constructor(
    public readonly id: RuleId,
    public readonly name: string,
    public readonly description: string,
    public readonly type: RuleType,
    public readonly criteria: ModerationCriteria,
    public readonly action: ModerationAction,
    public readonly severity: SeverityLevel,
    public readonly isActive: boolean = true,
    public readonly priority: number = 0,
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date()
  ) {}

  update(criteria: ModerationCriteria, action: ModerationAction): void {
    this.criteria = criteria;
    this.action = action;
    this._updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this._updatedAt = new Date();
  }

  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}

export class ModerationCriteria {
  constructor(
    public readonly conditions: ModerationCondition[],
    public readonly logicalOperator: LogicalOperator = LogicalOperator.AND
  ) {}

  evaluate(content: Content, context: ModerationContext): boolean {
    if (this.logicalOperator === LogicalOperator.AND) {
      return this.conditions.every(condition => condition.evaluate(content, context));
    } else {
      return this.conditions.some(condition => condition.evaluate(content, context));
    }
  }
}

export abstract class ModerationCondition {
  constructor(
    public readonly type: ConditionType,
    public readonly parameters: Record<string, any>
  ) {}

  abstract evaluate(content: Content, context: ModerationContext): boolean;
}

export class KeywordCondition extends ModerationCondition {
  constructor(
    parameters: { keywords: string[], caseSensitive: boolean }
  ) {
    super(ConditionType.KEYWORD, parameters);
  }

  evaluate(content: Content, context: ModerationContext): boolean {
    const text = content.getText().toLowerCase();
    const keywords = this.parameters.keywords as string[];
    const caseSensitive = this.parameters.caseSensitive as boolean;

    return keywords.some(keyword => {
      const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
      return text.includes(searchKeyword);
    });
  }
}

export class SpamCondition extends ModerationCondition {
  constructor(
    parameters: { 
      maxMessagesPerMinute: number,
      maxRepeatedContent: number,
      suspiciousPatterns: string[]
    }
  ) {
    super(ConditionType.SPAM, parameters);
  }

  evaluate(content: Content, context: ModerationContext): boolean {
    const maxMessages = this.parameters.maxMessagesPerMinute as number;
    const maxRepeated = this.parameters.maxRepeatedContent as number;

    // Check message frequency
    if (context.userMessageCount > maxMessages) {
      return true;
    }

    // Check repeated content
    if (context.repeatedContentCount > maxRepeated) {
      return true;
    }

    // Check suspicious patterns
    const patterns = this.parameters.suspiciousPatterns as string[];
    const text = content.getText();
    
    return patterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    });
  }
}

export enum RuleType {
  CONTENT_FILTER = 'content_filter',
  SPAM_DETECTION = 'spam_detection',
  BEHAVIOR_ANALYSIS = 'behavior_analysis',
  RATE_LIMITING = 'rate_limiting'
}

export enum ConditionType {
  KEYWORD = 'keyword',
  REGEX = 'regex',
  SENTIMENT = 'sentiment',
  SPAM = 'spam',
  LENGTH = 'length',
  FREQUENCY = 'frequency'
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or'
}
```

### 2. Moderation Actions

```typescript
// src/moderation/domain/entities/moderation-action.entity.ts
export abstract class ModerationAction {
  constructor(
    public readonly type: ActionType,
    public readonly parameters: Record<string, any>
  ) {}

  abstract execute(
    content: Content,
    user: User,
    context: ModerationContext
  ): Promise<ModerationResult>;
}

export class BlockContentAction extends ModerationAction {
  constructor(
    parameters: { reason: string, notifyUser: boolean }
  ) {
    super(ActionType.BLOCK_CONTENT, parameters);
  }

  async execute(
    content: Content,
    user: User,
    context: ModerationContext
  ): Promise<ModerationResult> {
    // Block the content from being displayed
    content.markAsBlocked(this.parameters.reason as string);

    if (this.parameters.notifyUser as boolean) {
      // Send notification to user about blocked content
      await context.notificationService.sendContentBlockedNotification(
        user.id,
        this.parameters.reason as string
      );
    }

    return ModerationResult.success(ActionType.BLOCK_CONTENT, content.id);
  }
}

export class WarnUserAction extends ModerationAction {
  constructor(
    parameters: { message: string, severity: SeverityLevel }
  ) {
    super(ActionType.WARN_USER, parameters);
  }

  async execute(
    content: Content,
    user: User,
    context: ModerationContext
  ): Promise<ModerationResult> {
    const warning = new UserWarning(
      WarningId.generate(),
      user.id,
      this.parameters.message as string,
      this.parameters.severity as SeverityLevel,
      content.id
    );

    await context.warningRepository.save(warning);

    await context.notificationService.sendWarningNotification(
      user.id,
      warning
    );

    return ModerationResult.success(ActionType.WARN_USER, warning.id);
  }
}

export class TemporaryBanAction extends ModerationAction {
  constructor(
    parameters: { duration: number, reason: string }
  ) {
    super(ActionType.TEMPORARY_BAN, parameters);
  }

  async execute(
    content: Content,
    user: User,
    context: ModerationContext
  ): Promise<ModerationResult> {
    const banDuration = this.parameters.duration as number; // minutes
    const expiresAt = new Date(Date.now() + banDuration * 60 * 1000);

    const ban = new UserBan(
      BanId.generate(),
      user.id,
      BanType.TEMPORARY,
      this.parameters.reason as string,
      expiresAt
    );

    await context.banRepository.save(ban);

    // Disconnect user from all chat sessions
    await context.websocketService.disconnectUser(user.id);

    await context.notificationService.sendBanNotification(user.id, ban);

    return ModerationResult.success(ActionType.TEMPORARY_BAN, ban.id);
  }
}

export enum ActionType {
  BLOCK_CONTENT = 'block_content',
  WARN_USER = 'warn_user',
  TEMPORARY_BAN = 'temporary_ban',
  PERMANENT_BAN = 'permanent_ban',
  DELETE_CONTENT = 'delete_content',
  REQUIRE_APPROVAL = 'require_approval',
  ESCALATE_TO_HUMAN = 'escalate_to_human'
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### 3. User Reports System

```typescript
// src/moderation/domain/entities/user-report.entity.ts
export class UserReport {
  constructor(
    public readonly id: ReportId,
    public readonly reporterId: UserId,
    public readonly reportedUserId: UserId,
    public readonly contentId: ContentId | null,
    public readonly type: ReportType,
    public readonly reason: ReportReason,
    public readonly description: string,
    public readonly evidence: ReportEvidence[],
    private _status: ReportStatus = ReportStatus.PENDING,
    private _assignedToId: UserId | null = null,
    private _resolution: ReportResolution | null = null,
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date()
  ) {}

  assign(moderatorId: UserId): void {
    this._assignedToId = moderatorId;
    this._status = ReportStatus.IN_REVIEW;
    this._updatedAt = new Date();
  }

  resolve(resolution: ReportResolution): void {
    this._resolution = resolution;
    this._status = ReportStatus.RESOLVED;
    this._updatedAt = new Date();
  }

  escalate(): void {
    this._status = ReportStatus.ESCALATED;
    this._updatedAt = new Date();
  }

  reject(reason: string): void {
    this._resolution = new ReportResolution(
      ResolutionType.REJECTED,
      reason,
      null
    );
    this._status = ReportStatus.RESOLVED;
    this._updatedAt = new Date();
  }

  get status(): ReportStatus { return this._status; }
  get assignedToId(): UserId | null { return this._assignedToId; }
  get resolution(): ReportResolution | null { return this._resolution; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}

export class ReportEvidence {
  constructor(
    public readonly type: EvidenceType,
    public readonly data: string,
    public readonly metadata: Record<string, any> = {}
  ) {}
}

export class ReportResolution {
  constructor(
    public readonly type: ResolutionType,
    public readonly reason: string,
    public readonly actionTaken: ActionType | null,
    public readonly notes?: string
  ) {}
}

export enum ReportType {
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  IMPERSONATION = 'impersonation',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  OTHER = 'other'
}

export enum ReportReason {
  OFFENSIVE_LANGUAGE = 'offensive_language',
  THREATENING_BEHAVIOR = 'threatening_behavior',
  SEXUAL_CONTENT = 'sexual_content',
  VIOLENCE_INCITEMENT = 'violence_incitement',
  SPAM_FLOODING = 'spam_flooding',
  FAKE_IDENTITY = 'fake_identity',
  COPYRIGHT_VIOLATION = 'copyright_violation',
  PRIVACY_VIOLATION = 'privacy_violation'
}

export enum ReportStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated'
}

export enum EvidenceType {
  SCREENSHOT = 'screenshot',
  MESSAGE_HISTORY = 'message_history',
  FILE_ATTACHMENT = 'file_attachment',
  LINK = 'link'
}

export enum ResolutionType {
  ACTION_TAKEN = 'action_taken',
  NO_VIOLATION = 'no_violation',
  REJECTED = 'rejected',
  ESCALATED = 'escalated'
}
```

### 4. Automated Content Analysis

```typescript
// src/moderation/infrastructure/services/content-analysis.service.ts
@Injectable()
export class ContentAnalysisService {
  constructor(
    private readonly sentimentAnalysisService: SentimentAnalysisService,
    private readonly toxicityDetectionService: ToxicityDetectionService,
    private readonly spamDetectionService: SpamDetectionService,
    private readonly imageAnalysisService: ImageAnalysisService
  ) {}

  async analyzeContent(content: Content): Promise<ContentAnalysisResult> {
    const analyses: AnalysisResult[] = [];

    // Text analysis
    if (content.hasText()) {
      const textAnalyses = await Promise.all([
        this.analyzeSentiment(content.getText()),
        this.analyzeToxicity(content.getText()),
        this.analyzeSpam(content.getText())
      ]);
      analyses.push(...textAnalyses);
    }

    // Image analysis
    if (content.hasImages()) {
      const imageAnalyses = await Promise.all(
        content.getImages().map(image => this.analyzeImage(image))
      );
      analyses.push(...imageAnalyses.flat());
    }

    // File analysis
    if (content.hasFiles()) {
      const fileAnalyses = await Promise.all(
        content.getFiles().map(file => this.analyzeFile(file))
      );
      analyses.push(...fileAnalyses.flat());
    }

    return new ContentAnalysisResult(
      content.id,
      analyses,
      this.calculateOverallRiskScore(analyses)
    );
  }

  private async analyzeSentiment(text: string): Promise<AnalysisResult> {
    const result = await this.sentimentAnalysisService.analyze(text);
    
    return new AnalysisResult(
      AnalysisType.SENTIMENT,
      result.score,
      result.confidence,
      {
        sentiment: result.sentiment,
        emotions: result.emotions
      }
    );
  }

  private async analyzeToxicity(text: string): Promise<AnalysisResult> {
    const result = await this.toxicityDetectionService.analyze(text);
    
    return new AnalysisResult(
      AnalysisType.TOXICITY,
      result.toxicityScore,
      result.confidence,
      {
        categories: result.categories,
        severity: result.severity
      }
    );
  }

  private async analyzeSpam(text: string): Promise<AnalysisResult> {
    const result = await this.spamDetectionService.analyze(text);
    
    return new AnalysisResult(
      AnalysisType.SPAM,
      result.spamScore,
      result.confidence,
      {
        indicators: result.indicators,
        patterns: result.patterns
      }
    );
  }

  private async analyzeImage(image: FileContent): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    // NSFW detection
    const nsfwResult = await this.imageAnalysisService.detectNSFW(image.url);
    results.push(new AnalysisResult(
      AnalysisType.NSFW,
      nsfwResult.score,
      nsfwResult.confidence,
      { categories: nsfwResult.categories }
    ));

    // Violence detection
    const violenceResult = await this.imageAnalysisService.detectViolence(image.url);
    results.push(new AnalysisResult(
      AnalysisType.VIOLENCE,
      violenceResult.score,
      violenceResult.confidence,
      { indicators: violenceResult.indicators }
    ));

    // Text in image (OCR)
    const ocrResult = await this.imageAnalysisService.extractText(image.url);
    if (ocrResult.text) {
      const textAnalyses = await Promise.all([
        this.analyzeToxicity(ocrResult.text),
        this.analyzeSpam(ocrResult.text)
      ]);
      results.push(...textAnalyses);
    }

    return results;
  }

  private calculateOverallRiskScore(analyses: AnalysisResult[]): number {
    if (analyses.length === 0) return 0;

    // Weighted scoring based on analysis type
    const weights = {
      [AnalysisType.TOXICITY]: 0.4,
      [AnalysisType.SPAM]: 0.3,
      [AnalysisType.NSFW]: 0.2,
      [AnalysisType.VIOLENCE]: 0.3,
      [AnalysisType.SENTIMENT]: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const analysis of analyses) {
      const weight = weights[analysis.type] || 0.1;
      totalScore += analysis.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}

export class ContentAnalysisResult {
  constructor(
    public readonly contentId: ContentId,
    public readonly analyses: AnalysisResult[],
    public readonly overallRiskScore: number
  ) {}

  hasHighRisk(): boolean {
    return this.overallRiskScore > 0.7;
  }

  hasMediumRisk(): boolean {
    return this.overallRiskScore > 0.4 && this.overallRiskScore <= 0.7;
  }

  getAnalysisByType(type: AnalysisType): AnalysisResult | undefined {
    return this.analyses.find(a => a.type === type);
  }
}

export class AnalysisResult {
  constructor(
    public readonly type: AnalysisType,
    public readonly score: number, // 0-1, where 1 is highest risk
    public readonly confidence: number, // 0-1
    public readonly metadata: Record<string, any> = {}
  ) {}
}

export enum AnalysisType {
  SENTIMENT = 'sentiment',
  TOXICITY = 'toxicity',
  SPAM = 'spam',
  NSFW = 'nsfw',
  VIOLENCE = 'violence',
  HATE_SPEECH = 'hate_speech'
}
```

### 5. Use Cases

```typescript
// src/moderation/application/use-cases/moderate-content.use-case.ts
@Injectable()
export class ModerateContentUseCase {
  constructor(
    private readonly moderationRuleRepository: IModerationRuleRepository,
    private readonly contentAnalysisService: ContentAnalysisService,
    private readonly moderationLogRepository: IModerationLogRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(command: ModerateContentCommand): Promise<ModerationDecision> {
    try {
      // Get active moderation rules
      const rules = await this.moderationRuleRepository.findActiveRules();
      
      // Analyze content
      const analysisResult = await this.contentAnalysisService.analyzeContent(command.content);
      
      // Build moderation context
      const context = await this.buildModerationContext(command);
      
      // Evaluate rules
      const decisions: RuleDecision[] = [];
      
      for (const rule of rules) {
        if (rule.criteria.evaluate(command.content, context)) {
          const actionResult = await rule.action.execute(
            command.content,
            command.user,
            context
          );
          
          decisions.push(new RuleDecision(
            rule.id,
            rule.name,
            actionResult,
            rule.severity
          ));
        }
      }

      // Create moderation log
      const moderationLog = new ModerationLog(
        ModerationLogId.generate(),
        command.content.id,
        command.user.id,
        decisions,
        analysisResult,
        context
      );

      await this.moderationLogRepository.save(moderationLog);

      // Publish events
      await this.eventBus.publish(new ContentModeratedEvent(
        command.content.id,
        decisions,
        analysisResult.overallRiskScore
      ));

      return new ModerationDecision(
        decisions,
        analysisResult,
        this.shouldBlockContent(decisions)
      );

    } catch (error) {
      // Log error and allow content by default
      console.error('Moderation failed:', error);
      return ModerationDecision.allowByDefault();
    }
  }

  private async buildModerationContext(command: ModerateContentCommand): Promise<ModerationContext> {
    // Get user's recent activity
    const recentActivity = await this.getUserRecentActivity(command.user.id);
    
    return new ModerationContext(
      command.user,
      recentActivity.messageCount,
      recentActivity.repeatedContentCount,
      recentActivity.warningCount,
      recentActivity.banCount,
      new Date()
    );
  }

  private shouldBlockContent(decisions: RuleDecision[]): boolean {
    return decisions.some(decision => 
      decision.actionResult.actionType === ActionType.BLOCK_CONTENT ||
      decision.actionResult.actionType === ActionType.DELETE_CONTENT
    );
  }
}

// src/moderation/application/use-cases/handle-user-report.use-case.ts
@Injectable()
export class HandleUserReportUseCase {
  constructor(
    private readonly userReportRepository: IUserReportRepository,
    private readonly userRepository: IUserRepository,
    private readonly contentRepository: IContentRepository,
    private readonly moderationQueueService: ModerationQueueService
  ) {}

  async execute(command: HandleUserReportCommand): Promise<ReportResult> {
    // Validate users exist
    const reporter = await this.userRepository.findById(command.reporterId);
    const reportedUser = await this.userRepository.findById(command.reportedUserId);
    
    if (!reporter || !reportedUser) {
      throw new Error('User not found');
    }

    // Validate content if provided
    let content = null;
    if (command.contentId) {
      content = await this.contentRepository.findById(command.contentId);
      if (!content) {
        throw new Error('Content not found');
      }
    }

    // Check for duplicate reports
    const existingReport = await this.userReportRepository.findSimilarReport(
      command.reporterId,
      command.reportedUserId,
      command.contentId
    );

    if (existingReport && existingReport.status === ReportStatus.PENDING) {
      return ReportResult.duplicate(existingReport.id);
    }

    // Create new report
    const report = new UserReport(
      ReportId.generate(),
      command.reporterId,
      command.reportedUserId,
      command.contentId,
      command.type,
      command.reason,
      command.description,
      command.evidence
    );

    await this.userReportRepository.save(report);

    // Auto-assign to moderation queue based on severity
    const priority = this.calculateReportPriority(report, reportedUser);
    await this.moderationQueueService.addToQueue(report, priority);

    // If high priority, trigger immediate review
    if (priority === QueuePriority.HIGH) {
      await this.triggerImmediateReview(report);
    }

    return ReportResult.success(report.id);
  }

  private calculateReportPriority(report: UserReport, reportedUser: User): QueuePriority {
    let priority = QueuePriority.MEDIUM;

    // High priority reasons
    const highPriorityReasons = [
      ReportReason.THREATENING_BEHAVIOR,
      ReportReason.VIOLENCE_INCITEMENT,
      ReportReason.PRIVACY_VIOLATION
    ];

    if (highPriorityReasons.includes(report.reason)) {
      priority = QueuePriority.HIGH;
    }

    // Consider user's history
    if (reportedUser.hasRecentViolations()) {
      priority = QueuePriority.HIGH;
    }

    // Consider reporter's credibility
    if (reportedUser.hasLowReportCredibility()) {
      priority = QueuePriority.LOW;
    }

    return priority;
  }
}
```

### 6. Controllers

```typescript
// src/moderation/infrastructure/controllers/moderation.controller.ts
@Controller('api/moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(
    private readonly handleUserReportUseCase: HandleUserReportUseCase,
    private readonly getModerationQueueUseCase: GetModerationQueueUseCase,
    private readonly resolveReportUseCase: ResolveReportUseCase,
    private readonly getModerationStatsUseCase: GetModerationStatsUseCase
  ) {}

  @Post('reports')
  async createReport(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateReportDto
  ): Promise<ReportResultDto> {
    const result = await this.handleUserReportUseCase.execute(
      new HandleUserReportCommand(
        UserId.fromString(user.id),
        UserId.fromString(dto.reportedUserId),
        dto.contentId ? ContentId.fromString(dto.contentId) : null,
        dto.type,
        dto.reason,
        dto.description,
        dto.evidence.map(e => new ReportEvidence(e.type, e.data, e.metadata))
      )
    );

    return ReportResultDto.fromResult(result);
  }

  @Get('queue')
  @RequirePermissions('moderation.view')
  async getModerationQueue(
    @Query() query: GetModerationQueueQueryDto
  ): Promise<ModerationQueueResponseDto> {
    const result = await this.getModerationQueueUseCase.execute(
      new GetModerationQueueQuery(
        query.status,
        query.priority,
        query.assignedTo,
        query.limit,
        query.offset
      )
    );

    return ModerationQueueResponseDto.fromResult(result);
  }

  @Post('reports/:id/resolve')
  @RequirePermissions('moderation.resolve')
  async resolveReport(
    @Param('id') reportId: string,
    @CurrentUser() moderator: CurrentUserDto,
    @Body() dto: ResolveReportDto
  ): Promise<void> {
    await this.resolveReportUseCase.execute(
      new ResolveReportCommand(
        ReportId.fromString(reportId),
        UserId.fromString(moderator.id),
        dto.resolutionType,
        dto.reason,
        dto.actionTaken,
        dto.notes
      )
    );
  }

  @Get('stats')
  @RequirePermissions('moderation.view')
  async getModerationStats(
    @Query() query: GetStatsQueryDto
  ): Promise<ModerationStatsDto> {
    const result = await this.getModerationStatsUseCase.execute(
      new GetModerationStatsQuery(
        TimeRange.fromDto(query.timeRange)
      )
    );

    return ModerationStatsDto.fromResult(result);
  }

  @Get('rules')
  @RequirePermissions('moderation.manage')
  async getModerationRules(): Promise<ModerationRuleDto[]> {
    const rules = await this.getModerationRulesUseCase.execute(
      new GetModerationRulesQuery()
    );

    return rules.map(rule => ModerationRuleDto.fromEntity(rule));
  }

  @Post('rules')
  @RequirePermissions('moderation.manage')
  async createModerationRule(
    @Body() dto: CreateModerationRuleDto
  ): Promise<ModerationRuleDto> {
    const result = await this.createModerationRuleUseCase.execute(
      new CreateModerationRuleCommand(
        dto.name,
        dto.description,
        dto.type,
        ModerationCriteria.fromDto(dto.criteria),
        ModerationAction.fromDto(dto.action),
        dto.severity,
        dto.priority
      )
    );

    return ModerationRuleDto.fromEntity(result);
  }
}

// DTOs
export class CreateReportDto {
  @IsString()
  reportedUserId: string;

  @IsOptional()
  @IsString()
  contentId?: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsString()
  @Length(10, 1000)
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportEvidenceDto)
  evidence: ReportEvidenceDto[];
}

export class ReportEvidenceDto {
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @IsString()
  data: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
```

### 7. Real-time Moderation Dashboard

```typescript
// src/moderation/infrastructure/websocket/moderation.gateway.ts
@WebSocketGateway({
  namespace: 'moderation',
  cors: { origin: '*' }
})
export class ModerationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private moderatorSockets = new Map<string, Set<string>>();

  constructor(
    private readonly authService: AuthService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.authService.validateSocketConnection(client);
      
      if (!user.hasPermission('moderation.view')) {
        client.disconnect();
        return;
      }

      if (!this.moderatorSockets.has(user.id)) {
        this.moderatorSockets.set(user.id, new Set());
      }
      this.moderatorSockets.get(user.id).add(client.id);
      
      client.join('moderators');
      
      // Send current queue stats
      const stats = await this.getModerationStats();
      client.emit('queue-stats', stats);
      
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [moderatorId, sockets] of this.moderatorSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.moderatorSockets.delete(moderatorId);
        }
        break;
      }
    }
  }

  @SubscribeMessage('claim-report')
  async handleClaimReport(
    client: Socket,
    payload: { reportId: string }
  ) {
    try {
      const user = await this.authService.validateSocketConnection(client);
      
      await this.claimReportUseCase.execute(
        new ClaimReportCommand(
          ReportId.fromString(payload.reportId),
          UserId.fromString(user.id)
        )
      );

      this.server.to('moderators').emit('report-claimed', {
        reportId: payload.reportId,
        moderatorId: user.id
      });

    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  async notifyNewReport(report: UserReport): Promise<void> {
    this.server.to('moderators').emit('new-report', {
      id: report.id.value,
      type: report.type,
      reason: report.reason,
      priority: this.calculatePriority(report),
      createdAt: report.createdAt
    });

    // Update queue stats
    const stats = await this.getModerationStats();
    this.server.to('moderators').emit('queue-stats', stats);
  }

  async notifyContentBlocked(contentId: ContentId, reason: string): Promise<void> {
    this.server.to('moderators').emit('content-blocked', {
      contentId: contentId.value,
      reason,
      timestamp: new Date()
    });
  }
}
```

## Tareas de Implementación

### Fase 1: Moderation Rules Engine (Días 1-3)

- [ ] Crear entities para reglas y condiciones
- [ ] Implementar sistema de evaluación de reglas
- [ ] Crear acciones de moderación básicas
- [ ] Configurar repositorios y base de datos

### Fase 2: Content Analysis (Días 4-6)

- [ ] Integrar servicios de análisis de contenido
- [ ] Implementar detección de toxicidad y spam
- [ ] Configurar análisis de imágenes (NSFW, violencia)
- [ ] Crear sistema de scoring de riesgo

### Fase 3: User Reports System (Días 7-8)

- [ ] Implementar sistema de reportes de usuarios
- [ ] Crear cola de moderación con prioridades
- [ ] Desarrollar panel de moderación
- [ ] Integrar con sistema de notificaciones

### Fase 4: Real-time Integration (Días 9-10)

- [ ] Crear WebSocket gateway para moderación
- [ ] Implementar moderación en tiempo real
- [ ] Configurar alertas automáticas
- [ ] Dashboard de métricas de moderación

### Fase 5: Advanced Features (Días 11-12)

- [ ] Sistema de apelaciones
- [ ] Machine learning para mejora continua
- [ ] Integración con servicios externos (Google Perspective API)
- [ ] Auditoría y compliance

## Testing

```typescript
// test/moderation/moderate-content.use-case.spec.ts
describe('ModerateContentUseCase', () => {
  let useCase: ModerateContentUseCase;
  let ruleRepository: MockType<IModerationRuleRepository>;
  let analysisService: MockType<ContentAnalysisService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ModerateContentUseCase,
        {
          provide: IModerationRuleRepository,
          useFactory: createMockRepository
        },
        {
          provide: ContentAnalysisService,
          useFactory: createMockService
        }
      ]
    }).compile();

    useCase = module.get(ModerateContentUseCase);
    ruleRepository = module.get(IModerationRuleRepository);
    analysisService = module.get(ContentAnalysisService);
  });

  it('should block content with high toxicity score', async () => {
    // Test implementation
  });

  it('should warn user for spam content', async () => {
    // Test implementation
  });

  it('should handle multiple rule violations', async () => {
    // Test implementation
  });
});
```

## Métricas de Moderación

### Content Moderation

- **Content Blocked Rate**: Porcentaje de contenido bloqueado
- **False Positive Rate**: Contenido bloqueado incorrectamente
- **False Negative Rate**: Contenido problemático no detectado
- **Average Response Time**: Tiempo promedio de respuesta a reportes
- **Moderator Workload**: Carga de trabajo por moderador

### User Behavior

- **Report Accuracy**: Precisión de reportes de usuarios
- **Repeat Offenders**: Usuarios con múltiples violaciones
- **Appeal Success Rate**: Tasa de éxito de apelaciones
- **Community Health Score**: Puntuación general de salud de la comunidad

Este sistema proporcionará control completo sobre el contenido y comportamiento en la plataforma, manteniendo un ambiente seguro y respetuoso para todos los usuarios.
