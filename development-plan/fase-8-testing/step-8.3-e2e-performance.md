# Step 8.3: E2E Performance Testing

## Overview
Implement comprehensive end-to-end performance testing and load testing strategies to ensure the chat application can handle expected user loads and maintain performance standards.

## Performance Testing Strategy

### 1. Load Testing Infrastructure

#### Load Testing Tools Setup
```javascript
// k6/load-test-config.js
import { check, group, sleep } from 'k6';
import ws from 'k6/ws';
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
    ws_connecting: ['p(95)<1000'],    // WebSocket connection under 1s
    ws_msgs_received: ['count>0'],    // WebSocket messages received
  },
};
```

#### User Authentication Load Test
```javascript
// k6/auth-load-test.js
export default function () {
  group('Authentication Flow', function () {
    // Login
    let loginResponse = http.post(`${BASE_URL}/auth/login`, {
      email: `user${__VU}@test.com`,
      password: 'testPassword123',
    });
    
    check(loginResponse, {
      'login successful': (r) => r.status === 200,
      'token received': (r) => r.json('token') !== undefined,
    });

    // Refresh token
    if (loginResponse.status === 200) {
      let token = loginResponse.json('token');
      let refreshResponse = http.post(`${BASE_URL}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      check(refreshResponse, {
        'refresh successful': (r) => r.status === 200,
      });
    }
    
    sleep(1);
  });
}
```

### 2. WebSocket Performance Testing

#### Real-time Messaging Load Test
```javascript
// k6/websocket-load-test.js
export default function () {
  const url = `ws://localhost:3001/ws?token=${getAuthToken()}`;
  
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      console.log('WebSocket connection opened');
      
      // Send messages at intervals
      socket.setInterval(function () {
        socket.send(JSON.stringify({
          type: 'message',
          content: `Test message from user ${__VU}`,
          channelId: 'test-channel',
        }));
      }, 2000);
    });

    socket.on('message', function (message) {
      const data = JSON.parse(message);
      check(data, {
        'message received': (d) => d.type === 'message',
        'message has content': (d) => d.content !== undefined,
      });
    });

    socket.on('close', function () {
      console.log('WebSocket connection closed');
    });

    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(res, { 'WebSocket connection successful': (r) => r && r.status === 101 });
}
```

#### Concurrent Users Simulation
```javascript
// k6/concurrent-users-test.js
export let options = {
  scenarios: {
    chat_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
    },
    file_uploaders: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
    },
  },
};

