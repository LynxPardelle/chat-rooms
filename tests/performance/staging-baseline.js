import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTrend = new Trend('response_time');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'], // Error rate must be less than 10%
  },
};

const BASE_URL = __ENV.STAGING_BASE_URL || 'https://staging.chat-rooms.example.com';
const API_URL = BASE_URL.replace('staging.', 'api-staging.');

export default function () {
  // Test API health endpoint
  const healthResponse = http.get(`${API_URL}/health`);
  check(healthResponse, {
    'API health status is 200': (r) => r.status === 200,
    'API health response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  responseTrend.add(healthResponse.timings.duration);
  errorRate.add(healthResponse.status !== 200);

  // Test frontend loading
  const frontendResponse = http.get(BASE_URL);
  check(frontendResponse, {
    'Frontend status is 200': (r) => r.status === 200,
    'Frontend response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(frontendResponse.status !== 200);

  // Test WebSocket connection
  const wsUrl = API_URL.replace('https://', 'wss://');
  const wsResponse = ws.connect(wsUrl, function (socket) {
    socket.on('open', function open() {
      console.log('WebSocket connection opened');
      socket.send(JSON.stringify({ type: 'ping' }));
    });

    socket.on('message', function (message) {
      console.log('Received message:', message);
    });

    socket.on('close', function close() {
      console.log('WebSocket connection closed');
    });

    socket.on('error', function (e) {
      console.log('WebSocket error:', e.error());
      errorRate.add(1);
    });

    sleep(1);
    socket.close();
  });

  check(wsResponse, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'staging-performance-report.json': JSON.stringify(data, null, 2),
  };
}
