import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModerationResult {
  id: string;
  decision: 'allow' | 'flag' | 'block' | 'review';
  confidence: number; // 0-1
  reasons: string[];
  flaggedContent?: {
    type: 'toxic' | 'spam' | 'harassment' | 'inappropriate' | 'pii';
    severity: 'low' | 'medium' | 'high' | 'critical';
    matches: string[];
  }[];
  suggestedAction?: string;
  reviewRequired: boolean;
  timestamp: number;
}

export interface ContentAnalysis {
  text: string;
  metadata: {
    userId: string;
    roomId: string;
    messageId?: string;
    userAgent?: string;
    timestamp: number;
  };
  toxicityScore: number;
  spamScore: number;
  sentimentScore: number;
  language: string;
  containsPII: boolean;
  riskFactors: string[];
}

export interface UserReport {
  id: string;
  reporterId: string;
  targetUserId: string;
  targetMessageId?: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'other';
  description: string;
  evidence?: string[];
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: number;
  reviewedBy?: string;
  resolution?: string;
}

export interface ModerationAction {
  id: string;
  type: 'warn' | 'mute' | 'kick' | 'ban' | 'delete_message' | 'edit_message';
  targetUserId: string;
  targetMessageId?: string;
  moderatorId: string;
  reason: string;
  duration?: number; // for temporary actions
  timestamp: number;
  reversed?: boolean;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  
  // In-memory storage (in production, use database)
  private readonly moderationResults = new Map<string, ModerationResult>();
  private readonly userReports = new Map<string, UserReport>();
  private readonly moderationActions = new Map<string, ModerationAction>();
  private readonly userViolations = new Map<string, number>(); // userId -> violation count
    // Content filtering patterns
  private readonly toxicPatterns = [
    /\bhate\b/i,
    /\bstupid\b/i,
    /\bidiot\b/i,
    /\bkill\s+yourself\b/i,
    /\bmoron\b/i,
    /\bf[u\*]ck\b/i,
    /\bsh[i\*]t\b/i,
    /\bdamn\b/i,
    // Add more sophisticated patterns
  ];
  
