# Step 8.1: Testing Integral del Backend

## Objetivos

- Implementar suite completa de testing para el backend
- Configurar testing de integración con base de datos
- Desarrollar tests de performance y carga
- Establecer coverage mínimo y métricas de calidad

## Estrategia de Testing

### 1. Arquitectura de Testing

```typescript
// test/setup/test-setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getConnection } from 'typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { JwtModule } from '@nestjs/jwt';

export class TestSetup {
  static async createTestingModule(
    imports: any[] = [],
    providers: any[] = [],
    controllers: any[] = []
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test'
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('TEST_DB_HOST', 'localhost'),
            port: configService.get('TEST_DB_PORT', 5433),
            username: configService.get('TEST_DB_USERNAME', 'test'),
            password: configService.get('TEST_DB_PASSWORD', 'test'),
            database: configService.get('TEST_DB_DATABASE', 'test_chat'),
            entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
            synchronize: true,
            dropSchema: true
          }),
          inject: [ConfigService]
        }),
        RedisModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            config: {
              host: configService.get('TEST_REDIS_HOST', 'localhost'),
              port: configService.get('TEST_REDIS_PORT', 6380),
              db: configService.get('TEST_REDIS_DB', 1)
            }
          }),
          inject: [ConfigService]
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' }
        }),
        ...imports
      ],
      providers: [...providers],
      controllers: [...controllers]
    }).compile();

    return module;
  }

  static async cleanDatabase(): Promise<void> {
    const connection = getConnection();
    const entities = connection.entityMetadatas;

    for (const entity of entities) {
      const repository = connection.getRepository(entity.name);
      await repository.clear();
    }
  }

  static async closeDatabase(): Promise<void> {
    const connection = getConnection();
    if (connection.isConnected) {
      await connection.close();
    }
  }
}

// test/helpers/test-data-factory.ts
export class TestDataFactory {
  static createUser(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
      email: faker.internet.email(),
      username: faker.internet.userName(),
      password: 'TestPassword123!',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      ...overrides
    };
  }

  static createMessage(overrides: Partial<CreateMessageDto> = {}): CreateMessageDto {
    return {
      content: faker.lorem.paragraph(),
      threadId: faker.string.uuid(),
      mentionedUserIds: [],
      attachments: [],
      ...overrides
    };
  }

  static createThread(overrides: Partial<CreateThreadDto> = {}): CreateThreadDto {
    return {
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      type: ThreadType.PUBLIC,
      participantIds: [],
      ...overrides
    };
  }

  static createFile(overrides: Partial<CreateFileDto> = {}): CreateFileDto {
    return {
      filename: faker.system.fileName(),
      mimeType: 'text/plain',
      size: faker.number.int({ min: 1000, max: 1000000 }),
      content: Buffer.from(faker.lorem.paragraphs()),
      ...overrides
    };
  }

  static async createPersistedUser(
    userRepository: Repository<User>,
    overrides: Partial<User> = {}
  ): Promise<User> {
    const userData = {
      id: UserId.generate(),
      email: Email.create(faker.internet.email()),
      username: Username.create(faker.internet.userName()),
      password: await Password.create('TestPassword123!'),
      profile: new UserProfile(
        faker.person.firstName(),
        faker.person.lastName(),
        faker.image.avatar()
      ),
      settings: UserSettings.default(),
      ...overrides
    };

    const user = new User(
      userData.id,
      userData.email,
      userData.username,
      userData.password,
      userData.profile,
      userData.settings
    );

    return await userRepository.save(user);
  }
}
```

### 2. Unit Tests

