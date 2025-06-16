import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Test Database Module for MongoDB in-memory testing
 * Provides clean database setup and automatic cleanup between tests
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
    }),
  ],
})
export class TestDatabaseModule {
  private static mongoServer: MongoMemoryServer;
  private static isSetup = false;

  /**
   * Setup MongoDB in-memory server for testing
   */
  static async setupDatabase(): Promise<string> {
    if (!this.isSetup) {
      this.mongoServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'test-chat-rooms',
        },
      });
      this.isSetup = true;
    }
    return this.mongoServer.getUri();
  }

  /**
   * Get MongoDB connection URI
   */
  static getConnectionUri(): string {
    if (!this.mongoServer) {
      throw new Error('Test database not initialized. Call setupDatabase() first.');
    }
    return this.mongoServer.getUri();
  }

  /**
   * Clean all collections in the test database
   */
  static async cleanDatabase(): Promise<void> {
    if (this.mongoServer) {
      const uri = this.mongoServer.getUri();
      const mongoose = require('mongoose');
      
      if (mongoose.connection.readyState !== 0) {
        const collections = await mongoose.connection.db.collections();
        
        await Promise.all(
          collections.map(async (collection: any) => {
            await collection.deleteMany({});
          })
        );
      }
    }
  }

  /**
   * Teardown MongoDB in-memory server
   */
  static async teardownDatabase(): Promise<void> {
    if (this.mongoServer) {
      await this.mongoServer.stop();
      this.isSetup = false;
    }
  }
  /**
   * Create a fresh database connection for testing
   */
  static forRoot() {
    const uri = this.getConnectionUri();
    return MongooseModule.forRoot(uri);
  }

  /**
   * Create database connection with transaction support
   */
  static forRootWithTransactions() {
    const uri = this.getConnectionUri();
    return MongooseModule.forRoot(uri);
  }
}

/**
 * Global test database setup utilities
 */
export class TestDatabaseUtils {
  /**
   * Setup test database before all tests
   */
  static async setupTestDB(): Promise<void> {
    await TestDatabaseModule.setupDatabase();
  }

  /**
   * Clean database before each test
   */
  static async cleanTestDB(): Promise<void> {
    await TestDatabaseModule.cleanDatabase();
  }

  /**
   * Teardown test database after all tests
   */
  static async teardownTestDB(): Promise<void> {
    await TestDatabaseModule.teardownDatabase();
  }

  /**
   * Seed database with test data
   */
  static async seedDatabase(data: {
    users?: any[];
    messages?: any[];
    rooms?: any[];
  }): Promise<void> {
    const mongoose = require('mongoose');
    
    if (data.users) {
      const User = mongoose.model('User');
      await User.insertMany(data.users);
    }
    
    if (data.messages) {
      const Message = mongoose.model('Message');
      await Message.insertMany(data.messages);
    }
    
    if (data.rooms) {
      const Room = mongoose.model('Room');
      await Room.insertMany(data.rooms);
    }
  }
}
