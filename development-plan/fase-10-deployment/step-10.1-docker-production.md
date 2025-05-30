# Step 10.1: Docker Production Configuration

## Overview

Configure production-ready Docker containers with optimized images, security hardening, and multi-stage builds for the Chat Rooms application deployment.

## Production Docker Architecture

### 1. Multi-Stage API Dockerfile

#### Optimized API Container

```dockerfile
# api/Dockerfile.prod
# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy additional files
COPY --chown=nestjs:nodejs scripts/ ./scripts/
COPY --chown=nestjs:nodejs uploads/ ./uploads/

# Set proper permissions
RUN chmod -R 755 /app && \
    chmod -R 777 /app/uploads && \
    chmod +x /app/scripts/*

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node dist/health-check.js

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]
```

#### Frontend Production Container

```dockerfile
# front/Dockerfile.prod
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build for production
RUN npm run build

# Production stage with Nginx
FROM nginx:1.25-alpine AS production

# Install security updates
RUN apk update && apk upgrade

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

# Copy SSL certificates (if using HTTPS)
COPY ssl/ /etc/nginx/ssl/

# Create nginx user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Production Nginx Configuration

#### Optimized Nginx Settings

```nginx
# front/nginx.prod.conf
upstream api_backend {
    server api:3000;
    keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=websocket:10m rate=5r/s;

# Connection limiting
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;

server {
    listen 80;
    server_name _;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' wss: ws:;" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Connection limiting
    limit_conn conn_limit_per_ip 20;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
        try_files $uri =404;
    }

    # Main application
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        
        # Security headers for HTML
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
    }

    # API proxy
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket proxy
    location /socket.io/ {
        limit_req zone=websocket burst=10 nodelay;
        
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Metrics endpoint (restricted access)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Production Docker Compose

#### Multi-Environment Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # MongoDB with replica set
  mongo-primary:
    image: mongo:7.0
    container_name: mongo-primary
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: ${MONGO_DATABASE}
    volumes:
      - mongo-primary-data:/data/db
      - ./scripts/mongo-init.sh:/docker-entrypoint-initdb.d/mongo-init.sh:ro
    networks:
      - app-network
    command: mongod --replSet rs0 --bind_ip_all
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh --quiet
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis with persistence
  redis:
    image: redis:7.2-alpine
    container_name: redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
    networks:
      - app-network
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # API service
  api:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    container_name: chat-rooms-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: mongodb://mongo-primary:27017/${MONGO_DATABASE}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_REGION: ${AWS_REGION}
      AWS_S3_BUCKET: ${AWS_S3_BUCKET}
      SENTRY_DSN: ${SENTRY_DSN}
      LOG_LEVEL: info
    volumes:
      - api-uploads:/app/uploads
      - api-logs:/app/logs
    networks:
      - app-network
    depends_on:
      mongo-primary:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "dist/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'

  # Frontend service
  frontend:
    build:
      context: ./front
      dockerfile: Dockerfile.prod
    container_name: chat-rooms-frontend
    restart: unless-stopped
    environment:
      NGINX_ENVSUBST_TEMPLATE_SUFFIX: .template
    volumes:
      - frontend-logs:/var/log/nginx
    networks:
      - app-network
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
        reservations:
          memory: 128M
          cpus: '0.1'

  # Load balancer (HAProxy)
  loadbalancer:
    image: haproxy:2.8-alpine
    container_name: haproxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8404:8404"  # HAProxy stats
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
      - ./ssl:/etc/ssl/certs:ro
    networks:
      - app-network
    depends_on:
      - frontend
    healthcheck:
      test: ["CMD", "haproxy", "-c", "-f", "/usr/local/etc/haproxy/haproxy.cfg"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Log aggregation
  fluent-bit:
    image: fluent/fluent-bit:2.2
    container_name: fluent-bit
    restart: unless-stopped
    volumes:
      - ./fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
      - api-logs:/var/log/api:ro
      - frontend-logs:/var/log/nginx:ro
    networks:
      - app-network
    depends_on:
      - api
      - frontend

  # Monitoring
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    networks:
      - app-network
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:10.1.0
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    networks:
      - app-network
    depends_on:
      - prometheus

volumes:
  mongo-primary-data:
    driver: local
  redis-data:
    driver: local
  api-uploads:
    driver: local
  api-logs:
    driver: local
  frontend-logs:
    driver: local
  prometheus-data:
    driver: local
  grafana-data:
    driver: local

networks:
  app-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
```

### 4. HAProxy Load Balancer Configuration

#### High Availability Configuration

```
# haproxy.cfg
global
    maxconn 4096
    log stdout local0
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

    # SSL configuration
    ssl-default-bind-ciphers ECDHE+AESGCM:ECDHE+CHACHA20:RSA+AESGCM:RSA+AES:!NULL:!MD5:!DSS
    ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets

defaults
    mode http
    log global
    option httplog
    option dontlognull
    option log-health-checks
    option forwardfor
    option http-server-close
    timeout connect 5000
    timeout client 50000
    timeout server 50000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

# Frontend for HTTP (redirect to HTTPS)
frontend http_frontend
    bind *:80
    redirect scheme https if !{ ssl_fc }

# Frontend for HTTPS
frontend https_frontend
    bind *:443 ssl crt /etc/ssl/certs/cert.pem
    
    # Security headers
    http-response set-header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    http-response set-header X-Frame-Options DENY
    http-response set-header X-Content-Type-Options nosniff
    http-response set-header X-XSS-Protection "1; mode=block"
    
    # Route to backend
    default_backend web_servers

# Backend for web servers
backend web_servers
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    
    server web1 frontend:80 check inter 2000 rise 2 fall 3
    # Add more servers for horizontal scaling
    # server web2 frontend2:80 check inter 2000 rise 2 fall 3

# Stats page
frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
```

### 5. Production Environment Configuration

#### Environment Variables

```bash
# .env.prod
# Application
NODE_ENV=production
PORT=3001
APP_VERSION=1.0.0

# Database
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-password
MONGO_DATABASE=livechat_prod
DATABASE_URL=mongodb://mongo-primary:27017/livechat_prod

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-very-secure-jwt-secret-key
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket

# Monitoring
SENTRY_DSN=your-sentry-dsn
GRAFANA_PASSWORD=your-grafana-password

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# External Services
SLACK_WEBHOOK_URL=your-slack-webhook
ELASTICSEARCH_URL=https://your-elasticsearch-url
```

### 6. Health Check Implementation

#### Comprehensive Health Checks

```typescript
// api/src/health-check.ts
import { createConnection } from 'mongoose';
import Redis from 'ioredis';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
    memory: boolean;
    disk: boolean;
  };
}

