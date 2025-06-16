import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GDPRComplianceConfig {
  enabled: boolean;
  dataRetentionDays: number;
  anonymizationEnabled: boolean;
  consentRequired: boolean;
  rightToErasure: boolean;
  dataPortability: boolean;
  auditLogging: boolean;
  privacyByDesign: boolean;
}

export interface PersonalDataRecord {
  id: string;
  userId: string;
  dataType: 'profile' | 'messages' | 'files' | 'analytics' | 'logs';
  data: any;
  purpose: string[];
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  retentionPeriod: Date;
  consentGiven: boolean;
  consentTimestamp?: Date;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  encryptionStatus: 'encrypted' | 'hashed' | 'pseudonymized' | 'plaintext';
  anonymized: boolean;
  lastAccessed: Date;
  accessLog: DataAccessLog[];
}

export interface DataAccessLog {
  timestamp: Date;
  accessor: string;
  purpose: string;
  ipAddress: string;
  userAgent: string;
  granted: boolean;
  reason?: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  dataTypes: string[];
  consentGiven: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  consentMethod: 'explicit' | 'implied' | 'opt_in' | 'opt_out';
  granular: boolean;
  withdrawable: boolean;
  version: string;
  expiryDate?: Date;
}

export interface DataProcessingActivity {
  id: string;
  name: string;
  description: string;
  controller: string;
  processor?: string;
  dataSubjects: string[];
  dataCategories: string[];
  purposes: string[];
  legalBasis: string;
  recipients: string[];
  thirdCountryTransfers: boolean;
  retentionPeriod: string;
  securityMeasures: string[];
  dpia: boolean; // Data Protection Impact Assessment
  lastReviewed: Date;
}

export interface PrivacyRights {
  rightOfAccess: boolean;
  rightOfRectification: boolean;
  rightOfErasure: boolean;
  rightToRestriction: boolean;
  rightToDataPortability: boolean;
  rightToObject: boolean;
  rightsRelatedToAutomatedDecisionMaking: boolean;
}

export interface ComplianceAuditReport {
  id: string;
  timestamp: Date;
  complianceFramework: 'GDPR' | 'CCPA' | 'PIPEDA' | 'LGPD';
  overallScore: number;
  compliantAreas: string[];
  nonCompliantAreas: string[];
  recommendations: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigationSteps: string[];
  };
  actionItems: ActionItem[];
}

export interface ActionItem {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  dueDate: Date;
  assignee: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
}