  private readonly spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /https?:\/\/[^\s]+/g, // Multiple URLs
    /\b(buy\s+now|click\s+here|limited\s+time)\b/i,
  ];
  
  private readonly piiPatterns = [
    /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Moderate content using AI and rule-based analysis
   */
  async moderateContent(
    content: string,
    metadata: ContentAnalysis['metadata']
  ): Promise<ModerationResult> {
    const analysis = await this.analyzeContent(content, metadata);
    const result = await this.makeDecision(analysis);
    
    // Store result
    this.moderationResults.set(result.id, result);
    
    // Update user violation count if content is problematic
    if (result.decision !== 'allow') {
      this.updateUserViolations(metadata.userId);
    }
    
    this.logger.debug(`Content moderated: ${result.decision} (confidence: ${result.confidence})`);
    return result;
  }

  /**
   * Submit user report
   */
  async submitReport(
    reporterId: string,
    targetUserId: string,
    reason: UserReport['reason'],
    description: string,
    targetMessageId?: string,
    evidence?: string[]
  ): Promise<UserReport> {
    const report: UserReport = {
      id: this.generateId(),
      reporterId,
      targetUserId,
      targetMessageId,
      reason,
      description,
      evidence,
      status: 'pending',
      priority: this.calculateReportPriority(targetUserId, reason),
      timestamp: Date.now()
    };

    this.userReports.set(report.id, report);
    
    // Auto-escalate for repeat offenders
    const violations = this.userViolations.get(targetUserId) || 0;
    if (violations > 3) {
      report.priority = 'urgent';
    }

    this.logger.log(`User report submitted: ${report.id} against user ${targetUserId}`);
    return report;
  }

  /**
   * Review user report (admin action)
   */
  async reviewReport(
    reportId: string,
    reviewerId: string,
    decision: 'dismiss' | 'warn' | 'mute' | 'ban',
    resolution: string
  ): Promise<UserReport | null> {
    const report = this.userReports.get(reportId);
    if (!report) return null;

    report.status = 'reviewed';
    report.reviewedBy = reviewerId;
    report.resolution = resolution;

    // Take moderation action if needed
    if (decision !== 'dismiss') {
      await this.takeModerationAction(
        decision,
        report.targetUserId,
        reviewerId,
        `Report resolution: ${resolution}`,
        report.targetMessageId
      );
    }

    this.logger.log(`Report ${reportId} reviewed by ${reviewerId}: ${decision}`);
    return report;
  }

  /**
   * Take moderation action
   */
  async takeModerationAction(
    type: ModerationAction['type'],
    targetUserId: string,
    moderatorId: string,
    reason: string,
    targetMessageId?: string,
    duration?: number
  ): Promise<ModerationAction> {
    const action: ModerationAction = {
      id: this.generateId(),
      type,
      targetUserId,
      targetMessageId,
      moderatorId,
      reason,
      duration,
      timestamp: Date.now()
    };

    this.moderationActions.set(action.id, action);

    // Execute the action (integrate with your user/message services)
    await this.executeAction(action);

    this.logger.log(`Moderation action taken: ${type} against user ${targetUserId}`);
    return action;
  }

  /**
   * Get moderation dashboard data
   */
  getModerationDashboard(timeRange: '24h' | '7d' | '30d' = '24h'): any {
    const cutoff = this.getTimeCutoff(timeRange);
    
    const recentResults = Array.from(this.moderationResults.values())
      .filter(r => r.timestamp > cutoff);
    
    const recentReports = Array.from(this.userReports.values())
      .filter(r => r.timestamp > cutoff);
    
    const recentActions = Array.from(this.moderationActions.values())
      .filter(a => a.timestamp > cutoff);

    return {
      overview: {
        totalReports: recentReports.length,
        pendingReports: recentReports.filter(r => r.status === 'pending').length,
        totalActions: recentActions.length,
        blockedContent: recentResults.filter(r => r.decision === 'block').length,
        flaggedContent: recentResults.filter(r => r.decision === 'flag').length
      },
      contentModeration: {
        byDecision: this.groupByDecision(recentResults),
        byType: this.groupByContentType(recentResults),
        topReasons: this.getTopReasons(recentResults)
      },
      userReports: {
        byReason: this.groupReportsByReason(recentReports),
        byPriority: this.groupReportsByPriority(recentReports),
        byStatus: this.groupReportsByStatus(recentReports)
      },
      moderationActions: {
        byType: this.groupActionsByType(recentActions),
        topModerators: this.getTopModerators(recentActions)
      },
      riskAnalysis: {
        repeatOffenders: this.getRepeatOffenders(),
        trendingViolations: this.getTrendingViolations(recentResults)
      }
    };
  }

  /**
   * Get pending reports for review
   */
  getPendingReports(priority?: UserReport['priority']): UserReport[] {
    const pending = Array.from(this.userReports.values())
      .filter(r => r.status === 'pending');
    
    if (priority) {
      return pending.filter(r => r.priority === priority);
    }
    
    return pending.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get user moderation history
   */
  getUserModerationHistory(userId: string): any {
    const reports = Array.from(this.userReports.values())
      .filter(r => r.targetUserId === userId);
    
    const actions = Array.from(this.moderationActions.values())
      .filter(a => a.targetUserId === userId);
    
    const violations = this.userViolations.get(userId) || 0;

    return {
      reports,
      actions,
      violationCount: violations,
      riskLevel: this.calculateUserRiskLevel(violations, reports, actions),
      recommendations: this.getUserRecommendations(violations, reports, actions)
    };
  }

  // Private helper methods

  private async analyzeContent(
    content: string,
    metadata: ContentAnalysis['metadata']
  ): Promise<ContentAnalysis> {
    const analysis: ContentAnalysis = {
      text: content,
      metadata,
      toxicityScore: this.calculateToxicityScore(content),
      spamScore: this.calculateSpamScore(content),
      sentimentScore: this.calculateSentimentScore(content),
      language: this.detectLanguage(content),
      containsPII: this.containsPII(content),
      riskFactors: []
    };

    // Add risk factors
    if (analysis.toxicityScore > 0.7) analysis.riskFactors.push('high_toxicity');
    if (analysis.spamScore > 0.8) analysis.riskFactors.push('spam_like');
    if (analysis.containsPII) analysis.riskFactors.push('contains_pii');
    
    // Check user history
    const violations = this.userViolations.get(metadata.userId) || 0;
    if (violations > 2) analysis.riskFactors.push('repeat_offender');

    return analysis;
  }

  private async makeDecision(analysis: ContentAnalysis): Promise<ModerationResult> {
    const result: ModerationResult = {
      id: this.generateId(),
      decision: 'allow',
      confidence: 0,
      reasons: [],
      flaggedContent: [],
      reviewRequired: false,
      timestamp: Date.now()
    };

    // Decision logic
    if (analysis.toxicityScore > 0.9 || analysis.spamScore > 0.9) {
      result.decision = 'block';
      result.confidence = Math.max(analysis.toxicityScore, analysis.spamScore);
      result.reasons.push(analysis.toxicityScore > 0.9 ? 'High toxicity detected' : 'Spam detected');
    } else if (analysis.toxicityScore > 0.7 || analysis.spamScore > 0.7 || analysis.containsPII) {
      result.decision = 'flag';
      result.confidence = Math.max(analysis.toxicityScore, analysis.spamScore, analysis.containsPII ? 0.8 : 0);
      if (analysis.toxicityScore > 0.7) result.reasons.push('Potentially toxic content');
      if (analysis.spamScore > 0.7) result.reasons.push('Potential spam');
      if (analysis.containsPII) result.reasons.push('Contains personal information');
    } else if (analysis.riskFactors.includes('repeat_offender')) {
      result.decision = 'review';
      result.confidence = 0.6;
      result.reasons.push('Content from user with previous violations');
      result.reviewRequired = true;
    }

    // Add flagged content details
    if (result.decision !== 'allow') {
      if (analysis.toxicityScore > 0.5) {
        result.flaggedContent?.push({
          type: 'toxic',
          severity: analysis.toxicityScore > 0.8 ? 'high' : 'medium',
          matches: this.findToxicMatches(analysis.text)
        });
      }
      
      if (analysis.spamScore > 0.5) {
        result.flaggedContent?.push({
          type: 'spam',
          severity: analysis.spamScore > 0.8 ? 'high' : 'medium',
          matches: this.findSpamMatches(analysis.text)
        });
      }
    }

    return result;
  }

  private calculateToxicityScore(content: string): number {
    let score = 0;
    let matches = 0;

    for (const pattern of this.toxicPatterns) {
      if (pattern.test(content)) {
        matches++;
        score += 0.3;
      }
    }

    // Additional heuristics
    const upperCaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (upperCaseRatio > 0.7) score += 0.2; // Excessive caps

    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount > 3) score += 0.1;

    return Math.min(score, 1);
  }

  private calculateSpamScore(content: string): number {
    let score = 0;

    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        score += 0.3;
      }
    }

    // Check for repetitive content
    if (content.length > 20 && new Set(content.toLowerCase().split('')).size < content.length * 0.3) {
      score += 0.4;
    }

    // Check for excessive links
    const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    if (linkCount > 2) score += 0.3;

    return Math.min(score, 1);
  }

  private calculateSentimentScore(content: string): number {
    // Simple sentiment analysis - in production, use ML model
    const positiveWords = ['good', 'great', 'awesome', 'love', 'like'];
    const negativeWords = ['bad', 'hate', 'terrible', 'awful', 'suck'];
    
    let score = 0;
    const words = content.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });

    return Math.max(-1, Math.min(1, score));
  }

  private detectLanguage(content: string): string {
    // Simple language detection - in production, use proper library
    return 'en';
  }

  private containsPII(content: string): boolean {
    return this.piiPatterns.some(pattern => pattern.test(content));
  }

  private findToxicMatches(content: string): string[] {
    const matches: string[] = [];
    this.toxicPatterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match) matches.push(match[0]);
    });
    return matches;
  }

  private findSpamMatches(content: string): string[] {
    const matches: string[] = [];
    this.spamPatterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match) matches.push(match[0]);
    });
    return matches;
  }

  private updateUserViolations(userId: string): void {
    const current = this.userViolations.get(userId) || 0;
    this.userViolations.set(userId, current + 1);
  }

  private calculateReportPriority(targetUserId: string, reason: UserReport['reason']): UserReport['priority'] {
    const violations = this.userViolations.get(targetUserId) || 0;
    
    if (reason === 'harassment' || violations > 5) return 'urgent';
    if (reason === 'inappropriate' || violations > 2) return 'high';
    if (violations > 0) return 'medium';
    return 'low';
  }

  private async executeAction(action: ModerationAction): Promise<void> {
    // This would integrate with your user management and messaging services
    switch (action.type) {
      case 'warn':
        // Send warning to user
        break;
      case 'mute':
        // Temporarily mute user
        break;
      case 'kick':
        // Remove user from room
        break;
      case 'ban':
        // Ban user from platform
        break;
      case 'delete_message':
        // Delete specific message
        break;
      case 'edit_message':
        // Edit/censor message content
        break;
    }
  }

  private getTimeCutoff(timeRange: string): number {
    const now = Date.now();
    switch (timeRange) {
      case '24h': return now - 86400000;
      case '7d': return now - 604800000;
      case '30d': return now - 2592000000;
      default: return now - 86400000;
    }
  }

  private groupByDecision(results: ModerationResult[]): any {
    const groups = { allow: 0, flag: 0, block: 0, review: 0 };
    results.forEach(r => groups[r.decision]++);
    return groups;
  }

  private groupByContentType(results: ModerationResult[]): any {
    const groups = { toxic: 0, spam: 0, inappropriate: 0, pii: 0 };
    results.forEach(r => {
      r.flaggedContent?.forEach(fc => groups[fc.type]++);
    });
    return groups;
  }

  private getTopReasons(results: ModerationResult[]): any[] {
    const reasonCounts = new Map<string, number>();
    results.forEach(r => {
      r.reasons.forEach(reason => {
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      });
    });

    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private groupReportsByReason(reports: UserReport[]): any {
    const groups = { spam: 0, harassment: 0, inappropriate: 0, other: 0 };
    reports.forEach(r => groups[r.reason]++);
    return groups;
  }

  private groupReportsByPriority(reports: UserReport[]): any {
    const groups = { low: 0, medium: 0, high: 0, urgent: 0 };
    reports.forEach(r => groups[r.priority]++);
    return groups;
  }

  private groupReportsByStatus(reports: UserReport[]): any {
    const groups = { pending: 0, reviewed: 0, resolved: 0, dismissed: 0 };
    reports.forEach(r => groups[r.status]++);
    return groups;
  }

  private groupActionsByType(actions: ModerationAction[]): any {
    const groups = { warn: 0, mute: 0, kick: 0, ban: 0, delete_message: 0, edit_message: 0 };
    actions.forEach(a => groups[a.type]++);
    return groups;
  }

  private getTopModerators(actions: ModerationAction[]): any[] {
    const moderatorCounts = new Map<string, number>();
    actions.forEach(a => {
      moderatorCounts.set(a.moderatorId, (moderatorCounts.get(a.moderatorId) || 0) + 1);
    });

    return Array.from(moderatorCounts.entries())
      .map(([moderatorId, count]) => ({ moderatorId, actionCount: count }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 5);
  }

  private getRepeatOffenders(): any[] {
    return Array.from(this.userViolations.entries())
      .filter(([_, count]) => count > 2)
      .map(([userId, violationCount]) => ({ userId, violationCount }))
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10);
  }

  private getTrendingViolations(results: ModerationResult[]): any[] {
    // Analyze trends in violation types
    return this.getTopReasons(results);
  }

  private calculateUserRiskLevel(
    violations: number,
    reports: UserReport[],
    actions: ModerationAction[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (violations > 10 || actions.some(a => a.type === 'ban')) return 'critical';
    if (violations > 5 || actions.some(a => a.type === 'kick')) return 'high';
    if (violations > 2 || reports.length > 3) return 'medium';
    return 'low';
  }

  private getUserRecommendations(
    violations: number,
    reports: UserReport[],
    actions: ModerationAction[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (violations > 5) {
      recommendations.push('Consider temporary ban');
    } else if (violations > 2) {
      recommendations.push('Increase monitoring');
    }
    
    if (reports.filter(r => r.reason === 'harassment').length > 1) {
      recommendations.push('Review for harassment pattern');
    }
    
    return recommendations;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
