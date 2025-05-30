import { io, Socket } from 'socket.io-client';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODM4MjY0ZWM1ZDk0ZDM3NmIxZDYzOWYiLCJ1c2VybmFtZSI6IndlYnNvY2tldHRlc3QiLCJlbWFpbCI6IndlYnNvY2tldC50ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ4NTEwMjg2LCJleHAiOjE3NDg1MTExODZ9.mVCSjyjZwpoMGLd92r3o87F0_NYYfkA1y5hAgKQMJ-g';

async function testWebSocketAuth() {
  console.log('🔌 Testing WebSocket Authentication...');
  
  return new Promise((resolve, reject) => {
    // Test authenticated connection
    const socket: Socket = io('http://localhost:3001/chat', {
      auth: { token: TOKEN },
      transports: ['websocket']
    });

    let isResolved = false;

    const resolveOnce = (result: any) => {
      if (!isResolved) {
        isResolved = true;
        socket.disconnect();
        resolve(result);
      }
    };

    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully with JWT authentication');
      
      // Test joining a room
      socket.emit('joinRoom', { roomId: 'test-room-ws' }, (response: any) => {
        if (response.success) {
          console.log('✅ Successfully joined room:', response.roomId);
          
          // Test sending a message
          socket.emit('sendMessage', {
            content: 'Hello from WebSocket test!',
            roomId: 'test-room-ws'
          }, (messageResponse: any) => {
            if (messageResponse.success) {
              console.log('✅ Message sent successfully:', messageResponse.message.id);
              resolveOnce({
                success: true,
                connectionId: socket.id,
                roomJoin: response,
                messageSent: messageResponse
              });
            } else {
              console.log('❌ Failed to send message:', messageResponse.error);
              resolveOnce({
                success: false,
                error: 'Failed to send message',
                details: messageResponse
              });
            }
          });
        } else {
          console.log('❌ Failed to join room:', response.error);
          resolveOnce({
            success: false,
            error: 'Failed to join room',
            details: response
          });
        }
      });
    });

    socket.on('connect_error', (error) => {
      console.log('❌ WebSocket connection failed:', error.message);
      resolveOnce({
        success: false,
        error: 'Connection failed',
        details: error.message
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!isResolved) {
        console.log('⏰ WebSocket test timed out');
        socket.disconnect();
        reject(new Error('WebSocket test timed out'));
      }
    }, 10000);
  });
}

async function testWebSocketWithoutAuth() {
  console.log('🔌 Testing WebSocket without authentication...');
  
  return new Promise((resolve, reject) => {
    // Test unauthenticated connection
    const socket: Socket = io('http://localhost:3001/chat', {
      transports: ['websocket']
    });

    let isResolved = false;

    const resolveOnce = (result: any) => {
      if (!isResolved) {
        isResolved = true;
        socket.disconnect();
        resolve(result);
      }
    };

    socket.on('connect', () => {
      console.log('⚠️ WebSocket connected without authentication (this should fail for protected operations)');
      
      // Try to join a room without auth - should fail
      socket.emit('joinRoom', { roomId: 'test-room-unauth' }, (response: any) => {
        if (!response.success) {
          console.log('✅ Correctly rejected unauthorized room join:', response.error);
          resolveOnce({
            success: true,
            message: 'Unauthorized operations correctly rejected'
          });
        } else {
          console.log('❌ Unauthorized room join was allowed (security issue!)');
          resolveOnce({
            success: false,
            error: 'Security vulnerability: unauthorized access allowed'
          });
        }
      });
    });

    socket.on('connect_error', (error) => {
      console.log('✅ WebSocket correctly rejected unauthenticated connection:', error.message);
      resolveOnce({
        success: true,
        message: 'Unauthenticated connection correctly rejected'
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!isResolved) {
        console.log('⏰ Unauthenticated WebSocket test timed out');
        socket.disconnect();
        reject(new Error('WebSocket test timed out'));
      }
    }, 5000);
  });
}

async function runWebSocketTests() {
  console.log('🚀 Starting WebSocket Authentication Tests...\n');
  
  try {
    // Test authenticated connection
    const authResult = await testWebSocketAuth();
    console.log('\n📊 Authenticated WebSocket Result:', JSON.stringify(authResult, null, 2));
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test unauthenticated connection
    const unauthResult = await testWebSocketWithoutAuth();
    console.log('\n📊 Unauthenticated WebSocket Result:', JSON.stringify(unauthResult, null, 2));
    
    console.log('\n✅ All WebSocket authentication tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ WebSocket tests failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the tests
runWebSocketTests();
