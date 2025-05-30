# WebSocket API Documentation

## Overview

This document describes the WebSocket API for the Chat Rooms application. The WebSocket connection provides real-time communication capabilities including messaging, room management, and user presence tracking.

## Connection

### Endpoint
```
ws://localhost:3001/chat
```

### Authentication
The WebSocket connection requires JWT authentication via the `authorization` header or query parameter.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameter:**
```
ws://localhost:3001/chat?token=<jwt_token>
```

## Rate Limiting

Rate limiting is implemented to prevent abuse:

| Event Type | Limit (Production) | Limit (Development) |
|------------|-------------------|-------------------|
| Messages   | 30/minute         | 60/minute         |
| Join Room  | 10/minute         | 20/minute         |
| Typing     | 60/minute         | 120/minute        |

Rate limits reset every 60 seconds.

## Events

### Client to Server Events

#### 1. Join Room
Join a specific chat room.

**Event:** `joinRoom`
**Payload:**
```typescript
{
  roomId: string; // Room identifier
}
```

**Response:**
```typescript
{
  event: "joinedRoom",
  roomId: string,
  success: boolean
}
```

**Error Response:**
```typescript
{
  success: false,
  error: string,
  statusCode: number,
  timestamp: string
}
```

---

#### 2. Leave Room
Leave a specific chat room.

**Event:** `leaveRoom`
**Payload:**
```typescript
{
  roomId: string; // Room identifier
}
```

**Response:**
```typescript
{
  event: "leftRoom",
  roomId: string,
  success: boolean
}
```

---

#### 3. Send Message
Send a message to a room.

**Event:** `sendMessage`
**Payload:**
```typescript
{
  content: string;     // Message content (1-2000 characters)
  roomId: string;      // Target room
  messageType?: "TEXT" | "IMAGE" | "FILE"; // Default: "TEXT"
}
```

**Response:**
```typescript
{
  event: "messageSent",
  message: {
    id: string,
    content: string,
    author: {
      id: string,
      username: string
    },
    roomId: string,
    messageType: string,
    timestamp: string,
    createdAt: string,
    updatedAt: string
  },
  success: boolean
}
```

---

#### 4. Typing Indicator
Indicate typing status in a room.

**Event:** `typing`
**Payload:**
```typescript
{
  roomId: string;   // Target room
  isTyping: boolean; // Typing status
}
```

**Response:**
```typescript
{
  event: "typingUpdated",
  success: boolean
}
```

---

#### 5. Get Room Statistics
Get current room statistics.

**Event:** `getRoomStats`
**Payload:**
```typescript
{
  roomId: string; // Target room
}
```

**Response:**
```typescript
{
  event: "roomStatsRetrieved",
  success: boolean
}
```

---

#### 6. Heartbeat
Maintain connection health.

**Event:** `heartbeat`
**Payload:** None

**Response:**
```typescript
{
  event: "heartbeatResponse",
  timestamp: string,
  success: boolean
}
```

### Server to Client Events

#### 1. Receive Message
Emitted when a new message is sent to a room.

**Event:** `receiveMessage`
**Payload:**
```typescript
{
  id: string,
  content: string,
  author: {
    id: string,
    username: string
  },
  roomId: string,
  messageType: string,
  timestamp: string,
  createdAt: string,
  updatedAt: string
}
```

---

#### 2. User Joined Room
Emitted when a user joins a room.

**Event:** `userJoined`
**Payload:**
```typescript
{
  userId: string,
  username: string,
  roomId: string,
  timestamp: string
}
```

---

#### 3. User Left Room
Emitted when a user leaves a room.

**Event:** `userLeft`
**Payload:**
```typescript
{
  userId: string,
  username: string,
  roomId: string,
  timestamp: string
}
```

---

#### 4. User Online
Emitted when a user connects.

**Event:** `userOnline`
**Payload:**
```typescript
{
  userId: string,
  username: string,
  timestamp: string
}
```

---

#### 5. User Offline
Emitted when a user disconnects.

**Event:** `userOffline`
**Payload:**
```typescript
{
  userId: string,
  username: string,
  timestamp: string
}
```

---

#### 6. User Typing
Emitted when a user is typing in a room.

**Event:** `userTyping`
**Payload:**
```typescript
{
  userId: string,
  username: string,
  roomId: string,
  isTyping: boolean,
  timestamp: string
}
```

---

#### 7. Room Users List
Emitted when joining a room.

**Event:** `roomUsers`
**Payload:**
```typescript
{
  roomId: string,
  users: Array<{
    userId: string,
    username: string
  }>
}
```

