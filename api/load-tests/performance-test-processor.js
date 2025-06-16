module.exports = {
  generateAuthToken,
  beforeRequest,
  afterResponse,
  $randomString,
  $pick
};

let requestCount = 0;
let responseCount = 0;
let errorCount = 0;
const responseTimes = [];

function generateAuthToken(context, events, done) {
  // In a real test, you would generate or fetch actual auth tokens
  // For this performance test, we'll use a mock token
  const mockToken = `perf-test-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  context.vars.authToken = mockToken;
  return done();
}

function beforeRequest(requestParams, context, ee, next) {
  requestCount++;
  requestParams.startTime = Date.now();
  
  // Add random delay to simulate real user behavior
  const delay = Math.random() * 100; // 0-100ms
  setTimeout(() => {
    next();
  }, delay);
}

function afterResponse(requestParams, response, context, ee, next) {
  responseCount++;
  
  if (requestParams.startTime) {
    const responseTime = Date.now() - requestParams.startTime;
    responseTimes.push(responseTime);
    
    // Track slow responses
    if (responseTime > 2000) {
      console.log(`Slow response detected: ${responseTime}ms for ${requestParams.url}`);
    }
  }
  
  // Track errors
  if (response.statusCode >= 400) {
    errorCount++;
    console.log(`Error response: ${response.statusCode} for ${requestParams.url}`);
  }
  
  // Log progress every 100 responses
  if (responseCount % 100 === 0) {
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const errorRate = (errorCount / responseCount) * 100;
    
    console.log(`Progress: ${responseCount} responses, avg: ${avgResponseTime.toFixed(2)}ms, errors: ${errorRate.toFixed(2)}%`);
  }
  
  next();
}

// Helper function to generate random strings
function $randomString() {
  return Math.random().toString(36).substring(2, 15);
}

// Helper function to pick random item from array
function $pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Print final statistics at the end
process.on('exit', () => {
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const errorRate = (errorCount / responseCount) * 100;
    
    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    console.log('\n=== Performance Test Summary ===');
    console.log(`Total requests: ${requestCount}`);
    console.log(`Total responses: ${responseCount}`);
    console.log(`Total errors: ${errorCount} (${errorRate.toFixed(2)}%)`);
    console.log(`Response times:`);
    console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Min: ${minResponseTime}ms`);
    console.log(`  Max: ${maxResponseTime}ms`);
    console.log(`  50th percentile: ${p50}ms`);
    console.log(`  95th percentile: ${p95}ms`);
    console.log(`  99th percentile: ${p99}ms`);
    console.log('================================\n');
  }
});
