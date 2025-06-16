import { jest } from '@jest/globals';

// Set global timeout for all tests
jest.setTimeout(60000);

// Setup to handle MongoDB Memory Server downloads
beforeAll(async () => {
  // Set environment variables to optimize MongoDB Memory Server
  process.env.MONGOMS_DOWNLOAD_DIR = './mongodb-binaries';
  process.env.MONGOMS_VERSION = '7.0.14';
  process.env.MONGOMS_DISABLE_POSTINSTALL = 'true';
});
