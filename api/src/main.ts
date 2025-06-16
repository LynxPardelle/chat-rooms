import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { SanitizationInterceptor } from './infrastructure/interceptors/sanitization.interceptor';
import { CustomValidationPipe } from './infrastructure/pipes/custom-validation.pipe';
import { AppLoggerService } from './infrastructure/logging/app-logger.service';
import { SecurityMiddleware } from './infrastructure/security/owasp/security-clean.middleware';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as crypto from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get services from DI container
  const configService = app.get(ConfigService);
  const logger = new AppLoggerService('Bootstrap', configService);

  // Set custom logger
  app.useLogger(logger);

  // Apply comprehensive OWASP security middleware
  const securityMiddleware = app.get(SecurityMiddleware);
  app.use(securityMiddleware.use.bind(securityMiddleware));

  // Configuración de CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5174',
    credentials: true,
  });

  // Global filters - Enhanced with security features
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors - Enhanced with advanced sanitization
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new SanitizationInterceptor(logger),
  );

  // Global pipes - Enhanced with custom validators
  app.useGlobalPipes(
    new CustomValidationPipe(logger),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
    }),
  );

  // Configure Swagger/OpenAPI Documentation - Enterprise Grade
  const config = new DocumentBuilder()
    .setTitle('Chat Rooms API - Enterprise Documentation')
    .setDescription(`
      ## 🚀 Enterprise Real-time Chat Application API
      
      This API provides a comprehensive real-time messaging system with enterprise-grade features:
      
      ### 🔐 Authentication & Security
      - **JWT Authentication**: Bearer token with 15min access + 7d refresh tokens
      - **Role-Based Access Control**: Admin, User, Moderator roles
      - **Rate Limiting**: Progressive throttling with IP-based penalties
      - **Input Validation**: Comprehensive validation with XSS protection
      - **Audit Logging**: Complete security event tracking
      
      ### ⚡ Real-time Features
      - **WebSocket Gateway**: Socket.io with cluster support
      - **Message Broadcasting**: Real-time message delivery
      - **Typing Indicators**: Live typing status updates
      - **Presence System**: User online/offline status
      - **Room Management**: Dynamic room creation and management
      
      ### 📊 Enterprise Features
      - **Performance Monitoring**: Sub-100ms response times
      - **Health Checks**: Comprehensive system health endpoints
      - **Metrics Export**: Prometheus-compatible metrics
      - **Error Tracking**: Structured error responses with tracking IDs
      - **API Versioning**: Backward-compatible API evolution
      
      ### 🔧 Development Features
      - **Comprehensive Testing**: Unit, integration, and E2E test coverage
      - **Code Quality**: ESLint, Prettier, SonarQube integration
      - **Documentation**: Auto-generated from code annotations
      - **Debugging**: Request tracing and performance profiling
      
      ## 🔑 Authentication Guide
      
      ### 1. Obtain Access Token
      \`\`\`bash
      POST /auth/login
      {
        "username": "your-username",
        "password": "your-password"
      }
      \`\`\`
      
      ### 2. Use Bearer Token
      Include in Authorization header for all protected endpoints:
      \`Authorization: Bearer <your-access-token>\`
      
      ### 3. Refresh Token
      When access token expires, use refresh token:
      \`\`\`bash
      POST /auth/refresh
      {
        "refreshToken": "your-refresh-token"
      }
      \`\`\`
      
      ## 🌐 WebSocket Connection
      
      Connect to real-time features via Socket.io:
      \`\`\`javascript
      const socket = io('ws://localhost:3001', {
        auth: {
          token: 'your-jwt-token'
        }
      });
      \`\`\`
      
      ## 📈 Rate Limiting
      
      | Endpoint Category | Limit | Window |
      |-------------------|-------|--------|
      | Authentication | 5 requests | 15 minutes |
      | Messages | 30 requests | 1 minute |
      | File Upload | 10 requests | 5 minutes |
      | WebSocket Events | 60 requests | 1 minute |
      
      ## 🚨 Error Handling
      
      All errors follow RFC 7807 Problem Details format:
      \`\`\`json
      {
        "type": "/errors/validation-failed",
        "title": "Validation Failed",
        "status": 400,
        "detail": "Input validation failed",
        "instance": "/api/messages",
        "timestamp": "2024-01-01T00:00:00Z",
        "traceId": "abc123"
      }
      \`\`\`
      
      ## 📋 Support & Resources
      
      - **Status Page**: [status.livechat.example.com](https://status.livechat.example.com)
      - **Documentation**: [docs.livechat.example.com](https://docs.livechat.example.com)
      - **Support**: [support@livechat.example.com](mailto:support@livechat.example.com)
      - **GitHub**: [github.com/org/chat-rooms](https://github.com/org/chat-rooms)
    `)
    .setVersion('1.0.0')
    .setContact(
      'Chat Rooms Engineering Team', 
      'https://docs.livechat.example.com', 
      'engineering@livechat.example.com'
    )
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .setTermsOfService('https://livechat.example.com/terms')
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://staging-api.livechat.example.com', 'Staging Environment')
    .addServer('https://api.livechat.example.com', 'Production Environment')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT Authentication',
        description: 'Enter JWT access token (obtain from /auth/login)',
        in: 'header',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for service-to-service communication',
      },
      'API-Key'
    )
    .addTag('🔐 Authentication', 'User authentication, registration, and token management')
    .addTag('👥 Users', 'User profile management, preferences, and status')
    .addTag('💬 Messages', 'Chat message operations, history, and search')
    .addTag('🏠 Rooms', 'Chat room management and user membership')
    .addTag('📁 Files', 'File upload, download, and attachment management')
    .addTag('🔌 WebSocket', 'Real-time communication and event documentation')
    .addTag('📊 Health', 'System health, metrics, and monitoring endpoints')
    .addTag('🛡️ Security', 'Security configuration and audit endpoints')
    .addTag('🔧 Admin', 'Administrative operations and system management')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'tomorrow-night'
      },
      tryItOutEnabled: true,
      requestInterceptor: (req) => {
        // Add request ID for tracing
        req.headers['X-Request-ID'] = crypto.randomUUID();
        return req;
      },
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayOperationId: true,
      showMutatedRequest: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
    },
    customSiteTitle: 'Chat Rooms API - Enterprise Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.3/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.3/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.3/swagger-ui.min.css',
    ],
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info .title { color: #3b82f6; }
      .swagger-ui .scheme-container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      .swagger-ui .btn.authorize { background-color: #10b981; border-color: #10b981; }
      .swagger-ui .btn.authorize:hover { background-color: #059669; border-color: #059669; }
    `,
    explorer: true,
    swaggerUrl: '/api/docs-json'
  });

  // Puerto
  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Log information about the server
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Database: ${process.env.MONGO_URI || 'mongodb://localhost:27017/chat-rooms'}`);
  logger.log(`CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  logger.log('API is ready to accept connections!');
}

bootstrap().catch((error) => {
  const logger = new AppLoggerService('Bootstrap');
  logger.error('Failed to start the application:', error);
  process.exit(1);
});
