import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';

export interface SessionSecurityConfig {
  maxConcurrentSessions: number;
  sessionTimeout: number; // in milliseconds
  enableSessionRotation: boolean;
  enableDeviceTracking: boolean;
  enableLocationTracking: boolean;
  enforcePasswordPolicy: boolean;
  enableAccountLockout: boolean;
  maxFailedAttempts: number;
  lockoutDuration: number; // in milliseconds
  enableMFA: boolean;
  passwordHistoryCount: number;
  passwordExpirationDays: number;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  deviceId: string;
  userAgent: string;
  ipAddress: string;
  location?: GeoLocation;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  deviceFingerprint: string;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  coordinates?: { lat: number; lng: number };
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxRepeatingChars: number;
  forbidCommonPasswords: boolean;
  forbidPersonalInfo: boolean;
}

export interface AccountLockout {
  isLocked: boolean;
  lockReason: string;
  lockedAt?: Date;
  unlockAt?: Date;
  failedAttempts: number;
  lastFailedAttempt?: Date;
}

export interface MFAConfig {
  enabled: boolean;
  method: 'TOTP' | 'SMS' | 'EMAIL' | 'HARDWARE_KEY';
  secret?: string;
  backupCodes?: string[];
  lastUsed?: Date;
}

export interface AuthenticationResult {
  success: boolean;
  sessionId?: string;
  requiresMFA?: boolean;
  requiresPasswordChange?: boolean;
  warnings: string[];
  lockoutInfo?: AccountLockout;
}

@Injectable()
export class SessionAuthSecurityService {
  private readonly logger = new Logger(SessionAuthSecurityService.name);
  private readonly securityConfig: SessionSecurityConfig;
  private readonly passwordPolicy: PasswordPolicy;
  
  // In-memory stores (in production, these would be in Redis or database)
  private readonly activeSessions: Map<string, SessionInfo> = new Map();
  private readonly userSessions: Map<string, Set<string>> = new Map();
  private readonly accountLockouts: Map<string, AccountLockout> = new Map();
  private readonly passwordHistory: Map<string, string[]> = new Map();
  private readonly mfaConfigs: Map<string, MFAConfig> = new Map();
  private readonly deviceFingerprints: Map<string, string> = new Map();

  // Common passwords list (partial - in production, load from external source)
  private readonly commonPasswords = new Set([
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'superman',
  ]);

  constructor(private configService: ConfigService) {
    this.securityConfig = {
      maxConcurrentSessions: this.configService.get<number>('auth.maxConcurrentSessions', 3),
      sessionTimeout: this.configService.get<number>('auth.sessionTimeout', 3600000), // 1 hour
      enableSessionRotation: this.configService.get<boolean>('auth.enableSessionRotation', true),
      enableDeviceTracking: this.configService.get<boolean>('auth.enableDeviceTracking', true),
      enableLocationTracking: this.configService.get<boolean>('auth.enableLocationTracking', false),
      enforcePasswordPolicy: this.configService.get<boolean>('auth.enforcePasswordPolicy', true),
      enableAccountLockout: this.configService.get<boolean>('auth.enableAccountLockout', true),
      maxFailedAttempts: this.configService.get<number>('auth.maxFailedAttempts', 5),
      lockoutDuration: this.configService.get<number>('auth.lockoutDuration', 900000), // 15 minutes
      enableMFA: this.configService.get<boolean>('auth.enableMFA', false),
      passwordHistoryCount: this.configService.get<number>('auth.passwordHistoryCount', 5),
      passwordExpirationDays: this.configService.get<number>('auth.passwordExpirationDays', 90),
    };

    this.passwordPolicy = {
      minLength: this.configService.get<number>('password.minLength', 12),
      requireUppercase: this.configService.get<boolean>('password.requireUppercase', true),
      requireLowercase: this.configService.get<boolean>('password.requireLowercase', true),
      requireNumbers: this.configService.get<boolean>('password.requireNumbers', true),
      requireSymbols: this.configService.get<boolean>('password.requireSymbols', true),
      maxRepeatingChars: this.configService.get<number>('password.maxRepeatingChars', 2),
      forbidCommonPasswords: this.configService.get<boolean>('password.forbidCommonPasswords', true),
      forbidPersonalInfo: this.configService.get<boolean>('password.forbidPersonalInfo', true),
    };

    this.startSessionCleanup();
  }