@Injectable()
export class CompliancePrivacyService {
  private readonly logger = new Logger(CompliancePrivacyService.name);
  private readonly config: GDPRComplianceConfig;
  private readonly auditPath: string;
  private personalDataRecords: Map<string, PersonalDataRecord> = new Map();
  private consentRecords: Map<string, ConsentRecord[]> = new Map();
  private dataProcessingActivities: Map<string, DataProcessingActivity> = new Map();

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('compliance.gdpr.enabled', true),
      dataRetentionDays: this.configService.get<number>('compliance.gdpr.retentionDays', 365),
      anonymizationEnabled: this.configService.get<boolean>('compliance.gdpr.anonymization', true),
      consentRequired: this.configService.get<boolean>('compliance.gdpr.consentRequired', true),
      rightToErasure: this.configService.get<boolean>('compliance.gdpr.rightToErasure', true),
      dataPortability: this.configService.get<boolean>('compliance.gdpr.dataPortability', true),
      auditLogging: this.configService.get<boolean>('compliance.gdpr.auditLogging', true),
      privacyByDesign: this.configService.get<boolean>('compliance.gdpr.privacyByDesign', true)
    };

    this.auditPath = path.join(process.cwd(), 'compliance-audits');
    this.initializeCompliance();
  }

  private async initializeCompliance(): Promise<void> {
    try {
      await fs.mkdir(this.auditPath, { recursive: true });
      
      if (this.config.enabled) {
        await this.scheduleDataRetentionCleanup();
        await this.initializeDataProcessingRegistry();
        this.logger.log('Compliance and privacy service initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize compliance service', error);
    }
  }

  async recordPersonalData(
    userId: string,
    dataType: string,
    data: any,
    purpose: string[],
    legalBasis: string
  ): Promise<PersonalDataRecord> {
    const recordId = this.generateRecordId();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + this.config.dataRetentionDays);

    const record: PersonalDataRecord = {
      id: recordId,
      userId,
      dataType: dataType as any,
      data: await this.encryptSensitiveData(data),
      purpose,
      legalBasis: legalBasis as any,
      retentionPeriod: retentionDate,
      consentGiven: await this.checkUserConsent(userId, purpose),
      dataClassification: this.classifyData(data),
      encryptionStatus: 'encrypted',
      anonymized: false,
      lastAccessed: new Date(),
      accessLog: []
    };

    this.personalDataRecords.set(recordId, record);
    
    if (this.config.auditLogging) {
      await this.logDataProcessingActivity('DATA_RECORDED', {
        recordId,
        userId,
        dataType,
        purpose,
        legalBasis
      });
    }

    this.logger.log(`Personal data recorded: ${recordId} for user ${userId}`);
    return record;
  }

  async recordConsent(
    userId: string,
    purpose: string,
    dataTypes: string[],
    consentGiven: boolean,
    metadata: {
      ipAddress: string;
      userAgent: string;
      consentMethod: string;
    }
  ): Promise<ConsentRecord> {
    const consentId = this.generateRecordId();
    
    const consent: ConsentRecord = {
      id: consentId,
      userId,
      purpose,
      dataTypes,
      consentGiven,
      timestamp: new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      consentMethod: metadata.consentMethod as any,
      granular: true,
      withdrawable: true,
      version: '1.0',
      expiryDate: this.calculateConsentExpiry()
    };

    if (!this.consentRecords.has(userId)) {
      this.consentRecords.set(userId, []);
    }
    this.consentRecords.get(userId)!.push(consent);

    await this.logDataProcessingActivity('CONSENT_RECORDED', {
      consentId,
      userId,
      purpose,
      consentGiven
    });

    this.logger.log(`Consent recorded: ${consentId} for user ${userId}, granted: ${consentGiven}`);
    return consent;
  }

  async processDataSubjectRequest(
    userId: string,
    requestType: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection',
    details?: any
  ): Promise<{
    requestId: string;
    status: 'received' | 'processing' | 'completed' | 'rejected';
    data?: any;
    timeline: string;
  }> {
    const requestId = this.generateRecordId();
    
    this.logger.log(`Processing data subject request: ${requestType} for user ${userId}`);

    let result: any = {
      requestId,
      status: 'processing' as const,
      timeline: 'Within 30 days as per GDPR Article 12'
    };

    try {
      switch (requestType) {
        case 'access':
          result.data = await this.handleAccessRequest(userId);
          break;
        case 'rectification':
          await this.handleRectificationRequest(userId, details);
          break;
        case 'erasure':
          await this.handleErasureRequest(userId);
          break;
        case 'restriction':
          await this.handleRestrictionRequest(userId);
          break;
        case 'portability':
          result.data = await this.handlePortabilityRequest(userId);
          break;
        case 'objection':
          await this.handleObjectionRequest(userId, details);
          break;
      }

      result.status = 'completed';
      
      await this.logDataProcessingActivity('DATA_SUBJECT_REQUEST', {
        requestId,
        userId,
        requestType,
        status: result.status
      });

    } catch (error) {
      result.status = 'rejected';
      this.logger.error(`Failed to process data subject request: ${requestId}`, error);
    }

    return result;
  }

  private async handleAccessRequest(userId: string): Promise<any> {
    const userRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.userId === userId);
    
    const consentHistory = this.consentRecords.get(userId) || [];
    
    return {
      personalData: userRecords.map(record => ({
        id: record.id,
        dataType: record.dataType,
        purpose: record.purpose,
        legalBasis: record.legalBasis,
        retentionPeriod: record.retentionPeriod,
        lastAccessed: record.lastAccessed,
        encrypted: record.encryptionStatus === 'encrypted'
      })),
      consentHistory,
      dataProcessingActivities: Array.from(this.dataProcessingActivities.values())
        .filter(activity => activity.dataSubjects.includes(userId))
    };
  }

  private async handleRectificationRequest(userId: string, updates: any): Promise<void> {
    const userRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.userId === userId);
    
    for (const record of userRecords) {
      if (updates[record.dataType]) {
        record.data = await this.encryptSensitiveData(updates[record.dataType]);
        record.lastAccessed = new Date();
        
        record.accessLog.push({
          timestamp: new Date(),
          accessor: 'SYSTEM_RECTIFICATION',
          purpose: 'Data rectification per user request',
          ipAddress: 'internal',
          userAgent: 'system',
          granted: true
        });
      }
    }
  }

  private async handleErasureRequest(userId: string): Promise<void> {
    if (!this.config.rightToErasure) {
      throw new Error('Right to erasure is not enabled');
    }

    const userRecords = Array.from(this.personalDataRecords.entries())
      .filter(([_, record]) => record.userId === userId);
    
    for (const [recordId, record] of userRecords) {
      // Check if erasure is legally permissible
      if (this.canEraseData(record)) {
        if (this.config.anonymizationEnabled) {
          await this.anonymizeRecord(record);
        } else {
          this.personalDataRecords.delete(recordId);
        }
      }
    }

    // Remove consent records
    this.consentRecords.delete(userId);
  }

  private async handleRestrictionRequest(userId: string): Promise<void> {
    const userRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.userId === userId);
    
    for (const record of userRecords) {
      // Mark records as restricted (implementation specific)
      record.data = { restricted: true, originalData: record.data };
    }
  }

  private async handlePortabilityRequest(userId: string): Promise<any> {
    const userRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.userId === userId && record.legalBasis === 'consent');
    
    const portableData = {
      userId,
      exportDate: new Date().toISOString(),
      data: userRecords.map(record => ({
        type: record.dataType,
        data: record.data,
        purpose: record.purpose,
        consentGiven: record.consentGiven
      })),
      format: 'JSON',
      version: '1.0'
    };

    return portableData;
  }

  private async handleObjectionRequest(userId: string, objectionDetails: any): Promise<void> {
    const userRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.userId === userId && record.legalBasis === 'legitimate_interests');
    
    // Stop processing based on legitimate interests unless compelling grounds exist
    for (const record of userRecords) {
      if (!this.hasCompellingGrounds(record, objectionDetails)) {
        await this.anonymizeRecord(record);
      }
    }
  }

  async performComplianceAudit(framework: 'GDPR' | 'CCPA' | 'PIPEDA' | 'LGPD' = 'GDPR'): Promise<ComplianceAuditReport> {
    const auditId = this.generateRecordId();
    
    this.logger.log(`Starting compliance audit: ${auditId} for ${framework}`);

    const compliantAreas: string[] = [];
    const nonCompliantAreas: string[] = [];
    const recommendations: string[] = [];
    const actionItems: ActionItem[] = [];

    // Audit data retention
    if (this.auditDataRetention()) {
      compliantAreas.push('Data Retention Policy');
    } else {
      nonCompliantAreas.push('Data Retention Policy');
      recommendations.push('Implement automated data retention cleanup');
    }

    // Audit consent management
    if (this.auditConsentManagement()) {
      compliantAreas.push('Consent Management');
    } else {
      nonCompliantAreas.push('Consent Management');
      recommendations.push('Enhance consent tracking and withdrawal mechanisms');
      actionItems.push({
        id: `${auditId}-1`,
        priority: 'high',
        category: 'Consent Management',
        description: 'Implement granular consent tracking',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        assignee: 'DPO',
        status: 'open'
      });
    }

    // Audit data subject rights
    if (this.auditDataSubjectRights()) {
      compliantAreas.push('Data Subject Rights');
    } else {
      nonCompliantAreas.push('Data Subject Rights');
      recommendations.push('Enhance data subject rights implementation');
    }

    // Audit data security
    if (this.auditDataSecurity()) {
      compliantAreas.push('Data Security');
    } else {
      nonCompliantAreas.push('Data Security');
      recommendations.push('Strengthen data encryption and access controls');
    }

    const overallScore = (compliantAreas.length / (compliantAreas.length + nonCompliantAreas.length)) * 100;
    
    const report: ComplianceAuditReport = {
      id: auditId,
      timestamp: new Date(),
      complianceFramework: framework,
      overallScore,
      compliantAreas,
      nonCompliantAreas,
      recommendations,
      riskAssessment: {
        level: overallScore > 80 ? 'low' : overallScore > 60 ? 'medium' : 'high',
        factors: nonCompliantAreas,
        mitigationSteps: recommendations
      },
      actionItems
    };

    await this.saveComplianceReport(report);
    
    this.logger.log(`Compliance audit completed: ${auditId}, score: ${overallScore}%`);
    
    return report;
  }

  private auditDataRetention(): boolean {
    const expiredRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.retentionPeriod < new Date());
    
    return expiredRecords.length === 0;
  }

  private auditConsentManagement(): boolean {
    // Check if all personal data has valid consent
    const recordsRequiringConsent = Array.from(this.personalDataRecords.values())
      .filter(record => record.legalBasis === 'consent');
    
    return recordsRequiringConsent.every(record => record.consentGiven);
  }

  private auditDataSubjectRights(): boolean {
    // Check if all required rights mechanisms are implemented
    const requiredRights: PrivacyRights = {
      rightOfAccess: true,
      rightOfRectification: true,
      rightOfErasure: this.config.rightToErasure,
      rightToRestriction: true,
      rightToDataPortability: this.config.dataPortability,
      rightToObject: true,
      rightsRelatedToAutomatedDecisionMaking: true
    };

    return Object.values(requiredRights).every(right => right);
  }

  private auditDataSecurity(): boolean {
    const unencryptedRecords = Array.from(this.personalDataRecords.values())
      .filter(record => record.encryptionStatus === 'plaintext');
    
    return unencryptedRecords.length === 0;
  }
  private async encryptSensitiveData(data: any): Promise<string> {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const key = this.configService.get<string>('encryption.key', 'default-key');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private classifyData(data: any): 'public' | 'internal' | 'confidential' | 'restricted' {
    // Basic classification logic - in real implementation, use ML or rules engine
    const dataString = JSON.stringify(data).toLowerCase();
    
    if (dataString.includes('password') || dataString.includes('ssn') || dataString.includes('credit_card')) {
      return 'restricted';
    } else if (dataString.includes('email') || dataString.includes('phone') || dataString.includes('address')) {
      return 'confidential';
    } else if (dataString.includes('name') || dataString.includes('age')) {
      return 'internal';
    }
    
    return 'public';
  }

  private async checkUserConsent(userId: string, purposes: string[]): Promise<boolean> {
    if (!this.config.consentRequired) return true;
    
    const userConsents = this.consentRecords.get(userId) || [];
    
    return purposes.every(purpose => 
      userConsents.some(consent => 
        consent.purpose === purpose && 
        consent.consentGiven && 
        (!consent.expiryDate || consent.expiryDate > new Date())
      )
    );
  }

  private canEraseData(record: PersonalDataRecord): boolean {
    // Check legal obligations that might prevent erasure
    return record.legalBasis !== 'legal_obligation' && 
           record.legalBasis !== 'public_task';
  }

  private hasCompellingGrounds(record: PersonalDataRecord, objectionDetails: any): boolean {
    // Determine if there are compelling legitimate grounds
    // This is a simplified implementation
    return record.purpose.includes('fraud_prevention') || 
           record.purpose.includes('legal_compliance');
  }

  private async anonymizeRecord(record: PersonalDataRecord): Promise<void> {
    record.data = this.anonymizeData(record.data);
    record.anonymized = true;
    record.encryptionStatus = 'pseudonymized';
    record.lastAccessed = new Date();
  }

  private anonymizeData(data: any): any {
    // Basic anonymization - in production, use more sophisticated techniques
    if (typeof data === 'string') {
      return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }
    
    return { anonymized: true, hash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex') };
  }

  private calculateConsentExpiry(): Date {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 2); // 2 years default
    return expiry;
  }

  private async scheduleDataRetentionCleanup(): Promise<void> {
    setInterval(async () => {
      await this.performDataRetentionCleanup();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private async performDataRetentionCleanup(): Promise<void> {
    this.logger.log('Performing data retention cleanup');
    
    const expiredRecords = Array.from(this.personalDataRecords.entries())
      .filter(([_, record]) => record.retentionPeriod < new Date());
    
    for (const [recordId, record] of expiredRecords) {
      if (this.config.anonymizationEnabled) {
        await this.anonymizeRecord(record);
      } else {
        this.personalDataRecords.delete(recordId);
      }
    }
    
    this.logger.log(`Data retention cleanup completed: ${expiredRecords.length} records processed`);
  }

  private async initializeDataProcessingRegistry(): Promise<void> {
    // Initialize with common data processing activities
    const activities: DataProcessingActivity[] = [
      {
        id: 'user-registration',
        name: 'User Registration',
        description: 'Processing user registration data',
        controller: 'Chat Rooms Application',
        dataSubjects: ['users'],
        dataCategories: ['identity', 'contact'],
        purposes: ['account_creation', 'authentication'],
        legalBasis: 'contract',
        recipients: ['internal_systems'],
        thirdCountryTransfers: false,
        retentionPeriod: '5 years after account closure',
        securityMeasures: ['encryption', 'access_controls', 'audit_logging'],
        dpia: false,
        lastReviewed: new Date()
      }
    ];

    for (const activity of activities) {
      this.dataProcessingActivities.set(activity.id, activity);
    }
  }

  private async logDataProcessingActivity(activity: string, details: any): Promise<void> {
    if (!this.config.auditLogging) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      activity,
      details,
      userId: details.userId || 'system'
    };
    
    this.logger.log(`Data processing activity: ${activity}`, logEntry);
  }

  private async saveComplianceReport(report: ComplianceAuditReport): Promise<void> {
    const filePath = path.join(this.auditPath, `compliance-audit-${report.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  }

  private generateRecordId(): string {
    return `GDPR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async getPrivacyPolicy(): Promise<any> {
    return {
      version: '1.0',
      lastUpdated: new Date(),
      dataController: 'Chat Rooms Application',
      purposes: Array.from(new Set(
        Array.from(this.personalDataRecords.values()).flatMap(r => r.purpose)
      )),
      dataTypes: Array.from(new Set(
        Array.from(this.personalDataRecords.values()).map(r => r.dataType)
      )),
      retentionPeriods: `${this.config.dataRetentionDays} days`,
      rightsAvailable: this.getAvailableRights(),
      contactInfo: {
        dpo: 'dpo@example.com',
        support: 'privacy@example.com'
      }
    };
  }

  private getAvailableRights(): string[] {
    const rights = ['access', 'rectification'];
    if (this.config.rightToErasure) rights.push('erasure');
    if (this.config.dataPortability) rights.push('portability');
    rights.push('restriction', 'objection');
    return rights;
  }
}
