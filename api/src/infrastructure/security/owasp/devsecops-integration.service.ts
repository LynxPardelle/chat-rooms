import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DevSecOpsConfig {
  enabled: boolean;
  pipelineSecurityChecks: boolean;
  secretsScanning: boolean;
  vulnerabilityGating: boolean;
  complianceChecks: boolean;
  securityTestAutomation: boolean;
  artifactSigning: boolean;
  securityBaselines: boolean;
}

export interface SecurityPipelineStage {
  name: string;
  stage: 'pre-commit' | 'build' | 'test' | 'security-scan' | 'deploy' | 'runtime';
  checks: SecurityCheck[];
  gating: boolean;
  required: boolean;
  timeout: number;
  retryPolicy: RetryPolicy;
}

export interface SecurityCheck {
  id: string;
  name: string;
  type: 'sast' | 'dast' | 'dependency' | 'secrets' | 'compliance' | 'infrastructure' | 'container';
  tool: string;
  config: any;
  thresholds: SecurityThresholds;
  enabled: boolean;
  blocking: boolean;
}

export interface SecurityThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
  failOnCritical: boolean;
  failOnHigh: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface PipelineSecurityResult {
  pipelineId: string;
  commitSha: string;
  branch: string;
  timestamp: Date;
  overallStatus: 'passed' | 'failed' | 'warning';
  stages: StageResult[];
  securityScore: number;
  violations: SecurityViolation[];
  artifacts: SecurityArtifact[];
  recommendations: string[];
}

export interface StageResult {
  stageName: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  duration: number;
  checks: CheckResult[];
  gateDecision: 'allow' | 'block' | 'warn';
}

export interface CheckResult {
  checkId: string;
  status: 'passed' | 'failed' | 'warning' | 'error';
  findings: SecurityFinding[];
  metrics: CheckMetrics;
  details: any;
}

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  cwe?: string;
  confidence: 'high' | 'medium' | 'low';
  remediation: string;
}

export interface CheckMetrics {
  executionTime: number;
  findingsCount: Record<string, number>;
  coverage: number;
  linesScanned: number;
}

export interface SecurityViolation {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  policy: string;
  description: string;
  remediation: string;
  blocking: boolean;
}

export interface SecurityArtifact {
  type: 'report' | 'sbom' | 'signature' | 'attestation';
  name: string;
  path: string;
  hash: string;
  signed: boolean;
  metadata: any;
}

export interface SecretsScanResult {
  scanId: string;
  timestamp: Date;
  filesScanned: number;
  secretsFound: SecretFinding[];
  status: 'clean' | 'violations' | 'critical';
}

export interface SecretFinding {
  id: string;
  type: 'api_key' | 'password' | 'token' | 'certificate' | 'connection_string';
  file: string;
  line: number;
  pattern: string;
  confidence: number;
  entropy: number;
  masked: string;
}

export interface InfrastructureSecurityCheck {
  checkId: string;
  timestamp: Date;
  target: 'dockerfile' | 'k8s_manifest' | 'terraform' | 'cloudformation';
  findings: InfrastructureFinding[];
  compliance: ComplianceCheck[];
}

export interface InfrastructureFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  resource: string;
  description: string;
  remediation: string;
  benchmark: string;
}

export interface ComplianceCheck {
  framework: string;
  control: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable';
  description: string;
  evidence: string[];
}

