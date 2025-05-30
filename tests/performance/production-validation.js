import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTrend = new Trend('response_time');
export const wsConnections = new Counter('websocket_connections');

export const options = {
  stages: [
    { duration: '1m', target: 20 },  // Ramp up to 20 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
    errors: ['rate<0.05'], // Error rate must be less than 5%
    websocket_connections: ['count>50'], // At least 50 WebSocket connections
  },
};

const BASE_URL = __ENV.PRODUCTION_BASE_URL || 'https://chat-rooms.example.com';
const API_URL = 'https://api.chat-rooms.example.com';

export default function () {
  // Critical path testing for production
  
  // 1. Health check
  const healthResponse = http.get(`${API_URL}/health`);
  check(healthResponse, {
    'Production health status is 200': (r) => r.status === 200,
    'Production health response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  responseTrend.add(healthResponse.timings.duration);
  errorRate.add(healthResponse.status !== 200);

  // 2. Database health
  const dbHealthResponse = http.get(`${API_URL}/health/database`);
  check(dbHealthResponse, {
    'Database health status is 200': (r) => r.status === 200,
    'Database health response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(dbHealthResponse.status !== 200);

  // 3. Redis health
  const redisHealthResponse = http.get(`${API_URL}/health/redis`);
  check(redisHealthResponse, {
    'Redis health status is 200': (r) => r.status === 200,
    'Redis health response time < 50ms': (r) => r.timings.duration < 50,
  });

  errorRate.add(redisHealthResponse.status !== 200);

  // 4. Frontend loading
  const frontendResponse = http.get(BASE_URL);
  check(frontendResponse, {
    'Production frontend status is 200': (r) => r.status === 200,
    'Production frontend response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(frontendResponse.status !== 200);

  // 5. Critical WebSocket functionality
  const wsUrl = API_URL.replace('https://', 'wss://');
  const wsResponse = ws.connect(wsUrl, function (socket) {
    socket.on('open', function open() {
      wsConnections.add(1);
      console.log('Production WebSocket connection opened');
      
      // Test critical chat functionality
      socket.send(JSON.stringify({ 
        type: 'join_room', 
        data: { roomId: 'test-room-' + Math.random() }
      }));
    });

    socket.on('message', function (message) {
      const data = JSON.parse(message);
      check(data, {
        'WebSocket message is valid': (msg) => msg && msg.type,
      });
    });

    socket.on('close', function close() {
      console.log('Production WebSocket connection closed');
    });

    socket.on('error', function (e) {
      console.log('Production WebSocket error:', e.error());
      errorRate.add(1);
    });

    sleep(2);
    socket.close();
  });

  check(wsResponse, {
    'Production WebSocket connection successful': (r) => r && r.status === 101,
  });

  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    metrics: {
      http_req_duration: data.metrics.http_req_duration,
      errors: data.metrics.errors,
      websocket_connections: data.metrics.websocket_connections,
    },
    thresholds: data.thresholds,
  };

  return {
    'production-performance-report.json': JSON.stringify(summary, null, 2),
    stdout: '\n=== Production Performance Validation ===\n' +
            `Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n` +
            `95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n` +
            `Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n` +
            `WebSocket Connections: ${data.metrics.websocket_connections.values.count}\n`,
  };
}
