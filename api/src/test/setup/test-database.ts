import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

export const setupTestDatabase = async (): Promise<string> => {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '7.0.14', // Use specific version to avoid re-downloading
        downloadDir: './mongodb-binaries', // Cache binaries locally
      },
      instance: {
        dbName: 'test_db',
        storageEngine: 'wiredTiger',
      },
    });
  }
  return mongoServer.getUri();
};

export const teardownTestDatabase = async (): Promise<void> => {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

export const getTestDatabaseUri = (): string => {
  if (!mongoServer) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }
  return mongoServer.getUri();
};
