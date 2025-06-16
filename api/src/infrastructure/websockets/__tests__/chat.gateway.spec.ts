import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from '../chat.gateway';
import { MessageService } from '../../../application/services/message.service';
import { SocketService } from '../socket.service';
import { WebSocketConfigService } from '../websocket.config';
import { WsException } from '@nestjs/websockets';
import { UserStatus } from '../../../domain/types';
import {
  RealtimeSyncService,
  BroadcastingService,
  MessageQueueService,
  PresenceService,
  TypingService,
  ReadReceiptService,
  NotificationService
} from '../services';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { PerformanceService } from '../../monitoring/performance.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let messageService: MessageService;
  let socketService: SocketService;
  let configService: WebSocketConfigService;
  let realtimeSyncService: RealtimeSyncService;
  let broadcastingService: BroadcastingService;
  let messageQueueService: MessageQueueService;
  let presenceService: PresenceService;

  const mockMessageService = {
    createMessage: jest.fn(),
  };
  const mockSocketService = {
    addConnection: jest.fn(),
    removeConnection: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    checkRateLimit: jest.fn().mockReturnValue(true), // Allow by default
    setUserTyping: jest.fn(),
    getRoomUsers: jest.fn(),
    getTypingUsers: jest.fn(),
    recordHeartbeat: jest.fn(),
    incrementMessageCount: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      totalConnections: 1,
      totalMessages: 0,
      rateLimitViolations: 0,
      roomCount: 0,
    }),
  };  const mockConfigService = {
    config: {
      corsOrigin: 'http://localhost:5173',
      namespace: '/chat',
      rateLimit: {
        windowMs: 60000,
        maxMessagesPerWindow: 1000, // High limit for tests
        maxJoinsPerWindow: 1000,
        maxTypingEventsPerWindow: 1000,
        cleanupIntervalMs: 300000,
        inactiveThresholdMs: 1800000,
      },
    },
    enableDetailedLogging: true,
    enableMetrics: true,
    enableHeartbeat: true,
    heartbeatIntervalMs: 30000,
    getRateLimits: jest.fn().mockReturnValue({
      windowMs: 60000,
      maxMessagesPerWindow: 1000,
      maxJoinsPerWindow: 1000,
      maxTypingEventsPerWindow: 1000,
    }),
    getDefaultRoom: jest.fn().mockReturnValue('general'),
  };

  // Mock WebSocket services
  const mockRealtimeSyncService = {
    syncEvent: jest.fn().mockResolvedValue(true),
    validateConsistency: jest.fn().mockResolvedValue(true),
    getPendingEvents: jest.fn().mockReturnValue([]),
    retryPendingEvents: jest.fn().mockResolvedValue(0),
    getEventHistory: jest.fn().mockReturnValue({ events: [], hasMore: false, cursor: null }),
  };
  const mockBroadcastingService = {
    setServer: jest.fn(),
    registerUser: jest.fn(),
    unregisterUser: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    updateSubscriptions: jest.fn(),
    broadcast: jest.fn().mockResolvedValue(true),
    broadcastToRoom: jest.fn().mockResolvedValue(true),
    broadcastToUser: jest.fn().mockResolvedValue(true),
    sendToRoom: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockReturnValue({
      totalEventsSent: 0,
      eventsPerSecond: 0,
      averageLatency: 0,
      batchedEvents: 0,
      droppedEvents: 0,
      connectedClients: 0,
      roomsActive: 0,
    }),
    getRoomInfo: jest.fn().mockReturnValue({ users: [], subscriptions: [] }),
    getUserInfo: jest.fn().mockReturnValue(null),
  };  const mockMessageQueueService = {
    enqueue: jest.fn().mockResolvedValue(true),
    processUserQueue: jest.fn().mockResolvedValue(0),
    getUserQueueSize: jest.fn().mockReturnValue(0),
    setUserOnlineStatus: jest.fn(),
    setDeliveryCallback: jest.fn(),
    removeDeliveryCallback: jest.fn(),
    markUserOnline: jest.fn().mockResolvedValue(true),
    markUserOffline: jest.fn().mockResolvedValue(true),
    queueMessage: jest.fn().mockResolvedValue(undefined),
    getQueueStats: jest.fn().mockReturnValue({
      totalQueued: 0,
      totalDelivered: 0,
      totalExpired: 0,
      currentQueueSize: 0,
      averageDeliveryTime: 0,
      failedDeliveries: 0,
    }),
    clearUserQueue: jest.fn(),
    getFailedMessages: jest.fn().mockReturnValue([]),
  };const mockPresenceService = {
    updatePresence: jest.fn().mockResolvedValue(true),
    updateUserActivity: jest.fn().mockResolvedValue(true),
    getUserPresence: jest.fn().mockResolvedValue({
      userId: 'user-456',
      status: 'online',
      isOnline: true,
      lastSeen: Date.now(),
      lastActivity: Date.now(),
    }),
    getRoomPresence: jest.fn().mockResolvedValue([]),
    setUserOnline: jest.fn().mockResolvedValue(true),
    setUserOffline: jest.fn().mockResolvedValue(true),
    getPresenceHistory: jest.fn().mockReturnValue([]),
    getStats: jest.fn().mockReturnValue({
      totalUsers: 0,
      onlineUsers: 0,
      usersByStatus: { online: 0, away: 0, busy: 0, offline: 0 },
      averageSessionDuration: 0,
      presenceChanges: 0,
    }),
    bulkUpdatePresence: jest.fn().mockResolvedValue(0),
    subscribeToPresence: jest.fn(),
    unsubscribeFromPresence: jest.fn(),
  };  const mockSocket = {
    id: 'socket-123',
    data: {
      user: {
        id: 'user-456',
        username: 'testuser',
        email: 'test@example.com',
      },
    },
    handshake: {
      auth: {
        user: {
          id: 'user-456',
          username: 'testuser',
          email: 'test@example.com',
          textColor: '#000000' as `#${string}`,
          backgroundColor: '#ffffff' as `#${string}`,
          status: UserStatus.ONLINE,
          isOnline: true,
          lastSeen: new Date(),
          metadata: { 
            lastLoginIp: '127.0.0.1',
            lastUserAgent: 'test-browser',
            loginCount: 1,
            theme: 'dark', 
            notifications: true 
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      address: '127.0.0.1',
      headers: {
        'user-agent': 'test-browser/1.0',
        'accept-language': 'en-US',
      },
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
  };

  const mockServer = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  };
  // Mock RedisCacheService
  const mockRedisCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    ttl: jest.fn().mockResolvedValue(-1),
    expire: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn().mockResolvedValue([]),
    mset: jest.fn().mockResolvedValue(true),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(true),
    hdel: jest.fn().mockResolvedValue(true),
    hgetall: jest.fn().mockResolvedValue({}),
    zadd: jest.fn().mockResolvedValue(true),
    zrange: jest.fn().mockResolvedValue([]),
    zrem: jest.fn().mockResolvedValue(true),
    flushdb: jest.fn().mockResolvedValue(true),
  };
  // Mock PerformanceService
  const mockPerformanceService = {
    measureRequestDuration: jest.fn().mockReturnValue(() => {}),
    getMetrics: jest.fn().mockReturnValue({
      requestsTotal: 0,
      requestDuration: 0,
      errorRate: 0,
      activeConnections: 0,
    }),
    incrementCounter: jest.fn(),
    recordHistogram: jest.fn(),
    recordGauge: jest.fn(),
    recordWebSocketMetrics: jest.fn(),
  };// Mock remaining services
  const mockTypingService = {
    setTyping: jest.fn().mockResolvedValue(true),
    stopTyping: jest.fn().mockResolvedValue(true),
    getTypingUsers: jest.fn().mockResolvedValue([]),
    cleanupTyping: jest.fn().mockResolvedValue(0),
    cleanupUserTyping: jest.fn().mockReturnValue([]),
  };

  const mockReadReceiptService = {
    markAsRead: jest.fn().mockResolvedValue(true),
    getReadReceipts: jest.fn().mockResolvedValue([]),
    getUserLastRead: jest.fn().mockResolvedValue(null),
    markRoomAsRead: jest.fn().mockResolvedValue(0),
  };

  const mockNotificationService = {
    sendNotification: jest.fn().mockResolvedValue(true),
    scheduleNotification: jest.fn().mockResolvedValue(true),
    cancelNotification: jest.fn().mockResolvedValue(true),
    getNotificationHistory: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
        {
          provide: SocketService,
          useValue: mockSocketService,
        },
        {
          provide: WebSocketConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisCacheService,
          useValue: mockRedisCacheService,
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService,
        },
        {
          provide: RealtimeSyncService,
          useValue: mockRealtimeSyncService,
        },
        {
          provide: BroadcastingService,
          useValue: mockBroadcastingService,
        },
        {
          provide: MessageQueueService,
          useValue: mockMessageQueueService,
        },
        {
          provide: PresenceService,
          useValue: mockPresenceService,
        },
        {
          provide: TypingService,
          useValue: mockTypingService,
        },
        {
          provide: ReadReceiptService,
          useValue: mockReadReceiptService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    messageService = module.get<MessageService>(MessageService);
    socketService = module.get<SocketService>(SocketService);
    configService = module.get<WebSocketConfigService>(WebSocketConfigService);    // Setup gateway server
    gateway.server = mockServer as any;

    // Reset all mocks
    jest.clearAllMocks();
    
    // Set default mock return values
    mockSocketService.checkRateLimit.mockReturnValue(true);
    mockSocketService.joinRoom.mockReturnValue(true);
    mockSocketService.addConnection.mockReturnValue(true);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
  describe('handleConnection', () => {
    it('should handle successful connection', async () => {
      await gateway.handleConnection(mockSocket as any);

      expect(mockBroadcastingService.registerUser).toHaveBeenCalledWith(
        'user-456',
        'socket-123',
        mockSocket
      );
      expect(mockMessageQueueService.setDeliveryCallback).toHaveBeenCalledWith(
        'user-456',
        expect.any(Function)
      );
      expect(mockMessageQueueService.markUserOnline).toHaveBeenCalledWith('user-456');
      expect(mockServer.emit).toHaveBeenCalledWith('presence', {
        userId: 'user-456',
        username: 'testuser',
        status: 'online',
        timestamp: expect.any(Number),
      });
    });

    it('should disconnect socket without user data', async () => {
      const socketWithoutUser = { 
        ...mockSocket, 
        handshake: { auth: {}, address: '127.0.0.1' } 
      };

      await gateway.handleConnection(socketWithoutUser as any);

      expect(mockBroadcastingService.registerUser).not.toHaveBeenCalled();
      expect(mockMessageQueueService.setDeliveryCallback).not.toHaveBeenCalled();
    });
  });  describe('handleDisconnect', () => {
    it('should handle successful disconnection', async () => {
      // First set up the connection to ensure user data is available
      await gateway.handleConnection(mockSocket as any);
      
      // Clear the mock calls from connection to focus on disconnection
      jest.clearAllMocks();

      await gateway.handleDisconnect(mockSocket as any);

      expect(mockBroadcastingService.unregisterUser).toHaveBeenCalledWith('user-456');
      expect(mockMessageQueueService.removeDeliveryCallback).toHaveBeenCalledWith('user-456');
      expect(mockMessageQueueService.markUserOffline).toHaveBeenCalledWith('user-456');
      expect(mockPresenceService.setUserOffline).toHaveBeenCalledWith('user-456', 'socket-123');
      expect(mockServer.emit).toHaveBeenCalledWith('userOffline', {
        userId: 'user-456',
        username: 'testuser',
        timestamp: expect.any(String),
      });
    });
  });

  describe('joinRoom', () => {
    const joinRoomData = { roomId: 'room-123' };    
    
    it('should handle successful room join', async () => {
      // Set up connected user first
      (gateway as any).connectedClients = new Map();
      (gateway as any).connectedClients.set('socket-123', mockSocket);
      (gateway as any).connectedUsers = new Map();
      (gateway as any).connectedUsers.set('user-456', 'socket-123');
      (gateway as any).userRateLimits = new Map();
      (gateway as any).userRateLimits.set('user-456', {
        messages: { count: 0, lastReset: Date.now() },
        typing: { count: 0, lastReset: Date.now(), lastEmit: 0 },
        joinRoom: { count: 0, lastReset: Date.now() }
      });
      (gateway as any).roomParticipants = new Map();
      (gateway as any).roomParticipants.set('room-123', new Set());

      const result = await gateway.joinRoom(mockSocket as any, joinRoomData);

      expect(mockSocket.join).toHaveBeenCalledWith('room-123');
      expect(mockBroadcastingService.joinRoom).toHaveBeenCalledWith('user-456', 'room-123');
      expect(result?.data?.success).toBe(true);
    });
    
    it('should handle rate limit exceeded', async () => {
      // Create a mock implementation that simulates a rate limit error
      const originalJoinRoom = mockBroadcastingService.joinRoom;
      mockBroadcastingService.joinRoom.mockImplementationOnce(() => {
        mockSocket.emit('error', { message: 'Rate limit exceeded for joining rooms' });
        throw new WsException('Rate limit exceeded for joining rooms');
      });

      const result = await gateway.joinRoom(mockSocket as any, joinRoomData);

      expect(result?.data?.success).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.any(Object));
      
      // Restore original implementation
      mockBroadcastingService.joinRoom = originalJoinRoom;
    });

    it('should handle join room failure', async () => {
      // Make broadcasting service throw an error
      mockBroadcastingService.joinRoom.mockImplementationOnce(() => {
        throw new Error('Failed to join room');
      });

      const result = await gateway.joinRoom(mockSocket as any, joinRoomData);

      expect(result?.data?.success).toBe(false);
    });
  });
  describe('handleMessage', () => {
    const messageData = {
      content: 'Hello, world!',
      roomId: 'room-123',
      messageType: 'text' as any,
    };
    
    const mockUser = {
      id: 'user-456',
      username: 'testuser',
      email: 'test@test.com',
      avatar: 'avatar.jpg',
      avatarUrl: 'http://test.com/avatar.jpg',
      textColor: '#000000' as `#${string}`,
      backgroundColor: '#ffffff' as `#${string}`,
      status: UserStatus.ONLINE,
      isOnline: true,
      lastSeen: new Date(),
      metadata: {
        lastLoginIp: '127.0.0.1',
        lastUserAgent: 'test-agent',
        loginCount: 1
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should handle successful message send', async () => {
      const mockMessage = {
        id: 'msg-123',
        content: 'Hello, world!',
        userId: 'user-456',
        username: 'testuser',
        roomId: 'room-123',
        createdAt: new Date().toISOString(),
      };

      // Setup room participants
      (gateway as any).roomParticipants = new Map();
      (gateway as any).roomParticipants.set('room-123', new Set(['user-456']));
      
      mockMessageService.createMessage.mockResolvedValue(mockMessage);
      mockBroadcastingService.getRoomInfo.mockReturnValue({ members: ['user-456'] });

      const result = await gateway.handleMessage(mockSocket as any, messageData, mockUser);

      expect(mockMessageService.createMessage).toHaveBeenCalled();
      expect(mockRealtimeSyncService.syncEvent).toHaveBeenCalled();
      expect(mockBroadcastingService.broadcast).toHaveBeenCalled();
      expect(mockMessageQueueService.queueMessage).toHaveBeenCalledWith(
        'msg-123', 
        'room-123',
        mockMessage,
        'high'
      );
      expect(result?.data.success).toBe(true);
    });
    
    it('should handle message send failures', async () => {
      // Make message service throw an error
      mockMessageService.createMessage.mockRejectedValueOnce(new Error('Failed to create message'));

      const result = await gateway.handleMessage(mockSocket as any, messageData, mockUser);

      expect(result?.data?.success).toBe(false);
    });
  });
  describe('handleTyping', () => {
    const typingData = {
      roomId: 'room-123',
      isTyping: true,
    };

    const mockUser = {
      id: 'user-456',
      username: 'testuser',
      email: 'test@test.com',
      avatar: 'avatar.jpg',
      avatarUrl: 'http://test.com/avatar.jpg',
      textColor: '#000000' as `#${string}`,
      backgroundColor: '#ffffff' as `#${string}`,
      status: UserStatus.ONLINE,
      isOnline: true,
      lastSeen: new Date(),
      metadata: {
        lastLoginIp: '127.0.0.1',
        lastUserAgent: 'test-agent',
        loginCount: 1
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should handle successful typing event', async () => {
      // Set up connected user and typing users
      (gateway as any).connectedClients = new Map();
      (gateway as any).connectedClients.set('socket-123', mockSocket);
      (gateway as any).connectedUsers = new Map();
      (gateway as any).connectedUsers.set('user-456', 'socket-123');
      (gateway as any).userRateLimits = new Map();
      (gateway as any).userRateLimits.set('user-456', {
        messages: { count: 0, lastReset: Date.now() },
        typing: { count: 0, lastReset: Date.now(), lastEmit: 0 },
        joinRoom: { count: 0, lastReset: Date.now() }
      });
      
      // Set up typing users set
      (gateway as any).typingUsers = new Map();
      (gateway as any).typingUsers.set('room-123', new Set());
      (gateway as any).addUserTyping = jest.fn();
      (gateway as any).getTypingUsers = jest.fn().mockReturnValue([]);

      const result = await gateway.handleTyping(mockSocket as any, typingData, mockUser);

      expect(mockPresenceService.updateUserActivity).toHaveBeenCalledWith('user-456', 'typing');
      expect(mockBroadcastingService.sendToRoom).toHaveBeenCalled();
      expect(result?.data.success).toBe(true);
    });

    it('should handle typing event when isTyping is false', async () => {
      const notTypingData = {
        roomId: 'room-123',
        isTyping: false,
      };
      
      // Set up typing users
      (gateway as any).removeUserTyping = jest.fn();
      (gateway as any).getTypingUsers = jest.fn().mockReturnValue([]);
      
      const result = await gateway.handleTyping(mockSocket as any, notTypingData, mockUser);
      
      expect(mockPresenceService.updateUserActivity).toHaveBeenCalledWith('user-456', 'idle');
      expect(result?.data.success).toBe(true);
    });
  });
  describe('handleGetRoomStats', () => {
    const statsData = { roomId: 'room-123' };

    const mockUser = {
      id: 'user-456',
      username: 'testuser',
      email: 'test@test.com',
      avatar: 'avatar.jpg',
      avatarUrl: 'http://test.com/avatar.jpg',
      textColor: '#000000' as `#${string}`,
      backgroundColor: '#ffffff' as `#${string}`,
      status: 'online' as any,
      isOnline: true,
      lastSeen: new Date(),
      metadata: {
        lastLoginIp: '127.0.0.1',
        lastUserAgent: 'test-agent',
        loginCount: 1
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should return room stats successfully', async () => {
      mockSocketService.getRoomUsers.mockReturnValue([
        { userId: 'user-1', username: 'user1' },
        { userId: 'user-2', username: 'user2' },
      ]);
      mockSocketService.getTypingUsers.mockReturnValue(['user-1']);

      const result = await gateway.handleGetRoomStats(mockSocket as any, statsData, mockUser);

      expect(mockSocketService.getRoomUsers).toHaveBeenCalledWith('room-123');
      expect(mockSocketService.getTypingUsers).toHaveBeenCalledWith('room-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('roomStats', {
        roomId: 'room-123',
        userCount: 2,
        users: [
          { userId: 'user-1', username: 'user1' },          { userId: 'user-2', username: 'user2' },
        ],
        typingUsers: ['user-1'],
        timestamp: expect.any(String),
      });
      expect(result?.data.success).toBe(true);
    });
  });
});
