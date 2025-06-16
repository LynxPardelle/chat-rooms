import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SecurityConfiguration {
  owasp: {
    enabled: boolean;
    cspEnabled: boolean;
    rateLimitEnabled: boolean;
    xssProtectionEnabled: boolean;
    sqlInjectionProtectionEnabled: boolean;
    csrfProtectionEnabled: boolean;
  };
  authentication: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
      maxRepeatingChars: number;
      forbidCommonPasswords: boolean;
    };
    mfa: {
      enabled: boolean;
      methods: string[];
      gracePeriodDays: number;
    };
    session: {
      timeout: number;
      maxConcurrentSessions: number;
      rotationEnabled: boolean;
    };
    lockout: {
      enabled: boolean;
      maxAttempts: number;
      duration: number;
    };
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    realTimeAlerting: boolean;
    incidentResponse: boolean;
  };
  compliance: {
    gdprEnabled: boolean;
    hipaaEnabled: boolean;
    pciDssEnabled: boolean;
    soc2Enabled: boolean;
    dataRetentionDays: number;
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
  };
  fileUpload: {
    enabled: boolean;
    maxFileSize: number;
    allowedTypes: string[];
    virusScanningEnabled: boolean;
    quarantineEnabled: boolean;
  };
  networkSecurity: {
    firewallEnabled: boolean;
    ddosProtectionEnabled: boolean;
    ipWhitelistEnabled: boolean;
    geoBlockingEnabled: boolean;
    vpnDetectionEnabled: boolean;
  };
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  effectiveDate: Date;
  expirationDate?: Date;
  configuration: SecurityConfiguration;
  approvedBy: string;
  status: 'draft' | 'active' | 'deprecated' | 'revoked';
}

export interface SecurityAlert {
  id: string;
  type: 'security_breach' | 'policy_violation' | 'compliance_issue' | 'system_vulnerability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  affectedSystems: string[];
  mitigationSteps: string[];
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: Date;
}

@Injectable()
export class SecurityConfigurationService {
  private readonly logger = new Logger(SecurityConfigurationService.name);
  private currentConfiguration: SecurityConfiguration;
  private activePolicy: SecurityPolicy | null = null;
  private readonly configurationHistory: SecurityPolicy[] = [];

  constructor(private configService: ConfigService) {
    this.initializeDefaultConfiguration();
    this.loadActivePolicy();
  }

  /**
   * Get current security configuration
   */
  getCurrentConfiguration(): SecurityConfiguration {
    return { ...this.currentConfiguration };
  }

  /**
   * Get active security policy
   */
  getActivePolicy(): SecurityPolicy | null {
    return this.activePolicy ? { ...this.activePolicy } : null;
  }

  /**
   * Update security configuration
   */
  async updateConfiguration(
    newConfig: Partial<SecurityConfiguration>,
    updatedBy: string,
    reason: string
  ): Promise<void> {
    this.logger.log(`Updating security configuration: ${reason}`);
    
    // Validate configuration
    await this.validateConfiguration(newConfig);
    
    // Create backup of current configuration
    await this.backupCurrentConfiguration(updatedBy, reason);
    
    // Apply new configuration
    this.currentConfiguration = {
      ...this.currentConfiguration,
      ...newConfig,
    };
    
    // Log configuration change
    await this.logConfigurationChange(newConfig, updatedBy, reason);
    
    this.logger.log('Security configuration updated successfully');
  }

  /**
   * Create new security policy
   */
  async createSecurityPolicy(
    name: string,
    description: string,
    configuration: SecurityConfiguration,
    approvedBy: string
  ): Promise<SecurityPolicy> {
    const policy: SecurityPolicy = {
      id: this.generatePolicyId(),
      name,
      description,
      version: '1.0.0',
      effectiveDate: new Date(),
      configuration,
      approvedBy,
      status: 'draft',
    };

    this.configurationHistory.push(policy);
    this.logger.log(`Created new security policy: ${name} (${policy.id})`);
    
    return { ...policy };
  }

  /**
   * Activate security policy
   */
  async activatePolicy(policyId: string, activatedBy: string): Promise<void> {
    const policy = this.configurationHistory.find(p => p.id === policyId);
    if (!policy) {
      throw new Error(`Security policy not found: ${policyId}`);
    }

    if (policy.status !== 'draft') {
      throw new Error(`Cannot activate policy with status: ${policy.status}`);
    }

    // Deactivate current policy
    if (this.activePolicy) {
      this.activePolicy.status = 'deprecated';
    }

    // Activate new policy
    policy.status = 'active';
    policy.effectiveDate = new Date();
    this.activePolicy = policy;
    this.currentConfiguration = { ...policy.configuration };

    this.logger.log(`Activated security policy: ${policy.name} (${policyId})`);
    await this.logPolicyActivation(policy, activatedBy);
  }

