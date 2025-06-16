import { Module } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { io, Socket } from 'socket.io-client';

/**
 * Test Utilities Module providing mock factories and test helpers
 */
@Module({
  providers: [JwtService],
  exports: [JwtService],
})
export class TestUtilitiesModule {}

/**
 * Factory for creating test User entities
 */
export class UserFactory {
  /**
   * Create a basic user for testing
   */
  static create(overrides: Partial<any> = {}): any {
    return {
      _id: new Types.ObjectId(),
      username: faker.internet.username(),
      email: faker.internet.email(),
      password: bcrypt.hashSync('password123', 10),
      displayName: faker.person.fullName(),
      avatar: faker.image.avatar(),
      isOnline: faker.datatype.boolean(),
      lastSeen: faker.date.recent(),
      status: faker.helpers.arrayElement(['ACTIVE', 'INACTIVE', 'BANNED']),
      personalizedMessageColor: faker.internet.color(),
      personalizedBackgroundColor: faker.internet.color(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Create multiple users
   */
  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create a user with specific role
   */
  static createWithRole(role: string, overrides: Partial<any> = {}): any {
    return this.create({
      role,
      ...overrides,
    });
  }

  /**
   * Create admin user
   */
  static createAdmin(overrides: Partial<any> = {}): any {
    return this.createWithRole('ADMIN', {
      username: 'admin',
      email: 'admin@test.com',
      ...overrides,
    });
  }
}

/**
 * Factory for creating test Message entities
 */
export class MessageFactory {
  /**
   * Create a basic message for testing
   */
  static create(overrides: Partial<any> = {}): any {
    return {
      _id: new Types.ObjectId(),
      content: faker.lorem.sentences(2),
      authorId: new Types.ObjectId(),
      roomId: new Types.ObjectId(),
      messageType: 'TEXT',
      timestamp: faker.date.recent(),
      isEdited: false,
      metadata: {
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
      },
      reactions: [],
      attachments: [],
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Create message with attachments
   */
  static createWithAttachment(overrides: Partial<any> = {}): any {
    return this.create({
      messageType: 'IMAGE',
      attachments: [
        {
          id: new Types.ObjectId(),
          filename: faker.system.fileName(),
          originalName: faker.system.fileName(),
          mimeType: 'image/jpeg',
          size: faker.number.int({ min: 1000, max: 5000000 }),
          url: faker.image.url(),
          uploadedAt: faker.date.recent(),
        },
      ],
      ...overrides,
    });
  }

  /**
   * Create multiple messages
   */
  static createMany(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

/**
 * Factory for creating test Room entities
 */
export class RoomFactory {
  /**
   * Create a basic room for testing
   */
  static create(overrides: Partial<any> = {}): any {
    return {
      _id: new Types.ObjectId(),
      name: faker.word.words(2),
      description: faker.lorem.sentence(),
      isPrivate: faker.datatype.boolean(),
      createdBy: new Types.ObjectId(),
      participants: [new Types.ObjectId(), new Types.ObjectId()],
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Create public room
   */
  static createPublic(overrides: Partial<any> = {}): any {
    return this.create({
      isPrivate: false,
      name: 'general',
      ...overrides,
    });
  }

  /**
   * Create private room
   */
  static createPrivate(overrides: Partial<any> = {}): any {
    return this.create({
      isPrivate: true,
      ...overrides,
    });
  }
}

/**
 * Factory for creating UserSettings entities
 */
export class UserSettingsFactory {
  /**
   * Create comprehensive user settings
   */
  static create(overrides: Partial<any> = {}): any {
    return {
      userId: new Types.ObjectId(),
      theme: {
        name: faker.helpers.arrayElement(['LIGHT', 'DARK', 'HIGH_CONTRAST', 'SEPIA']),
        customColors: {
          primary: faker.internet.color(),
          secondary: faker.internet.color(),
          background: faker.internet.color(),
        },
      },
      notifications: {
        desktop: faker.datatype.boolean(),
        sound: faker.datatype.boolean(),
        email: faker.datatype.boolean(),
      },
      accessibility: {
        fontSize: faker.number.float({ min: 0.5, max: 3.0 }),
        highContrast: faker.datatype.boolean(),
        reduceMotion: faker.datatype.boolean(),
      },
      privacy: {
        showOnlineStatus: faker.datatype.boolean(),
        allowDirectMessages: faker.datatype.boolean(),
      },
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }
}

/**
 * Authentication helpers for testing
 */
export class AuthTestHelper {
  private static jwtService = new JwtService({ secret: 'test-secret' });

  /**
   * Generate JWT token for testing
   */
  static generateJwtToken(payload: any): string {
    return this.jwtService.sign(payload, {
      secret: 'test-secret',
      expiresIn: '1h',
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: any): string {
    return this.jwtService.sign(payload, {
      secret: 'test-refresh-secret',
      expiresIn: '7d',
    });
  }

  /**
   * Create authenticated user with tokens
   */
  static createAuthenticatedUser(overrides: Partial<any> = {}): {
    user: any;
    accessToken: string;
    refreshToken: string;
  } {
    const user = UserFactory.create(overrides);
    const payload = { sub: user._id, username: user.username };
    
    return {
      user,
      accessToken: this.generateJwtToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Hash password for testing
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compare password for testing
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

/**
 * WebSocket testing utilities
 */
export class WebSocketTestHelper {
  private static clients: Socket[] = [];

  /**
   * Create WebSocket client for testing
   */
  static async createClient(token?: string): Promise<Socket> {
    const client = io('http://localhost:3001/chat', {
      auth: token ? { token } : undefined,
      forceNew: true,
    });

    this.clients.push(client);

    return new Promise((resolve, reject) => {
      client.on('connect', () => resolve(client));
      client.on('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  /**
   * Create authenticated WebSocket client
   */
  static async createAuthenticatedClient(user?: any): Promise<{ client: Socket; user: any; token: string }> {
    const authData = AuthTestHelper.createAuthenticatedUser(user);
    const client = await this.createClient(authData.accessToken);
    
    return {
      client,
      user: authData.user,
      token: authData.accessToken,
    };
  }

  /**
   * Disconnect all test clients
   */
  static disconnectAllClients(): void {
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });
    this.clients = [];
  }

  /**
   * Wait for event with timeout
   */
  static waitForEvent(client: Socket, event: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event ${event} timeout`));
      }, timeout);

      client.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
  /**
   * Create multiple authenticated clients
   */
  static async createMultipleClients(count: number): Promise<Array<{ client: Socket; user: any; token: string }>> {
    const clients: Array<{ client: Socket; user: any; token: string }> = [];
    
    for (let i = 0; i < count; i++) {
      const clientData = await this.createAuthenticatedClient();
      clients.push(clientData);
    }
    
    return clients;
  }
}

/**
 * File upload testing utilities
 */
export class FileTestHelper {
  /**
   * Create mock file buffer
   */
  static createMockImage(): Buffer {
    // Create a minimal 1x1 PNG
    return Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x25, 0xDB, 0x56, 0xCA, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
  }

  /**
   * Create mock file object
   */
  static createMockFile(filename = 'test.png', mimeType = 'image/png'): any {
    return {
      originalname: filename,
      mimetype: mimeType,
      buffer: this.createMockImage(),
      size: 1024,
    };
  }

  /**
   * Create large file for testing limits
   */
  static createLargeFile(sizeInMB: number): any {
    const buffer = Buffer.alloc(sizeInMB * 1024 * 1024);
    return {
      originalname: 'large-file.png',
      mimetype: 'image/png',
      buffer,
      size: buffer.length,
    };
  }
}
