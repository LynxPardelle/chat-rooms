import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Chat Rooms E2E Tests
 * Comprehensive configuration for testing real-time chat application
 * with WebSocket support, authentication, and cross-browser testing
 */
export default defineConfig({
  // Test directory and patterns
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/utils/**',

  // Global test settings
  timeout: 30 * 1000, // 30 seconds - increased for WebSocket operations
  expect: { 
    timeout: 10 * 1000, // 10 seconds for assertions
    toHaveScreenshot: { threshold: 0.3 } // Screenshot comparison threshold
  },
  
  // Parallel execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4, // Reduced workers in CI for stability

  // Global setup and teardown
  globalSetup: './tests/e2e/utils/global-setup.ts',
  globalTeardown: './tests/e2e/utils/global-teardown.ts',

  // Reporter configuration
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['github'] as const] : [])
  ],

  // Output and artifacts
  outputDir: './test-results/artifacts',
  use: {
    // Base URL - configurable via environment
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:8080',
    
    // Browser settings
    headless: !!process.env.CI,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Context settings
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Action settings for WebSocket apps
    actionTimeout: 15 * 1000, // 15 seconds for actions
    navigationTimeout: 30 * 1000, // 30 seconds for navigation
  },

  // Project configurations for different browsers and scenarios
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup'
    },
    
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile devices
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },

    // Specific test scenarios
    {
      name: 'authenticated',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: './test-results/auth/user.json'
      },
      dependencies: ['setup'],
    }
  ],

  // Development server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