  /**
   * Generate security compliance report
   */
  async generateComplianceReport(): Promise<any> {
    const config = this.getCurrentConfiguration();
    
    const report = {
      timestamp: new Date(),
      policy: this.activePolicy,
      compliance: {
        owasp: await this.checkOwaspCompliance(config),
        gdpr: await this.checkGdprCompliance(config),
        hipaa: await this.checkHipaaCompliance(config),
        pci: await this.checkPciCompliance(config),
        soc2: await this.checkSoc2Compliance(config),
      },
      recommendations: await this.generateRecommendations(config),
      riskAssessment: await this.performRiskAssessment(config),
    };

    this.logger.log('Generated security compliance report');
    return report;
  }

  /**
   * Get security metrics and KPIs
   */
  async getSecurityMetrics(): Promise<any> {
    return {
      timestamp: new Date(),
      configuration: {
        activePolicies: this.configurationHistory.filter(p => p.status === 'active').length,
        lastUpdate: this.activePolicy?.effectiveDate,
        complianceScore: await this.calculateComplianceScore(),
      },
      security: {
        owaspCompliance: await this.checkOwaspCompliance(this.currentConfiguration),
        encryptionCoverage: this.calculateEncryptionCoverage(),
        authenticationStrength: this.calculateAuthStrength(),
        monitoringCoverage: this.calculateMonitoringCoverage(),
      },
      incidents: {
        total: 0, // Would come from monitoring service
        resolved: 0,
        averageResolutionTime: 0,
        criticalOpen: 0,
      }
    };
  }

  /**
   * Validate security configuration
   */
  private async validateConfiguration(config: Partial<SecurityConfiguration>): Promise<void> {
    // Validate password policy
    if (config.authentication?.passwordPolicy) {
      const policy = config.authentication.passwordPolicy;
      if (policy.minLength && policy.minLength < 8) {
        throw new Error('Password minimum length must be at least 8 characters');
      }
    }

    // Validate session timeout
    if (config.authentication?.session?.timeout) {
      const timeout = config.authentication.session.timeout;
      if (timeout < 300000 || timeout > 86400000) { // 5 minutes to 24 hours
        throw new Error('Session timeout must be between 5 minutes and 24 hours');
      }
    }

    // Validate file upload settings
    if (config.fileUpload?.maxFileSize) {
      const maxSize = config.fileUpload.maxFileSize;
      if (maxSize > 100 * 1024 * 1024) { // 100MB
        throw new Error('Maximum file size cannot exceed 100MB');
      }
    }

    this.logger.debug('Security configuration validation passed');
  }