```typescript
// test/unit/users/create-user.use-case.spec.ts
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: MockType<IUserRepository>;
  let passwordService: MockType<PasswordService>;
  let eventBus: MockType<IEventBus>;

  beforeEach(async () => {
    const module = await TestSetup.createTestingModule(
      [],
      [
        CreateUserUseCase,
        {
          provide: IUserRepository,
          useFactory: createMockRepository
        },
        {
          provide: PasswordService,
          useFactory: createMockService
        },
        {
          provide: IEventBus,
          useFactory: createMockEventBus
        }
      ]
    );

    useCase = module.get(CreateUserUseCase);
    userRepository = module.get(IUserRepository);
    passwordService = module.get(PasswordService);
    eventBus = module.get(IEventBus);
  });

  describe('execute', () => {
    it('should create user successfully', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'test@example.com',
        'testuser',
        'TestPassword123!',
        'John',
        'Doe'
      );

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('hashed-password');
      userRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: expect.objectContaining({ value: 'test@example.com' }),
          username: expect.objectContaining({ value: 'testuser' })
        })
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(UserCreatedEvent)
      );
    });

    it('should fail when email already exists', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'existing@example.com',
        'testuser',
        'TestPassword123!',
        'John',
        'Doe'
      );

      const existingUser = new User(
        UserId.generate(),
        Email.create('existing@example.com'),
        Username.create('existing'),
        await Password.create('password'),
        new UserProfile('Jane', 'Doe'),
        UserSettings.default()
      );

      userRepository.findByEmail.mockResolvedValue(existingUser);

      // Act
      const result = await useCase.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Email already exists');
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should validate password strength', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'test@example.com',
        'testuser',
        'weak',
        'John',
        'Doe'
      );

      // Act & Assert
      await expect(useCase.execute(command)).rejects.toThrow(
        'Password does not meet requirements'
      );
    });

    it('should validate email format', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'invalid-email',
        'testuser',
        'TestPassword123!',
        'John',
        'Doe'
      );

      // Act & Assert
      await expect(useCase.execute(command)).rejects.toThrow(
        'Invalid email format'
      );
    });
  });
});

// test/unit/messages/send-message.use-case.spec.ts
describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let messageRepository: MockType<IMessageRepository>;
  let threadRepository: MockType<IThreadRepository>;
  let userRepository: MockType<IUserRepository>;
  let websocketGateway: MockType<WebSocketGateway>;
  let moderationService: MockType<ModerationService>;

  beforeEach(async () => {
    const module = await TestSetup.createTestingModule(
      [],
      [
        SendMessageUseCase,
        {
          provide: IMessageRepository,
          useFactory: createMockRepository
        },
        {
          provide: IThreadRepository,
          useFactory: createMockRepository
        },
        {
          provide: IUserRepository,
          useFactory: createMockRepository
        },
        {
          provide: WebSocketGateway,
          useFactory: createMockGateway
        },
        {
          provide: ModerationService,
          useFactory: createMockService
        }
      ]
    );

    useCase = module.get(SendMessageUseCase);
    messageRepository = module.get(IMessageRepository);
    threadRepository = module.get(IThreadRepository);
    userRepository = module.get(IUserRepository);
    websocketGateway = module.get(WebSocketGateway);
    moderationService = module.get(ModerationService);
  });

  it('should send message successfully', async () => {
    // Arrange
    const command = new SendMessageCommand(
      UserId.generate(),
      ThreadId.generate(),
      'Hello, world!',
      []
    );

    const user = TestDataFactory.createUser();
    const thread = TestDataFactory.createThread();
    
    userRepository.findById.mockResolvedValue(user);
    threadRepository.findById.mockResolvedValue(thread);
    moderationService.moderateContent.mockResolvedValue(
      ModerationDecision.allow()
    );
    messageRepository.save.mockResolvedValue(undefined);

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(messageRepository.save).toHaveBeenCalled();
    expect(websocketGateway.sendToThread).toHaveBeenCalledWith(
      command.threadId.value,
      'message',
      expect.any(Object)
    );
  });

  it('should block message when moderation fails', async () => {
    // Arrange
    const command = new SendMessageCommand(
      UserId.generate(),
      ThreadId.generate(),
      'This is inappropriate content',
      []
    );

    const user = TestDataFactory.createUser();
    const thread = TestDataFactory.createThread();
    
    userRepository.findById.mockResolvedValue(user);
    threadRepository.findById.mockResolvedValue(thread);
    moderationService.moderateContent.mockResolvedValue(
      ModerationDecision.block('Inappropriate content')
    );

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Message blocked by moderation');
    expect(messageRepository.save).not.toHaveBeenCalled();
  });
});
```

### 3. Integration Tests

