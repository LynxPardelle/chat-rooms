import { Test, TestingModule } from '@nestjs/testing';
import { SocketService } from '../socket.service';
import { WebSocketConfigService } from '../websocket.config';

describe('SocketService', () => {
  let service: SocketService;
  let configService: WebSocketConfigService;  const mockConfigService = {
    config: {
      corsOrigin: 'http://localhost:5173',
      namespace: '/chat',
      rateLimit: {
        windowMs: 60000,
        maxMessagesPerWindow: 10, // Low limit for tests
        maxJoinsPerWindow: 10,
        maxTypingEventsPerWindow: 10,
        cleanupIntervalMs: 300000,
        inactiveThresholdMs: 1800000,
      },
    },
    enableDetailedLogging: true,
    enableMetrics: true,
    enableHeartbeat: true,
    heartbeatIntervalMs: 30000,
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketService,
        {
          provide: WebSocketConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SocketService>(SocketService);
    configService = module.get<WebSocketConfigService>(WebSocketConfigService);
  });

  afterEach(() => {
    // Clean up timers to prevent Jest from hanging
    if (service) {
      service.onModuleDestroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Connection Management', () => {
    it('should add and track connections', () => {
      const socketId = 'socket-123';
      const userId = 'user-456';
      const username = 'testuser';

      service.addConnection(socketId, userId, username);

      const user = service.getUserBySocketId(socketId);
      expect(user).toBeDefined();
      expect(user?.userId).toBe(userId);
      expect(user?.username).toBe(username);
    });

    it('should remove connections and clean up', () => {
      const socketId = 'socket-123';
      const userId = 'user-456';
      const username = 'testuser';

      service.addConnection(socketId, userId, username);
      const removedUser = service.removeConnection(socketId);

      expect(removedUser).toBeDefined();
      expect(removedUser?.userId).toBe(userId);
      expect(service.getUserBySocketId(socketId)).toBeUndefined();
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      service.addConnection('socket-1', 'user-1', 'user1');
      service.addConnection('socket-2', 'user-2', 'user2');
    });

    it('should allow users to join rooms', () => {
      const roomId = 'room-123';
      
      const result1 = service.joinRoom('socket-1', roomId);
      const result2 = service.joinRoom('socket-2', roomId);

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      const roomUsers = service.getRoomUsers(roomId);
      expect(roomUsers).toHaveLength(2);
    });

    it('should allow users to leave rooms', () => {
      const roomId = 'room-123';
      
      service.joinRoom('socket-1', roomId);
      service.joinRoom('socket-2', roomId);
      
      const result = service.leaveRoom('socket-1', roomId);
      expect(result).toBe(true);

      const roomUsers = service.getRoomUsers(roomId);
      expect(roomUsers).toHaveLength(1);
      expect(roomUsers[0].userId).toBe('user-2');
    });

    it('should get user rooms correctly', () => {
      service.joinRoom('socket-1', 'room-1');
      service.joinRoom('socket-1', 'room-2');

      const userRooms = service.getUserRooms('user-1');
      expect(userRooms).toHaveLength(2);
      expect(userRooms).toContain('room-1');
      expect(userRooms).toContain('room-2');
    });
  });

  describe('Typing Management', () => {
    beforeEach(() => {
      service.addConnection('socket-1', 'user-1', 'user1');
      service.joinRoom('socket-1', 'room-1');
    });

    it('should set and track typing status', () => {
      const result = service.setUserTyping('socket-1', 'room-1', true);
      expect(result).toBe(true);

      const typingUsers = service.getTypingUsers('room-1');
      expect(typingUsers).toContain('user-1');
    });

    it('should remove typing status', () => {
      service.setUserTyping('socket-1', 'room-1', true);
      service.setUserTyping('socket-1', 'room-1', false);

      const typingUsers = service.getTypingUsers('room-1');
      expect(typingUsers).not.toContain('user-1');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      service.addConnection('socket-1', 'user-1', 'user1');
    });

    it('should allow events under rate limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = service.checkRateLimit('socket-1', 'message');
        expect(result).toBe(true);
      }
    });    it('should reject events over rate limit', () => {
      // Simulate hitting the rate limit (10 messages per minute)
      for (let i = 0; i < 10; i++) {
        service.checkRateLimit('socket-1', 'message');
      }

      const result = service.checkRateLimit('socket-1', 'message');
      expect(result).toBe(false);
    });    it('should handle different event types separately', () => {
      // Fill message limit
      for (let i = 0; i < 10; i++) {
        service.checkRateLimit('socket-1', 'message');
      }

      // Should still allow join events
      const joinResult = service.checkRateLimit('socket-1', 'join');
      expect(joinResult).toBe(true);

      // Should still allow typing events
      const typingResult = service.checkRateLimit('socket-1', 'typing');
      expect(typingResult).toBe(true);
    });
  });

  describe('Stats and Utilities', () => {
    beforeEach(() => {
      service.addConnection('socket-1', 'user-1', 'user1');
      service.addConnection('socket-2', 'user-2', 'user2');
      service.joinRoom('socket-1', 'room-1');
      service.joinRoom('socket-2', 'room-1');
    });

    it('should return correct stats', () => {
      const stats = service.getStats();
      
      expect(stats.connectedUsers).toBe(2);
      expect(stats.activeRooms).toBe(1);
      expect(stats.timestamp).toBeInstanceOf(Date);
    });

    it('should return connected users count', () => {
      expect(service.getConnectedUsersCount()).toBe(2);
    });

    it('should return rooms count', () => {
      expect(service.getRoomsCount()).toBe(1);
    });
  });
});