@Injectable()
export class DevSecOpsIntegrationService {
  private readonly logger = new Logger(DevSecOpsIntegrationService.name);
  private readonly config: DevSecOpsConfig;
  private readonly artifactsPath: string;
  private readonly reportsPath: string;
  private pipelineStages: Map<string, SecurityPipelineStage> = new Map();
  private pipelineResults: Map<string, PipelineSecurityResult> = new Map();

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('devsecops.enabled', true),
      pipelineSecurityChecks: this.configService.get<boolean>('devsecops.pipelineChecks', true),
      secretsScanning: this.configService.get<boolean>('devsecops.secretsScanning', true),
      vulnerabilityGating: this.configService.get<boolean>('devsecops.vulnerabilityGating', true),
      complianceChecks: this.configService.get<boolean>('devsecops.complianceChecks', true),
      securityTestAutomation: this.configService.get<boolean>('devsecops.securityTestAutomation', true),
      artifactSigning: this.configService.get<boolean>('devsecops.artifactSigning', false),
      securityBaselines: this.configService.get<boolean>('devsecops.securityBaselines', true)
    };

    this.artifactsPath = path.join(process.cwd(), 'security-artifacts');
    this.reportsPath = path.join(process.cwd(), 'security-reports');
    
    this.initializeDevSecOps();
  }

  private async initializeDevSecOps(): Promise<void> {
    try {
      await fs.mkdir(this.artifactsPath, { recursive: true });
      await fs.mkdir(this.reportsPath, { recursive: true });
      
      if (this.config.enabled) {
        await this.initializeSecurityPipeline();
        this.logger.log('DevSecOps integration service initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize DevSecOps service', error);
    }
  }

  private async initializeSecurityPipeline(): Promise<void> {
    const stages: SecurityPipelineStage[] = [
      {
        name: 'pre-commit-security',
        stage: 'pre-commit',
        checks: [
          {
            id: 'secrets-scan',
            name: 'Secrets Detection',
            type: 'secrets',
            tool: 'truffleHog',
            config: { entropy: true, regex: true },
            thresholds: { critical: 0, high: 0, medium: 5, low: 10, failOnCritical: true, failOnHigh: true },
            enabled: this.config.secretsScanning,
            blocking: true
          },
          {
            id: 'lint-security',
            name: 'Security Linting',
            type: 'sast',
            tool: 'eslint-security',
            config: { rules: ['security/*'] },
            thresholds: { critical: 0, high: 2, medium: 10, low: 20, failOnCritical: true, failOnHigh: false },
            enabled: true,
            blocking: false
          }
        ],
        gating: true,
        required: true,
        timeout: 300000, // 5 minutes
        retryPolicy: { maxRetries: 2, backoffMultiplier: 1.5, maxBackoffMs: 30000 }
      },
      {
        name: 'build-security',
        stage: 'build',
        checks: [
          {
            id: 'dependency-scan',
            name: 'Dependency Vulnerability Scan',
            type: 'dependency',
            tool: 'npm-audit',
            config: { level: 'moderate' },
            thresholds: { critical: 0, high: 3, medium: 10, low: 50, failOnCritical: true, failOnHigh: true },
            enabled: true,
            blocking: this.config.vulnerabilityGating
          },
          {
            id: 'sast-scan',
            name: 'Static Application Security Testing',
            type: 'sast',
            tool: 'sonarqube',
            config: { quality_gate: 'security' },
            thresholds: { critical: 0, high: 5, medium: 15, low: 30, failOnCritical: true, failOnHigh: true },
            enabled: true,
            blocking: this.config.vulnerabilityGating
          }
        ],
        gating: this.config.vulnerabilityGating,
        required: true,
        timeout: 900000, // 15 minutes
        retryPolicy: { maxRetries: 1, backoffMultiplier: 2, maxBackoffMs: 60000 }
      },
      {
        name: 'security-test',
        stage: 'test',
        checks: [
          {
            id: 'security-unit-tests',
            name: 'Security Unit Tests',
            type: 'sast',
            tool: 'jest',
            config: { testPattern: '*.security.spec.ts' },
            thresholds: { critical: 0, high: 0, medium: 0, low: 0, failOnCritical: true, failOnHigh: true },
            enabled: this.config.securityTestAutomation,
            blocking: true
          },
          {
            id: 'infrastructure-scan',
            name: 'Infrastructure Security Scan',
            type: 'infrastructure',
            tool: 'checkov',
            config: { frameworks: ['dockerfile', 'kubernetes'] },
            thresholds: { critical: 0, high: 2, medium: 5, low: 10, failOnCritical: true, failOnHigh: true },
            enabled: true,
            blocking: true
          }
        ],
        gating: true,
        required: this.config.securityTestAutomation,
        timeout: 600000, // 10 minutes
        retryPolicy: { maxRetries: 2, backoffMultiplier: 1.5, maxBackoffMs: 45000 }
      },
      {
        name: 'pre-deploy-security',
        stage: 'deploy',
        checks: [
          {
            id: 'container-scan',
            name: 'Container Security Scan',
            type: 'container',
            tool: 'trivy',
            config: { severity: 'HIGH,CRITICAL' },
            thresholds: { critical: 0, high: 5, medium: 15, low: 50, failOnCritical: true, failOnHigh: true },
            enabled: true,
            blocking: this.config.vulnerabilityGating
          },
          {
            id: 'compliance-check',
            name: 'Compliance Validation',
            type: 'compliance',
            tool: 'custom',
            config: { frameworks: ['OWASP', 'GDPR'] },
            thresholds: { critical: 0, high: 0, medium: 2, low: 5, failOnCritical: true, failOnHigh: true },
            enabled: this.config.complianceChecks,
            blocking: this.config.complianceChecks
          }
        ],
        gating: this.config.vulnerabilityGating,
        required: true,
        timeout: 1200000, // 20 minutes
        retryPolicy: { maxRetries: 1, backoffMultiplier: 2, maxBackoffMs: 120000 }
      }
    ];

    for (const stage of stages) {
      this.pipelineStages.set(stage.name, stage);
    }
  }

  async executePipelineStage(
    stageName: string,
    context: {
      pipelineId: string;
      commitSha: string;
      branch: string;
      sourceCode?: string;
    }
  ): Promise<StageResult> {
    const stage = this.pipelineStages.get(stageName);
    if (!stage) {
      throw new Error(`Unknown pipeline stage: ${stageName}`);
    }

    this.logger.log(`Executing security stage: ${stageName} for pipeline ${context.pipelineId}`);

    const startTime = Date.now();
    const checkResults: CheckResult[] = [];
    let stageStatus: 'passed' | 'failed' | 'warning' = 'passed';

    for (const check of stage.checks) {
      if (!check.enabled) {
        continue;
      }

      try {
        const checkResult = await this.executeSecurityCheck(check, context);
        checkResults.push(checkResult);

        if (checkResult.status === 'failed' && check.blocking) {
          stageStatus = 'failed';
        } else if (checkResult.status === 'warning' && stageStatus !== 'failed') {
          stageStatus = 'warning';
        }
      } catch (error) {
        this.logger.error(`Security check ${check.id} failed with error`, error);
        checkResults.push({
          checkId: check.id,
          status: 'error',
          findings: [],
          metrics: { executionTime: 0, findingsCount: {}, coverage: 0, linesScanned: 0 },
          details: { error: error.message }
        });
        
        if (check.blocking) {
          stageStatus = 'failed';
        }
      }
    }

    const duration = Date.now() - startTime;
    const gateDecision = this.makeGateDecision(stage, stageStatus, checkResults);

    const stageResult: StageResult = {
      stageName,
      status: stageStatus,
      duration,
      checks: checkResults,
      gateDecision
    };

    this.logger.log(`Security stage ${stageName} completed with status: ${stageStatus}, gate: ${gateDecision}`);

    return stageResult;
  }

  private async executeSecurityCheck(
    check: SecurityCheck,
    context: {
      pipelineId: string;
      commitSha: string;
      branch: string;
      sourceCode?: string;
    }
  ): Promise<CheckResult> {
    this.logger.debug(`Executing security check: ${check.id}`);

    const startTime = Date.now();
    
    try {
      let findings: SecurityFinding[] = [];

      switch (check.type) {
        case 'secrets':
          findings = await this.executeSecretsCheck(check, context);
          break;
        case 'sast':
          findings = await this.executeSastCheck(check, context);
          break;
        case 'dependency':
          findings = await this.executeDependencyCheck(check, context);
          break;
        case 'infrastructure':
          findings = await this.executeInfrastructureCheck(check, context);
          break;
        case 'container':
          findings = await this.executeContainerCheck(check, context);
          break;
        case 'compliance':
          findings = await this.executeComplianceCheck(check, context);
          break;
        default:
          throw new Error(`Unsupported check type: ${check.type}`);
      }

      const executionTime = Date.now() - startTime;
      const findingsCount = this.countFindingsBySeverity(findings);
      const status = this.determineCheckStatus(findings, check.thresholds);

      return {
        checkId: check.id,
        status,
        findings,
        metrics: {
          executionTime,
          findingsCount,
          coverage: 85, // Mock coverage percentage
          linesScanned: context.sourceCode ? context.sourceCode.split('\n').length : 0
        },
        details: {
          tool: check.tool,
          config: check.config,
          thresholds: check.thresholds
        }
      };
    } catch (error) {
      this.logger.error(`Security check ${check.id} execution failed`, error);
      throw error;
    }
  }

  private async executeSecretsCheck(
    check: SecurityCheck,
    context: any
  ): Promise<SecurityFinding[]> {
    // Mock secrets scanning - in real implementation, integrate with tools like:
    // - TruffleHog
    // - GitLeaks
    // - detect-secrets
    
    const mockFindings: SecurityFinding[] = [
      {
        id: 'SECRET-001',
        severity: 'high',
        category: 'Hardcoded Secret',
        title: 'API Key found in source code',
        description: 'Potential API key detected in configuration file',
        file: 'src/config/database.ts',
        line: 15,
        column: 20,
        confidence: 'medium',
        remediation: 'Move API key to environment variables or secure vault'
      }
    ];

    return mockFindings;
  }

  private async executeSastCheck(
    check: SecurityCheck,
    context: any
  ): Promise<SecurityFinding[]> {
    // Mock SAST scanning - in real implementation, integrate with:
    // - SonarQube
    // - CodeQL
    // - Semgrep
    // - ESLint Security plugin
    
    const mockFindings: SecurityFinding[] = [
      {
        id: 'SAST-001',
        severity: 'medium',
        category: 'Input Validation',
        title: 'Potential SQL Injection',
        description: 'User input used in SQL query without proper sanitization',
        file: 'src/services/user.service.ts',
        line: 42,
        column: 15,
        cwe: 'CWE-89',
        confidence: 'high',
        remediation: 'Use parameterized queries or ORM with proper escaping'
      }
    ];

    return mockFindings;
  }

  private async executeDependencyCheck(
    check: SecurityCheck,
    context: any
  ): Promise<SecurityFinding[]> {
    // Mock dependency scanning - in real implementation, integrate with:
    // - npm audit
    // - Snyk
    // - WhiteSource
    // - OWASP Dependency Check
    
    const mockFindings: SecurityFinding[] = [
      {
        id: 'DEP-001',
        severity: 'high',
        category: 'Vulnerable Dependency',
        title: 'Known vulnerability in lodash',
        description: 'lodash version 4.17.11 has known prototype pollution vulnerability',
        confidence: 'high',
        remediation: 'Update lodash to version 4.17.21 or higher'
      }
    ];

    return mockFindings;
  }

  private async executeInfrastructureCheck(
    check: SecurityCheck,
    context: any
  ): Promise<SecurityFinding[]> {
    // Mock infrastructure scanning - in real implementation, integrate with:
    // - Checkov
    // - Terrascan
    // - Trivy
    // - Falco
    
    const mockFindings: SecurityFinding[] = [
      {
        id: 'INFRA-001',
        severity: 'medium',
        category: 'Container Security',
        title: 'Container running as root',
        description: 'Dockerfile does not specify non-root user',
        file: 'Dockerfile',
        line: 10,
        confidence: 'high',
        remediation: 'Add USER directive to run container as non-root'
      }
    ];

    return mockFindings;
  }

  private async executeContainerCheck(
    check: SecurityCheck,
    context: any
  ): Promise<SecurityFinding[]> {
    // Mock container scanning - in real implementation, integrate with:
    // - Trivy
    // - Clair
    // - Anchore
    // - Aqua Security
    
    const mockFindings: SecurityFinding[] = [
      {
        id: 'CONTAINER-001',
        severity: 'critical',
        category: 'Base Image Vulnerability',
        title: 'Critical vulnerability in base image',
        description: 'Base image contains critical CVE-2023-1234',
        confidence: 'high',
        remediation: 'Update to latest base image version or apply security patches'
      }
    ];

    return mockFindings;
  }

  private async executeComplianceCheck(
    check: SecurityCheck,
    context: any
  ): Promise<SecurityFinding[]> {
    // Mock compliance checking - in real implementation, integrate with:
    // - Custom compliance rules
    // - Policy engines like OPA
    // - Compliance frameworks validation
    
    const mockFindings: SecurityFinding[] = [
      {
        id: 'COMPLIANCE-001',
        severity: 'low',
        category: 'GDPR Compliance',
        title: 'Missing data retention policy',
        description: 'No automated data retention policy implemented',
        confidence: 'high',
        remediation: 'Implement automated data retention and cleanup policies'
      }
    ];

    return mockFindings;
  }

  private countFindingsBySeverity(findings: SecurityFinding[]): Record<string, number> {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    findings.forEach(finding => {
      counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    });

    return counts;
  }

  private determineCheckStatus(
    findings: SecurityFinding[],
    thresholds: SecurityThresholds
  ): 'passed' | 'failed' | 'warning' {
    const counts = this.countFindingsBySeverity(findings);

    if (thresholds.failOnCritical && counts.critical > thresholds.critical) {
      return 'failed';
    }

    if (thresholds.failOnHigh && counts.high > thresholds.high) {
      return 'failed';
    }

    if (counts.critical > 0 || counts.high > thresholds.high || counts.medium > thresholds.medium) {
      return 'warning';
    }

    return 'passed';
  }

  private makeGateDecision(
    stage: SecurityPipelineStage,
    stageStatus: string,
    checkResults: CheckResult[]
  ): 'allow' | 'block' | 'warn' {
    if (!stage.gating) {
      return 'allow';
    }

    const blockingFailures = checkResults.filter(
      result => result.status === 'failed' && 
      stage.checks.find(check => check.id === result.checkId)?.blocking
    );

    if (blockingFailures.length > 0) {
      return 'block';
    }

    if (stageStatus === 'warning') {
      return 'warn';
    }

    return 'allow';
  }

  async generateSecurityArtifacts(
    pipelineId: string,
    stageResults: StageResult[]
  ): Promise<SecurityArtifact[]> {
    const artifacts: SecurityArtifact[] = [];

    // Generate security report
    const reportArtifact = await this.generateSecurityReport(pipelineId, stageResults);
    artifacts.push(reportArtifact);

    // Generate SBOM (Software Bill of Materials)
    if (this.config.artifactSigning) {
      const sbomArtifact = await this.generateSBOM(pipelineId);
      artifacts.push(sbomArtifact);
    }

    // Generate security attestation
    const attestationArtifact = await this.generateSecurityAttestation(pipelineId, stageResults);
    artifacts.push(attestationArtifact);

    return artifacts;
  }

  private async generateSecurityReport(
    pipelineId: string,
    stageResults: StageResult[]
  ): Promise<SecurityArtifact> {
    const report = {
      pipelineId,
      timestamp: new Date().toISOString(),
      stages: stageResults,
      summary: this.generateSecuritySummary(stageResults)
    };

    const reportPath = path.join(this.reportsPath, `security-report-${pipelineId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    const hash = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');

    return {
      type: 'report',
      name: `security-report-${pipelineId}.json`,
      path: reportPath,
      hash,
      signed: false,
      metadata: { stages: stageResults.length }
    };
  }

  private async generateSBOM(pipelineId: string): Promise<SecurityArtifact> {
    // Mock SBOM generation - in real implementation, integrate with tools like:
    // - Syft
    // - CycloneDX
    // - SPDX tools
    
    const sbom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        component: {
          type: 'application',
          name: 'chat-rooms-api',
          version: '1.0.0'
        }
      },
      components: [
        {
          type: 'library',
          name: '@nestjs/core',
          version: '11.0.1',
          scope: 'required'
        }
      ]
    };

    const sbomPath = path.join(this.artifactsPath, `sbom-${pipelineId}.json`);
    await fs.writeFile(sbomPath, JSON.stringify(sbom, null, 2));

    const hash = crypto.createHash('sha256').update(JSON.stringify(sbom)).digest('hex');

    return {
      type: 'sbom',
      name: `sbom-${pipelineId}.json`,
      path: sbomPath,
      hash,
      signed: this.config.artifactSigning,
      metadata: { components: sbom.components.length }
    };
  }

  private async generateSecurityAttestation(
    pipelineId: string,
    stageResults: StageResult[]
  ): Promise<SecurityArtifact> {
    const attestation = {
      _type: 'https://in-toto.io/Statement/v0.1',
      subject: [{ name: `chat-rooms-api-${pipelineId}` }],
      predicateType: 'https://slsa.dev/provenance/v0.2',
      predicate: {
        buildType: 'security-pipeline',
        builder: { id: 'chat-rooms-security-pipeline' },
        buildConfig: {
          stages: stageResults.map(stage => stage.stageName)
        },
        completeness: {
          parameters: true,
          environment: true,
          materials: true
        },
        reproducible: false
      }
    };

    const attestationPath = path.join(this.artifactsPath, `attestation-${pipelineId}.json`);
    await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));

    const hash = crypto.createHash('sha256').update(JSON.stringify(attestation)).digest('hex');

    return {
      type: 'attestation',
      name: `attestation-${pipelineId}.json`,
      path: attestationPath,
      hash,
      signed: this.config.artifactSigning,
      metadata: { buildType: 'security-pipeline' }
    };
  }

  private generateSecuritySummary(stageResults: StageResult[]): any {
    const totalChecks = stageResults.reduce((sum, stage) => sum + stage.checks.length, 0);
    const passedChecks = stageResults.reduce(
      (sum, stage) => sum + stage.checks.filter(check => check.status === 'passed').length,
      0
    );
    const failedChecks = stageResults.reduce(
      (sum, stage) => sum + stage.checks.filter(check => check.status === 'failed').length,
      0
    );

    const allFindings = stageResults.flatMap(stage => 
      stage.checks.flatMap(check => check.findings)
    );

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      securityScore: Math.round((passedChecks / totalChecks) * 100),
      totalFindings: allFindings.length,
      findingsBySeverity: this.countFindingsBySeverity(allFindings),
      blockedGates: stageResults.filter(stage => stage.gateDecision === 'block').length
    };
  }

  async getSecurityMetrics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    // Mock metrics - in real implementation, aggregate from actual pipeline results
    return {
      pipelinesExecuted: 42,
      averageSecurityScore: 87,
      vulnerabilitiesFound: 156,
      vulnerabilitiesFixed: 134,
      gateBlocks: 3,
      mttr: 4.2, // Mean Time to Remediation in hours
      trendData: {
        securityScores: [85, 87, 89, 87, 88, 86, 87],
        vulnerabilityCounts: [12, 8, 15, 6, 9, 11, 7]
      }
    };
  }

  async getComplianceStatus(): Promise<any> {
    return {
      frameworks: ['OWASP Top 10', 'NIST', 'ISO 27001'],
      overallCompliance: 92,
      lastAssessment: new Date(),
      nonCompliantItems: [
        'Missing security headers in production deployment',
        'Incomplete vulnerability disclosure process'
      ],
      nextAssessment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
}