```typescript
// test/integration/users/users.integration.spec.ts
describe('Users Integration', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let testingModule: TestingModule;

  beforeAll(async () => {
    testingModule = await TestSetup.createTestingModule([
      UsersModule,
      AuthModule
    ]);

    app = testingModule.createNestApplication();
    await app.init();

    userRepository = testingModule.get(getRepositoryToken(User));
  });

  beforeEach(async () => {
    await TestSetup.cleanDatabase();
  });

  afterAll(async () => {
    await TestSetup.closeDatabase();
    await app.close();
  });

  describe('POST /api/users', () => {
    it('should create user successfully', async () => {
      // Arrange
      const createUserDto = TestDataFactory.createUser();

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(createUserDto)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(String),
        email: createUserDto.email,
        username: createUserDto.username,
        profile: {
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName
        }
      });

      const savedUser = await userRepository.findOne({
        where: { email: createUserDto.email }
      });
      expect(savedUser).toBeDefined();
    });

    it('should return 409 when email already exists', async () => {
      // Arrange
      const existingUser = await TestDataFactory.createPersistedUser(userRepository);
      const createUserDto = TestDataFactory.createUser({
        email: existingUser.email.value
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/users')
        .send(createUserDto)
        .expect(409);
    });

    it('should validate required fields', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({})
        .expect(400);

      expect(response.body.message).toContain('email should not be empty');
      expect(response.body.message).toContain('username should not be empty');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      // Arrange
      const user = await TestDataFactory.createPersistedUser(userRepository);
      const token = generateJwtToken(user.id.value);

      // Act
      const response = await request(app.getHttpServer())
        .get(`/api/users/${user.id.value}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: user.id.value,
        email: user.email.value,
        username: user.username.value
      });
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      const nonExistentId = UserId.generate().value;
      const token = generateJwtToken(nonExistentId);

      // Act & Assert
      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 401 when no token provided', async () => {
      // Arrange
      const userId = UserId.generate().value;

      // Act & Assert
      await request(app.getHttpServer())
        .get(`/api/users/${userId}`)
        .expect(401);
    });
  });
});

