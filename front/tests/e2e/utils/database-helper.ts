import { MongoClient, Db, ObjectId } from 'mongodb';

/**
 * Database Helper for E2E Tests
 * Handles test database operations, cleanup, and data seeding
 */
export class DatabaseHelper {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private readonly connectionString: string;
  private readonly databaseName: string;

  constructor() {
    this.connectionString = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017';
    this.databaseName = process.env.TEST_DB_NAME || 'chat-rooms-test';
  }

  /**
   * Connect to test database
   */
  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      console.log(`✅ Connected to test database: ${this.databaseName}`);
    } catch (error) {
      console.error('❌ Failed to connect to test database:', error);
      throw error;
    }
  }

  /**
   * Disconnect from test database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('✅ Disconnected from test database');
    }
  }

  /**
   * Clean all test data from database
   */
  async cleanDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    const collections = ['users', 'messages', 'rooms', 'attachments'];
    
    for (const collectionName of collections) {
      try {
        await this.db.collection(collectionName).deleteMany({});
        console.log(`🧹 Cleaned collection: ${collectionName}`);
      } catch (error) {
        console.warn(`⚠️ Could not clean collection ${collectionName}:`, error);
      }
    }
  }

  /**
   * Seed test database with initial data
   */
  async seedTestData(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');    // Create default room
    await this.db.collection('rooms').insertOne({
      _id: new ObjectId(),
      name: 'General',
      description: 'General chat room',
      isPrivate: false,
      maxUsers: 100,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('🌱 Test data seeded successfully');
  }

  /**
   * Create test user directly in database
   */
  async createTestUser(userData: {
    username: string;
    email: string;
    password: string;
    isOnline?: boolean;
  }): Promise<string> {
    if (!this.db) throw new Error('Database not connected');

    const user = {
      username: userData.username,
      email: userData.email,
      password: userData.password, // Note: In real app this would be hashed
      avatar: 'default',
      textColor: '#000000',
      backgroundColor: '#ffffff',
      isOnline: userData.isOnline || false,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection('users').insertOne(user);
    return result.insertedId.toString();
  }

  /**
   * Create test message directly in database
   */
  async createTestMessage(messageData: {
    content: string;
    userId: string;
    roomId?: string;
    messageType?: string;
  }): Promise<string> {
    if (!this.db) throw new Error('Database not connected');

    const message = {
      content: messageData.content,
      userId: messageData.userId,
      roomId: messageData.roomId || 'general',
      messageType: messageData.messageType || 'TEXT',
      attachments: [],
      reactions: [],
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection('messages').insertOne(message);
    return result.insertedId.toString();
  }

  /**
   * Get collection for direct queries
   */
  getCollection(name: string) {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection(name);
  }

  /**
   * Get messages by filters
   */
  async getMessages(filter: {
    userId?: string;
    roomId?: string;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt';
    sortOrder?: 1 | -1;
  } = {}): Promise<any[]> {
    if (!this.db) throw new Error('Database not connected');

    const query: any = {};
    if (filter.userId) query.userId = filter.userId;
    if (filter.roomId) query.roomId = filter.roomId;

    const cursor = this.db.collection('messages').find(query);
    
    if (filter.sortBy) {
      cursor.sort({ [filter.sortBy]: filter.sortOrder || -1 });
    }
    
    if (filter.limit) {
      cursor.limit(filter.limit);
    }

    return await cursor.toArray();
  }

  /**
   * Count documents in collection
   */
  async countDocuments(collectionName: string, filter: any = {}): Promise<number> {
    if (!this.db) throw new Error('Database not connected');
    return await this.db.collection(collectionName).countDocuments(filter);
  }
}