  /**
   * Authenticates a user with enhanced security checks
   */
  async authenticateUser(
    username: string,
    password: string,
    userAgent: string,
    ipAddress: string,
    deviceFingerprint?: string
  ): Promise<AuthenticationResult> {
    const warnings: string[] = [];

    try {
      // Check account lockout
      const lockout = this.accountLockouts.get(username);
      if (lockout?.isLocked && lockout.unlockAt && new Date() < lockout.unlockAt) {
        return {
          success: false,
          warnings: ['Account is locked due to failed login attempts'],
          lockoutInfo: lockout,
        };
      }

      // Validate password (this would typically verify against database)
      const isValidPassword = await this.validatePassword(username, password);
      
      if (!isValidPassword) {
        await this.handleFailedLogin(username, ipAddress);
        return {
          success: false,
          warnings: ['Invalid credentials'],
          lockoutInfo: this.accountLockouts.get(username),
        };
      }

      // Clear failed attempts on successful login
      this.clearFailedAttempts(username);

      // Check password expiration
      const needsPasswordChange = await this.checkPasswordExpiration(username);
      if (needsPasswordChange) {
        warnings.push('Password has expired and must be changed');
      }

      // Check for suspicious login patterns
      const suspiciousLogin = await this.detectSuspiciousLogin(username, ipAddress, userAgent, deviceFingerprint);
      if (suspiciousLogin.isSuspicious) {
        warnings.push(...suspiciousLogin.reasons);
      }

      // Create session
      const sessionInfo = await this.createSession(username, userAgent, ipAddress, deviceFingerprint);

      // Check if MFA is required
      const mfaConfig = this.mfaConfigs.get(username);
      const requiresMFA = this.securityConfig.enableMFA && mfaConfig?.enabled;

      return {
        success: true,
        sessionId: sessionInfo.sessionId,
        requiresMFA,
        requiresPasswordChange: needsPasswordChange,
        warnings,
      };
    } catch (error) {
      this.logger.error('Authentication error:', error);
      return {
        success: false,
        warnings: ['Authentication system error'],
      };
    }
  }

  /**
   * Validates password against security policy
   */
  async validatePasswordPolicy(
    password: string,
    username?: string,
    userInfo?: { email: string; firstName: string; lastName: string }
  ): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    if (!this.securityConfig.enforcePasswordPolicy) {
      return { isValid: true, violations: [] };
    }

    // Length check
    if (password.length < this.passwordPolicy.minLength) {
      violations.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }

    // Character requirements
    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter');
    }

    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      violations.push('Password must contain at least one number');
    }

    if (this.passwordPolicy.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      violations.push('Password must contain at least one special character');
    }

    // Repeating characters check
    if (this.hasExcessiveRepeatingChars(password, this.passwordPolicy.maxRepeatingChars)) {
      violations.push(`Password cannot contain more than ${this.passwordPolicy.maxRepeatingChars} consecutive identical characters`);
    }

    // Common passwords check
    if (this.passwordPolicy.forbidCommonPasswords && this.commonPasswords.has(password.toLowerCase())) {
      violations.push('Password is too common and easily guessable');
    }

    // Personal information check
    if (this.passwordPolicy.forbidPersonalInfo && userInfo && username) {
      if (this.containsPersonalInfo(password, username, userInfo)) {
        violations.push('Password cannot contain personal information');
      }
    }

    // Password history check
    if (username) {
      const history = this.passwordHistory.get(username) || [];
      for (const oldPasswordHash of history) {
        if (await bcrypt.compare(password, oldPasswordHash)) {
          violations.push(`Password cannot be one of the last ${this.securityConfig.passwordHistoryCount} passwords used`);
          break;
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Sets up Multi-Factor Authentication for a user
   */
  async setupMFA(userId: string, method: 'TOTP' | 'SMS' | 'EMAIL' = 'TOTP'): Promise<{
    secret?: string;
    qrCode?: string;
    backupCodes: string[];
  }> {
    let secret: string | undefined;
    let qrCode: string | undefined;
    const backupCodes = this.generateBackupCodes();

    if (method === 'TOTP') {
      secret = authenticator.generateSecret();
      // QR code would be generated here using a QR code library
      qrCode = `otpauth://totp/LiveChat:${userId}?secret=${secret}&issuer=LiveChat`;
    }

    const mfaConfig: MFAConfig = {
      enabled: true,
      method,
      secret,
      backupCodes,
    };

    this.mfaConfigs.set(userId, mfaConfig);

    this.logger.log(`MFA setup completed for user ${userId} with method ${method}`);

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verifies MFA token
   */
  async verifyMFA(userId: string, token: string): Promise<{ isValid: boolean; reason?: string }> {
    const mfaConfig = this.mfaConfigs.get(userId);
    
    if (!mfaConfig?.enabled) {
      return { isValid: false, reason: 'MFA not enabled for user' };
    }

    // Check backup codes first
    if (mfaConfig.backupCodes?.includes(token)) {
      // Remove used backup code
      mfaConfig.backupCodes = mfaConfig.backupCodes.filter(code => code !== token);
      mfaConfig.lastUsed = new Date();
      return { isValid: true };
    }

    // Verify TOTP
    if (mfaConfig.method === 'TOTP' && mfaConfig.secret) {      const isValid = authenticator.verify({
        token,
        secret: mfaConfig.secret,
      });

      if (isValid) {
        mfaConfig.lastUsed = new Date();
        return { isValid: true };
      }
    }

    return { isValid: false, reason: 'Invalid MFA token' };
  }

  /**
   * Creates a new session with security tracking
   */
  async createSession(
    userId: string,
    userAgent: string,
    ipAddress: string,
    deviceFingerprint?: string
  ): Promise<SessionInfo> {
    // Generate secure session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Generate or use device fingerprint
    const finalDeviceFingerprint = deviceFingerprint || this.generateDeviceFingerprint(userAgent, ipAddress);
    
    // Get location info (would integrate with IP geolocation service)
    const location = await this.getLocationFromIP(ipAddress);

    const sessionInfo: SessionInfo = {
      sessionId,
      userId,
      deviceId: finalDeviceFingerprint,
      userAgent,
      ipAddress,
      location,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      deviceFingerprint: finalDeviceFingerprint,
    };

    // Store session
    this.activeSessions.set(sessionId, sessionInfo);

    // Track user sessions
    const userSessionSet = this.userSessions.get(userId) || new Set();
    userSessionSet.add(sessionId);
    this.userSessions.set(userId, userSessionSet);

    // Enforce concurrent session limit
    await this.enforceConcurrentSessionLimit(userId);

    this.logger.log(`Session created for user ${userId}: ${sessionId}`);

    return sessionInfo;
  }

  /**
   * Validates and updates session activity
   */
  async validateSession(sessionId: string): Promise<{ isValid: boolean; session?: SessionInfo; reason?: string }> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return { isValid: false, reason: 'Session not found' };
    }

    if (!session.isActive) {
      return { isValid: false, reason: 'Session is inactive' };
    }

    // Check session timeout
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
    
    if (timeSinceLastActivity > this.securityConfig.sessionTimeout) {
      await this.invalidateSession(sessionId, 'Session timeout');
      return { isValid: false, reason: 'Session expired' };
    }

    // Update last activity
    session.lastActivity = now;

    return { isValid: true, session };
  }

  /**
   * Invalidates a session
   */
  async invalidateSession(sessionId: string, reason: string = 'Manual logout'): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Mark as inactive
    session.isActive = false;

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Remove from user sessions
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
    }

    this.logger.log(`Session invalidated: ${sessionId} - ${reason}`);
    
    return true;
  }

  /**
   * Gets all active sessions for a user
   */
  getUserSessions(userId: string): SessionInfo[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    const sessions: SessionInfo[] = [];

    for (const sessionId of sessionIds) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Terminates all sessions for a user except the current one
   */
  async terminateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const userSessions = this.userSessions.get(userId) || new Set();
    let terminatedCount = 0;

    for (const sessionId of userSessions) {
      if (sessionId !== currentSessionId) {
        const success = await this.invalidateSession(sessionId, 'Terminated by user');
        if (success) {
          terminatedCount++;
        }
      }
    }

    this.logger.log(`Terminated ${terminatedCount} sessions for user ${userId}`);
    
    return terminatedCount;
  }

  private async validatePassword(username: string, password: string): Promise<boolean> {
    // In a real implementation, this would hash the password and compare with stored hash
    // For now, return true for demo purposes
    return password.length > 0;
  }

  private async handleFailedLogin(username: string, ipAddress: string): Promise<void> {
    if (!this.securityConfig.enableAccountLockout) {
      return;
    }

    let lockout = this.accountLockouts.get(username) || {
      isLocked: false,
      lockReason: '',
      failedAttempts: 0,
    };

    lockout.failedAttempts++;
    lockout.lastFailedAttempt = new Date();

    if (lockout.failedAttempts >= this.securityConfig.maxFailedAttempts) {
      lockout.isLocked = true;
      lockout.lockReason = 'Too many failed login attempts';
      lockout.lockedAt = new Date();
      lockout.unlockAt = new Date(Date.now() + this.securityConfig.lockoutDuration);
      
      this.logger.warn(`Account locked: ${username} from IP ${ipAddress}`);
    }

    this.accountLockouts.set(username, lockout);
  }

  private clearFailedAttempts(username: string): void {
    const lockout = this.accountLockouts.get(username);
    if (lockout) {
      lockout.failedAttempts = 0;
      lockout.isLocked = false;
      lockout.lockReason = '';
      lockout.lockedAt = undefined;
      lockout.unlockAt = undefined;
      lockout.lastFailedAttempt = undefined;
    }
  }

  private async checkPasswordExpiration(username: string): Promise<boolean> {
    // In a real implementation, check last password change date
    return false;
  }

  private async detectSuspiciousLogin(
    username: string,
    ipAddress: string,
    userAgent: string,
    deviceFingerprint?: string
  ): Promise<{ isSuspicious: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // Check for new device
    if (this.securityConfig.enableDeviceTracking && deviceFingerprint) {
      const knownDevice = this.deviceFingerprints.has(deviceFingerprint);
      if (!knownDevice) {
        reasons.push('Login from new device');
        this.deviceFingerprints.set(deviceFingerprint, username);
      }
    }

    // Check for unusual location (if location tracking is enabled)
    if (this.securityConfig.enableLocationTracking) {
      // This would check against user's typical locations
      // For now, skip implementation
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  }

  private async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    const userSessions = this.userSessions.get(userId) || new Set();
    
    if (userSessions.size > this.securityConfig.maxConcurrentSessions) {
      // Get oldest sessions and terminate them
      const sessions = Array.from(userSessions)
        .map(id => this.activeSessions.get(id))
        .filter(Boolean)
        .sort((a, b) => a!.createdAt.getTime() - b!.createdAt.getTime());

      const sessionsToTerminate = sessions.slice(0, sessions.length - this.securityConfig.maxConcurrentSessions);
      
      for (const session of sessionsToTerminate) {
        await this.invalidateSession(session!.sessionId, 'Concurrent session limit exceeded');
      }
    }
  }

  private hasExcessiveRepeatingChars(password: string, maxRepeating: number): boolean {
    let count = 1;
    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        count++;
        if (count > maxRepeating) {
          return true;
        }
      } else {
        count = 1;
      }
    }
    return false;
  }

  private containsPersonalInfo(
    password: string,
    username: string,
    userInfo: { email: string; firstName: string; lastName: string }
  ): boolean {
    const lowerPassword = password.toLowerCase();
    const personalData = [
      username.toLowerCase(),
      userInfo.email.toLowerCase().split('@')[0],
      userInfo.firstName.toLowerCase(),
      userInfo.lastName.toLowerCase(),
    ];

    return personalData.some(data => data.length > 2 && lowerPassword.includes(data));
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
    }
    return codes;
  }

  private generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const fingerprint = crypto
      .createHash('sha256')
      .update(userAgent + ipAddress)
      .digest('hex')
      .slice(0, 16);
    return fingerprint;
  }

  private async getLocationFromIP(ipAddress: string): Promise<GeoLocation | undefined> {
    // In a real implementation, use a geolocation service
    // For now, return undefined
    return undefined;
  }

  private startSessionCleanup(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;

      for (const [sessionId, session] of this.activeSessions.entries()) {
        const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
        
        if (timeSinceLastActivity > this.securityConfig.sessionTimeout) {
          this.invalidateSession(sessionId, 'Automatic cleanup - expired');
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
      }
    }, 300000); // 5 minutes
  }

  /**
   * Gets account lockout information
   */
  getAccountLockout(username: string): AccountLockout | undefined {
    return this.accountLockouts.get(username);
  }

  /**
   * Manually unlocks an account (admin function)
   */
  async unlockAccount(username: string, adminUserId: string): Promise<boolean> {
    const lockout = this.accountLockouts.get(username);
    
    if (!lockout || !lockout.isLocked) {
      return false;
    }

    lockout.isLocked = false;
    lockout.lockReason = '';
    lockout.failedAttempts = 0;
    lockout.lockedAt = undefined;
    lockout.unlockAt = undefined;

    this.logger.log(`Account manually unlocked: ${username} by admin ${adminUserId}`);
    
    return true;
  }
}