  /**
   * Initialize default security configuration
   */
  private initializeDefaultConfiguration(): void {
    this.currentConfiguration = {
      owasp: {
        enabled: true,
        cspEnabled: true,
        rateLimitEnabled: true,
        xssProtectionEnabled: true,
        sqlInjectionProtectionEnabled: true,
        csrfProtectionEnabled: true,
      },
      authentication: {
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          maxRepeatingChars: 2,
          forbidCommonPasswords: true,
        },
        mfa: {
          enabled: false,
          methods: ['TOTP', 'SMS'],
          gracePeriodDays: 30,
        },
        session: {
          timeout: 3600000, // 1 hour
          maxConcurrentSessions: 3,
          rotationEnabled: true,
        },
        lockout: {
          enabled: true,
          maxAttempts: 5,
          duration: 900000, // 15 minutes
        },
      },
      monitoring: {
        enabled: true,
        logLevel: 'info',
        realTimeAlerting: true,
        incidentResponse: true,
      },
      compliance: {
        gdprEnabled: false,
        hipaaEnabled: false,
        pciDssEnabled: false,
        soc2Enabled: false,
        dataRetentionDays: 2555, // 7 years
        encryptionAtRest: true,
        encryptionInTransit: true,
      },
      fileUpload: {
        enabled: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        virusScanningEnabled: false,
        quarantineEnabled: false,
      },
      networkSecurity: {
        firewallEnabled: false,
        ddosProtectionEnabled: false,
        ipWhitelistEnabled: false,
        geoBlockingEnabled: false,
        vpnDetectionEnabled: false,
      },
    };
  }

  /**
   * Load active security policy
   */
  private loadActivePolicy(): void {
    // In production, this would load from database
    // For now, create a default policy
    const defaultPolicy: SecurityPolicy = {
      id: 'default-policy-001',
      name: 'Default Security Policy',
      description: 'Standard enterprise security configuration',
      version: '1.0.0',
      effectiveDate: new Date(),
      configuration: this.currentConfiguration,
      approvedBy: 'system',
      status: 'active',
    };

    this.activePolicy = defaultPolicy;
    this.configurationHistory.push(defaultPolicy);
  }

  private generatePolicyId(): string {
    return `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async backupCurrentConfiguration(updatedBy: string, reason: string): Promise<void> {
    // Implementation for backing up configuration
    this.logger.debug(`Backing up current configuration: ${reason}`);
  }

  private async logConfigurationChange(
    changes: Partial<SecurityConfiguration>,
    updatedBy: string,
    reason: string
  ): Promise<void> {
    this.logger.log(`Configuration changed by ${updatedBy}: ${reason}`, { changes });
  }

  private async logPolicyActivation(policy: SecurityPolicy, activatedBy: string): Promise<void> {
    this.logger.log(`Policy activated by ${activatedBy}: ${policy.name}`, { policyId: policy.id });
  }

  private async checkOwaspCompliance(config: SecurityConfiguration): Promise<boolean> {
    return config.owasp.enabled && config.owasp.cspEnabled && config.owasp.xssProtectionEnabled;
  }

  private async checkGdprCompliance(config: SecurityConfiguration): Promise<boolean> {
    return config.compliance.gdprEnabled && config.compliance.encryptionAtRest;
  }

  private async checkHipaaCompliance(config: SecurityConfiguration): Promise<boolean> {
    return config.compliance.hipaaEnabled && config.compliance.encryptionAtRest && config.compliance.encryptionInTransit;
  }

  private async checkPciCompliance(config: SecurityConfiguration): Promise<boolean> {
    return config.compliance.pciDssEnabled && config.authentication.passwordPolicy.minLength >= 12;
  }

  private async checkSoc2Compliance(config: SecurityConfiguration): Promise<boolean> {
    return config.compliance.soc2Enabled && config.monitoring.enabled;
  }

  private async generateRecommendations(config: SecurityConfiguration): Promise<string[]> {
    const recommendations: string[] = [];

    if (!config.authentication.mfa.enabled) {
      recommendations.push('Enable Multi-Factor Authentication for enhanced security');
    }

    if (!config.compliance.encryptionAtRest) {
      recommendations.push('Enable encryption at rest for sensitive data protection');
    }

    if (config.authentication.passwordPolicy.minLength < 12) {
      recommendations.push('Increase minimum password length to 12 characters');
    }

    return recommendations;
  }

  private async performRiskAssessment(config: SecurityConfiguration): Promise<any> {
    let riskScore = 0;
    const risks: string[] = [];

    if (!config.authentication.mfa.enabled) {
      riskScore += 20;
      risks.push('High risk: MFA not enabled');
    }

    if (!config.owasp.enabled) {
      riskScore += 30;
      risks.push('Critical risk: OWASP protections disabled');
    }

    if (!config.monitoring.enabled) {
      riskScore += 15;
      risks.push('Medium risk: Security monitoring disabled');
    }

    return {
      score: riskScore,
      level: riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low',
      risks,
    };
  }

  private async calculateComplianceScore(): Promise<number> {
    const config = this.currentConfiguration;
    let score = 0;
    let total = 0;

    // OWASP compliance (25 points)
    total += 25;
    if (await this.checkOwaspCompliance(config)) score += 25;

    // Authentication strength (25 points)
    total += 25;
    if (config.authentication.passwordPolicy.minLength >= 12) score += 10;
    if (config.authentication.mfa.enabled) score += 15;

    // Monitoring (25 points)
    total += 25;
    if (config.monitoring.enabled) score += 25;

    // Encryption (25 points)
    total += 25;
    if (config.compliance.encryptionAtRest) score += 15;
    if (config.compliance.encryptionInTransit) score += 10;

    return Math.round((score / total) * 100);
  }

  private calculateEncryptionCoverage(): number {
    const config = this.currentConfiguration;
    let coverage = 0;
    if (config.compliance.encryptionAtRest) coverage += 50;
    if (config.compliance.encryptionInTransit) coverage += 50;
    return coverage;
  }

  private calculateAuthStrength(): number {
    const config = this.currentConfiguration;
    let strength = 0;
    
    if (config.authentication.passwordPolicy.minLength >= 12) strength += 20;
    if (config.authentication.passwordPolicy.requireUppercase) strength += 15;
    if (config.authentication.passwordPolicy.requireLowercase) strength += 15;
    if (config.authentication.passwordPolicy.requireNumbers) strength += 15;
    if (config.authentication.passwordPolicy.requireSymbols) strength += 15;
    if (config.authentication.mfa.enabled) strength += 20;
    
    return strength;
  }

  private calculateMonitoringCoverage(): number {
    const config = this.currentConfiguration;
    let coverage = 0;
    
    if (config.monitoring.enabled) coverage += 40;
    if (config.monitoring.realTimeAlerting) coverage += 30;
    if (config.monitoring.incidentResponse) coverage += 30;
    
    return coverage;
  }
}