---

#### 8. Room Statistics
Emitted in response to `getRoomStats`.

**Event:** `roomStats`
**Payload:**
```typescript
{
  roomId: string,
  userCount: number,
  users: Array<{
    userId: string,
    username: string
  }>,
  typingUsers: string[],
  timestamp: string
}
```

---

#### 9. Heartbeat Ping
Emitted periodically to maintain connection.

**Event:** `ping`
**Payload:**
```typescript
{
  timestamp: string
}
```

---

#### 10. Error
Emitted when an error occurs.

**Event:** `error`
**Payload:**
```typescript
{
  success: false,
  error: string,
  message?: string,
  statusCode?: number,
  timestamp: string
}
```

## Health Check Endpoints

### WebSocket Health
**GET** `/websocket/health`

Returns the current status of the WebSocket server.

**Response:**
```typescript
{
  status: "healthy",
  timestamp: string,
  websocket: {
    namespace: string,
    corsOrigin: string,
    connectedUsers: number,
    activeRooms: number,
    totalTypingUsers: number
  },
  features: {
    detailedLogging: boolean,
    metrics: boolean,
    heartbeat: boolean
  },
  rateLimits: {
    windowMs: number,
    maxMessagesPerWindow: number,
    maxJoinsPerWindow: number,
    maxTypingEventsPerWindow: number
  }
}
```

### Detailed Statistics
**GET** `/websocket/stats`

Returns detailed WebSocket server statistics.

**Response:**
```typescript
{
  timestamp: string,
  connections: {
    current: number,
    total: number,
    totalDisconnections: number
  },
  rooms: {
    active: number,
    totalCreated: number,
    details: Array<{
      roomId: string,
      userCount: number,
      typingUsers: number,
      createdAt: string,
      lastActivity: string
    }>
  },
  messages: {
    totalProcessed: number
  },
  rateLimiting: {
    violations: number
  }
}
```

## Client Implementation Example

### JavaScript/TypeScript

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001/chat', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to WebSocket');
  
  // Join a room
  socket.emit('joinRoom', { roomId: 'general' });
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});

// Message events
socket.on('receiveMessage', (message) => {
  console.log('New message:', message);
});

socket.emit('sendMessage', {
  content: 'Hello, world!',
  roomId: 'general'
});

// User presence events
socket.on('userOnline', (user) => {
  console.log('User came online:', user.username);
});

socket.on('userOffline', (user) => {
  console.log('User went offline:', user.username);
});

// Typing events
socket.on('userTyping', (data) => {
  if (data.isTyping) {
    console.log(`${data.username} is typing...`);
  } else {
    console.log(`${data.username} stopped typing`);
  }
});

socket.emit('typing', {
  roomId: 'general',
  isTyping: true
});

// Error handling
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Heartbeat
socket.on('ping', () => {
  socket.emit('heartbeat');
});
```

## Configuration

The WebSocket server behavior can be configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `WS_NAMESPACE` | `/chat` | WebSocket namespace |
| `WS_ENABLE_METRICS` | `true` | Enable metrics collection |
| `WS_ENABLE_HEARTBEAT` | `true` | Enable heartbeat |
| `WS_HEARTBEAT_INTERVAL` | `30000` | Heartbeat interval (ms) |
| `NODE_ENV` | `development` | Environment (affects rate limits) |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid payload |
| 401 | Unauthorized - Invalid or missing token |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Best Practices

1. **Always handle errors** - Listen for `error` events
2. **Implement reconnection logic** - Handle disconnections gracefully
3. **Rate limiting awareness** - Don't exceed rate limits
4. **Heartbeat responses** - Respond to `ping` events to maintain connection
5. **Clean up resources** - Leave rooms when appropriate
6. **Validate data** - Always validate received data on the client side

## Security Considerations

1. **Authentication required** - All connections must be authenticated
2. **Input validation** - All inputs are validated and sanitized
3. **Rate limiting** - Prevents spam and abuse
4. **CORS protection** - Only allowed origins can connect
5. **XSS protection** - HTML content is escaped

## Troubleshooting

### Common Issues

1. **Connection rejected** - Check JWT token validity
2. **Rate limit exceeded** - Reduce request frequency
3. **Not receiving messages** - Ensure you've joined the correct room
4. **Disconnections** - Implement heartbeat and reconnection logic

### Debug Mode

Set `NODE_ENV=development` for detailed logging and more lenient rate limits.

### Health Checks

Use the health check endpoints to monitor server status:
- `/websocket/health` - Basic health status
- `/websocket/stats` - Detailed statistics