// test/integration/messages/websocket-messages.integration.spec.ts
describe('WebSocket Messages Integration', () => {
  let app: INestApplication;
  let client1: Socket;
  let client2: Socket;
  let user1: User;
  let user2: User;
  let thread: Thread;

  beforeAll(async () => {
    const testingModule = await TestSetup.createTestingModule([
      MessagesModule,
      WebSocketModule,
      AuthModule
    ]);

    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(0);

    const userRepository = testingModule.get(getRepositoryToken(User));
    const threadRepository = testingModule.get(getRepositoryToken(Thread));

    user1 = await TestDataFactory.createPersistedUser(userRepository);
    user2 = await TestDataFactory.createPersistedUser(userRepository);
    
    thread = new Thread(
      ThreadId.generate(),
      'Test Thread',
      'Test Description',
      ThreadType.PUBLIC,
      user1.id,
      [user1.id, user2.id]
    );
    await threadRepository.save(thread);
  });

  beforeEach(async () => {
    const port = app.getHttpServer().address().port;
    
    client1 = io(`http://localhost:${port}`, {
      auth: {
        token: generateJwtToken(user1.id.value)
      }
    });

    client2 = io(`http://localhost:${port}`, {
      auth: {
        token: generateJwtToken(user2.id.value)
      }
    });

    await Promise.all([
      new Promise(resolve => client1.on('connect', resolve)),
      new Promise(resolve => client2.on('connect', resolve))
    ]);

    // Join thread
    client1.emit('join-thread', { threadId: thread.id.value });
    client2.emit('join-thread', { threadId: thread.id.value });
  });

  afterEach(() => {
    client1?.disconnect();
    client2?.disconnect();
  });

  afterAll(async () => {
    await TestSetup.closeDatabase();
    await app.close();
  });

  it('should send and receive messages in real-time', async () => {
    // Arrange
    const messageContent = 'Hello from integration test!';
    const messagePromise = new Promise(resolve => {
      client2.on('message', resolve);
    });

    // Act
    client1.emit('send-message', {
      threadId: thread.id.value,
      content: messageContent,
      mentionedUserIds: []
    });

    // Assert
    const receivedMessage = await messagePromise;
    expect(receivedMessage).toMatchObject({
      content: messageContent,
      threadId: thread.id.value,
      senderId: user1.id.value
    });
  });

  it('should handle typing indicators', async () => {
    // Arrange
    const typingPromise = new Promise(resolve => {
      client2.on('user-typing', resolve);
    });

    // Act
    client1.emit('typing', {
      threadId: thread.id.value,
      isTyping: true
    });

    // Assert
    const typingEvent = await typingPromise;
    expect(typingEvent).toMatchObject({
      userId: user1.id.value,
      threadId: thread.id.value,
      isTyping: true
    });
  });
});
```

### 4. Performance Tests

```typescript
// test/performance/api-performance.spec.ts
describe('API Performance Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let authToken: string;

  beforeAll(async () => {
    const testingModule = await TestSetup.createTestingModule([
      UsersModule,
      MessagesModule,
      AuthModule
    ]);

    app = testingModule.createNestApplication();
    await app.init();

    userRepository = testingModule.get(getRepositoryToken(User));
    
    // Create test user
    const user = await TestDataFactory.createPersistedUser(userRepository);
    authToken = generateJwtToken(user.id.value);
  });

  afterAll(async () => {
    await TestSetup.closeDatabase();
    await app.close();
  });

  describe('User endpoints performance', () => {
    it('should handle concurrent user creation', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .post('/api/users')
          .send(TestDataFactory.createUser())
      );

      const results = await Promise.allSettled(requests);
      const endTime = Date.now();

      // Assert
      const successfulRequests = results.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      );

      expect(successfulRequests.length).toBeGreaterThan(concurrentRequests * 0.9);
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should respond to user lookup under 100ms', async () => {
      const user = await TestDataFactory.createPersistedUser(userRepository);
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(app.getHttpServer())
          .get(`/api/users/${user.id.value}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      expect(avgTime).toBeLessThan(100);
      expect(p95Time).toBeLessThan(200);
    });
  });
});

// test/performance/websocket-performance.spec.ts
describe('WebSocket Performance Tests', () => {
  let app: INestApplication;
  let clients: Socket[] = [];

  beforeAll(async () => {
    const testingModule = await TestSetup.createTestingModule([
      WebSocketModule,
      MessagesModule
    ]);

    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterEach(() => {
    clients.forEach(client => client.disconnect());
    clients = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle 1000 concurrent connections', async () => {
    const connectionCount = 1000;
    const port = app.getHttpServer().address().port;

    const connectionPromises = Array.from({ length: connectionCount }, (_, index) => {
      return new Promise<Socket>((resolve, reject) => {
        const client = io(`http://localhost:${port}`, {
          auth: {
            token: generateJwtToken(`user-${index}`)
          },
          timeout: 10000
        });

        client.on('connect', () => {
          clients.push(client);
          resolve(client);
        });

        client.on('connect_error', reject);
      });
    });

    const startTime = Date.now();
    const connectedClients = await Promise.all(connectionPromises);
    const connectionTime = Date.now() - startTime;

    expect(connectedClients.length).toBe(connectionCount);
    expect(connectionTime).toBeLessThan(30000); // 30 seconds max
  });

  it('should handle high message throughput', async () => {
    const clientCount = 100;
    const messagesPerClient = 10;
    const port = app.getHttpServer().address().port;

    // Connect clients
    const connectionPromises = Array.from({ length: clientCount }, (_, index) => {
      return new Promise<Socket>((resolve) => {
        const client = io(`http://localhost:${port}`, {
          auth: {
            token: generateJwtToken(`user-${index}`)
          }
        });

        client.on('connect', () => {
          clients.push(client);
          resolve(client);
        });
      });
    });

    await Promise.all(connectionPromises);

    // Send messages
    const messagePromises: Promise<void>[] = [];
    const startTime = Date.now();

    clients.forEach((client, clientIndex) => {
      for (let i = 0; i < messagesPerClient; i++) {
        messagePromises.push(
          new Promise<void>((resolve) => {
            client.emit('send-message', {
              threadId: 'test-thread',
              content: `Message ${i} from client ${clientIndex}`,
              mentionedUserIds: []
            });
            resolve();
          })
        );
      }
    });

    await Promise.all(messagePromises);
    const sendTime = Date.now() - startTime;

    expect(sendTime).toBeLessThan(10000); // 10 seconds max
  });
});
```

### 5. Database Tests

```typescript
// test/database/user-repository.spec.ts
describe('UserRepository Database Tests', () => {
  let repository: UserRepository;
  let connection: Connection;

  beforeAll(async () => {
    const testingModule = await TestSetup.createTestingModule([
      TypeOrmModule.forFeature([User])
    ]);

    repository = testingModule.get(UserRepository);
    connection = testingModule.get(Connection);
  });

  beforeEach(async () => {
    await TestSetup.cleanDatabase();
  });

  afterAll(async () => {
    await TestSetup.closeDatabase();
  });

  describe('findByEmail', () => {
    it('should find user by email case-insensitively', async () => {
      // Arrange
      const user = await TestDataFactory.createPersistedUser(
        connection.getRepository(User),
        { email: Email.create('TEST@EXAMPLE.COM') }
      );

      // Act
      const foundUser = await repository.findByEmail('test@example.com');

      // Assert
      expect(foundUser).toBeDefined();
      expect(foundUser.id.value).toBe(user.id.value);
    });

    it('should return null when user not found', async () => {
      // Act
      const foundUser = await repository.findByEmail('nonexistent@example.com');

      // Assert
      expect(foundUser).toBeNull();
    });
  });

  describe('save', () => {
    it('should save user with all relationships', async () => {
      // Arrange
      const user = new User(
        UserId.generate(),
        Email.create('test@example.com'),
        Username.create('testuser'),
        await Password.create('TestPassword123!'),
        new UserProfile('John', 'Doe', 'avatar.jpg'),
        UserSettings.default()
      );

      // Act
      await repository.save(user);

      // Assert
      const savedUser = await repository.findById(user.id);
      expect(savedUser).toBeDefined();
      expect(savedUser.email.value).toBe('test@example.com');
      expect(savedUser.profile.firstName).toBe('John');
    });

    it('should handle unique constraint violations', async () => {
      // Arrange
      const email = 'duplicate@example.com';
      const user1 = new User(
        UserId.generate(),
        Email.create(email),
        Username.create('user1'),
        await Password.create('password'),
        new UserProfile('User', 'One'),
        UserSettings.default()
      );

      const user2 = new User(
        UserId.generate(),
        Email.create(email),
        Username.create('user2'),
        await Password.create('password'),
        new UserProfile('User', 'Two'),
        UserSettings.default()
      );

      // Act & Assert
      await repository.save(user1);
      await expect(repository.save(user2)).rejects.toThrow();
    });
  });

  describe('complex queries', () => {
    beforeEach(async () => {
      // Create test data
      const users = await Promise.all([
        TestDataFactory.createPersistedUser(connection.getRepository(User)),
        TestDataFactory.createPersistedUser(connection.getRepository(User)),
        TestDataFactory.createPersistedUser(connection.getRepository(User))
      ]);

      // Create some messages to test activity
      const messageRepository = connection.getRepository(Message);
      const thread = new Thread(
        ThreadId.generate(),
        'Test Thread',
        'Description',
        ThreadType.PUBLIC,
        users[0].id,
        users.map(u => u.id)
      );

      await connection.getRepository(Thread).save(thread);

      for (let i = 0; i < 5; i++) {
        const message = new Message(
          MessageId.generate(),
          users[0].id,
          thread.id,
          new MessageContent(`Message ${i}`),
          new MessageMetadata()
        );
        await messageRepository.save(message);
      }
    });

    it('should find active users with message count', async () => {
      // Act
      const activeUsers = await repository.findActiveUsersWithStats(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        10
      );

      // Assert
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].messageCount).toBe(5);
    });
  });
});
```

### 6. Test Configuration

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/index.ts',
    '!src/main.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest-setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4
};

// test/setup/jest-setup.ts
import { faker } from '@faker-js/faker';

// Seed faker for consistent test data
faker.seed(123);

// Global test setup
beforeAll(async () => {
  // Setup test database
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup
});

// Global mocks
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true)
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-id', email: 'test@example.com' })
}));
```

