import { chromium, FullConfig } from '@playwright/test';
import { DatabaseHelper } from './database-helper';
import { AuthHelper } from './auth-helper';

/**
 * Global Setup for E2E Tests
 * Initializes test environment, database, and creates authenticated sessions
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test environment setup...');

  // Initialize database helper
  const dbHelper = new DatabaseHelper();
  await dbHelper.connect();

  // Clean and seed test database
  console.log('🗄️ Preparing test database...');
  await dbHelper.cleanDatabase();
  await dbHelper.seedTestData();

  // Create authenticated browser context for tests
  console.log('🔐 Setting up authenticated session...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app and authenticate
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:8080';
  await page.goto(baseURL);

  // Create auth helper and login
  const authHelper = new AuthHelper(page);
  await authHelper.register({
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'Test123!',
    confirmPassword: 'Test123!'
  });

  // Save authenticated state
  await context.storageState({ path: './test-results/auth/user.json' });
  
  await browser.close();
  await dbHelper.disconnect();

  console.log('✅ E2E test environment setup completed');
}

export default globalSetup;