export default function () {
  if (__ITER < 100) {
    // Chat scenario
    chatScenario();
  } else {
    // File upload scenario
    fileUploadScenario();
  }
}
```

### 3. Database Performance Testing

#### MongoDB Performance Monitoring
```typescript
// test/performance/database-performance.test.ts
describe('Database Performance Tests', () => {
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongoConnection = await createTestDatabaseConnection();
  });

  describe('Message Queries', () => {
    it('should handle concurrent message inserts', async () => {
      const startTime = Date.now();
      const promises = Array(1000).fill(0).map((_, index) => 
        createMessage({
          content: `Test message ${index}`,
          channelId: 'test-channel',
          userId: `user-${index % 100}`,
        })
      );

      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000); // Under 5 seconds
    });

    it('should efficiently paginate messages', async () => {
      await seedMessages(10000); // Seed with 10k messages
      
      const startTime = Date.now();
      const messages = await getMessagesPaginated({
        channelId: 'test-channel',
        page: 1,
        limit: 50,
      });
      const duration = Date.now() - startTime;

      expect(messages).toHaveLength(50);
      expect(duration).toBeLessThan(100); // Under 100ms
    });
  });

  describe('User Queries', () => {
    it('should handle user presence updates efficiently', async () => {
      const users = Array(500).fill(0).map((_, i) => `user-${i}`);
      
      const startTime = Date.now();
      await updateUsersPresence(users, 'online');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Under 1 second
    });
  });
});
```

### 4. Frontend Performance Testing

#### Lighthouse CI Configuration
```javascript
// lighthouse-ci.js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      url: ['http://localhost:3001', 'http://localhost:3001/chat'],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-reports',
    },
  },
};
```

#### Bundle Size Analysis
```javascript
// vite.config.performance.ts
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@headlessui/react', 'framer-motion'],
          utils: ['date-fns', 'lodash-es'],
        },
      },
    },
  },
});
```

### 5. Memory and Resource Testing

#### Memory Leak Detection
```typescript
// test/performance/memory-leak.test.ts
describe('Memory Leak Detection', () => {
  it('should not leak memory during long chat sessions', async () => {
    const page = await browser.newPage();
    await page.goto('http://localhost:3001/chat');

    // Measure initial memory
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Simulate long chat session
    for (let i = 0; i < 1000; i++) {
      await page.evaluate((index) => {
        // Simulate receiving messages
        window.dispatchEvent(new CustomEvent('message', {
          detail: { content: `Message ${index}`, id: index }
        }));
      }, i);

      if (i % 100 === 0) {
        await page.waitForTimeout(100);
      }
    }

    // Force garbage collection
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });

    // Measure final memory
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseInMB = memoryIncrease / (1024 * 1024);

    expect(memoryIncreaseInMB).toBeLessThan(50); // Less than 50MB increase
  });
});
```

### 6. Performance Monitoring Dashboard

#### Real-time Performance Metrics
```typescript
// src/utils/performance-monitor.ts
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  measureRenderTime(componentName: string, renderFn: () => void) {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    
    this.recordMetric(`render.${componentName}`, end - start);
  }

  measureNetworkRequest(url: string, requestFn: () => Promise<any>) {
    const start = performance.now();
    return requestFn().finally(() => {
      const end = performance.now();
      this.recordMetric(`network.${url}`, end - start);
    });
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics() {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length > 0) {
        result[name] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p95: this.percentile(values, 0.95),
        };
      }
    }
    
    return result;
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

## Implementation Tasks

### Phase 1: Load Testing Setup (Week 1)
- [ ] Install and configure k6 for load testing
- [ ] Create authentication load test scenarios
- [ ] Set up WebSocket performance testing
- [ ] Configure database performance monitoring

### Phase 2: Frontend Performance (Week 2)
- [ ] Implement Lighthouse CI integration
- [ ] Set up bundle analysis and optimization
- [ ] Create memory leak detection tests
- [ ] Add performance monitoring utilities

### Phase 3: Comprehensive Testing (Week 3)
- [ ] Create concurrent user simulation tests
- [ ] Implement stress testing scenarios
- [ ] Set up performance regression testing
- [ ] Create performance dashboard

### Phase 4: Optimization and Monitoring (Week 4)
- [ ] Analyze test results and optimize bottlenecks
- [ ] Implement continuous performance monitoring
- [ ] Create performance alerts and thresholds
- [ ] Document performance benchmarks

## Success Criteria

1. **Load Testing**: System handles 200 concurrent users with <500ms response time
2. **WebSocket Performance**: Supports 500 concurrent WebSocket connections
3. **Database Performance**: Query response times under 100ms for common operations
4. **Frontend Performance**: Lighthouse score >80 for all categories
5. **Memory Usage**: No memory leaks during extended usage
6. **Bundle Size**: Total bundle size under 1MB gzipped

## Performance Benchmarks

- **Page Load Time**: <2 seconds for initial load
- **Message Delivery**: <100ms for real-time messages
- **File Upload**: Support for files up to 100MB with progress tracking
- **Search Response**: <200ms for message search queries
- **Concurrent Users**: Support for 1000+ concurrent users
- **Database Queries**: <50ms for simple queries, <200ms for complex queries

This comprehensive performance testing strategy ensures the chat application can handle production loads while maintaining excellent user experience.