## Tareas de Implementación

### Fase 1: Test Infrastructure (Días 1-2)

- [ ] Configurar Jest y testing modules
- [ ] Crear TestSetup y factory helpers
- [ ] Configurar base de datos de testing
- [ ] Implementar mocks y stubs básicos

### Fase 2: Unit Tests (Días 3-5)

- [ ] Tests para todos los use cases
- [ ] Tests para domain entities y value objects
- [ ] Tests para services e infrastructure
- [ ] Configurar coverage reporting

### Fase 3: Integration Tests (Días 6-8)

- [ ] Tests de API endpoints
- [ ] Tests de WebSocket communication
- [ ] Tests de base de datos
- [ ] Tests de autenticación y autorización

### Fase 4: Performance Tests (Días 9-10)

- [ ] Load testing para APIs
- [ ] WebSocket performance tests
- [ ] Database query performance
- [ ] Memory and resource usage tests

### Fase 5: Quality Assurance (Días 11-12)

- [ ] Mutation testing
- [ ] Security testing
- [ ] Error handling tests
- [ ] Edge case testing

## Métricas de Calidad

### Code Coverage

- **Line Coverage**: Mínimo 80%
- **Branch Coverage**: Mínimo 75%
- **Function Coverage**: Mínimo 85%
- **Statement Coverage**: Mínimo 80%

### Performance Benchmarks

- **API Response Time**: < 200ms (P95)
- **Database Query Time**: < 50ms (P95)
- **WebSocket Message Latency**: < 10ms
- **Concurrent Connections**: 1000+ simultaneous

### Test Quality

- **Test Coverage**: 100% de use cases críticos
- **Test Performance**: < 5 minutos suite completa
- **Test Reliability**: < 1% flaky tests
- **Test Maintainability**: Setup automático y reutilizable

Este conjunto de tests garantizará la calidad, performance y confiabilidad del backend del sistema de chat.
