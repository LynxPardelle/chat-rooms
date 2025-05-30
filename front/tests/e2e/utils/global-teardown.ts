import { DatabaseHelper } from './database-helper';

/**
 * Global teardown for Playwright tests
 * Cleans up resources after all tests complete
 */
async function globalTeardown() {
  try {
    console.log('Running global teardown...');
      // Initialize database helper
    const dbHelper = new DatabaseHelper();
    
    // Connect and clean up test database
    await dbHelper.connect();
    await dbHelper.cleanDatabase();
    await dbHelper.disconnect();
    
    console.log('Global teardown completed successfully');
  } catch (error) {
    console.error('Global teardown failed:', error);
    // Don't throw - teardown failures shouldn't fail the overall test run
  }
}

export default globalTeardown;