async function checkHealth(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemoryUsage(),
    disk: await checkDiskSpace(),
  };

  const isHealthy = Object.values(checks).every(check => check === true);

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  };
}

async function checkDatabase(): Promise<boolean> {
  try {
    const connection = await createConnection(process.env.DATABASE_URL);
    await connection.db.admin().ping();
    await connection.close();
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.ping();
    redis.disconnect();
    return true;
  } catch {
    return false;
  }
}

function checkMemoryUsage(): boolean {
  const usage = process.memoryUsage();
  const memoryUsagePercent = usage.heapUsed / usage.heapTotal;
  return memoryUsagePercent < 0.9; // Less than 90%
}

async function checkDiskSpace(): Promise<boolean> {
  try {
    const fs = require('fs');
    const stats = fs.statSync('/app');
    // Simple check - in production, use more sophisticated disk space monitoring
    return true;
  } catch {
    return false;
  }
}

// CLI execution
if (require.main === module) {
  checkHealth()
    .then((status) => {
      console.log(JSON.stringify(status, null, 2));
      process.exit(status.status === 'healthy' ? 0 : 1);
    })
    .catch((error) => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

export { checkHealth };
```

## Implementation Tasks

### Phase 1: Container Optimization (Week 1)

- [ ] Create multi-stage Dockerfiles for API and frontend
- [ ] Implement security hardening in containers
- [ ] Configure production Nginx settings
- [ ] Set up health check implementations

### Phase 2: Production Configuration (Week 2)

- [ ] Configure production Docker Compose
- [ ] Set up HAProxy load balancing
- [ ] Implement environment-specific configurations
- [ ] Create SSL/TLS certificate management

### Phase 3: Monitoring Integration (Week 3)

- [ ] Integrate Prometheus metrics collection
- [ ] Set up Grafana dashboards
- [ ] Configure log aggregation with Fluent Bit
- [ ] Implement comprehensive health checks

### Phase 4: Security and Optimization (Week 4)

- [ ] Implement container security scanning
- [ ] Configure resource limits and scaling
- [ ] Set up backup and recovery procedures
- [ ] Create deployment automation scripts

## Success Criteria

1. **Container Security**: All containers pass security scans with no high/critical vulnerabilities
2. **Performance**: Application startup time under 30 seconds
3. **Resource Efficiency**: Memory usage under 1GB per API instance
4. **Health Monitoring**: All services have functional health checks
5. **SSL/TLS**: Proper HTTPS configuration with A+ SSL rating
6. **High Availability**: Load balancer handles traffic distribution effectively

## Production Checklist

- [ ] Multi-stage Docker builds implemented
- [ ] Security hardening applied to all containers
- [ ] Production Nginx configuration optimized
- [ ] Load balancer configured for high availability
- [ ] Health checks implemented for all services
- [ ] SSL/TLS certificates properly configured
- [ ] Environment variables secured and managed
- [ ] Resource limits and scaling configured
- [ ] Monitoring and logging integrated
- [ ] Backup and recovery procedures established

This production Docker configuration ensures secure, scalable, and maintainable deployment of the Chat Rooms application with enterprise-grade reliability and performance.
