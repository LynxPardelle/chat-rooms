import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017/chat-rooms',
  user: process.env.MONGO_USER || '',
  password: process.env.MONGO_PASSWORD || '',
  dbName: process.env.MONGO_DB_NAME || 'chat-rooms',
  options: {
    // Connection pool optimizations for high-performance scenarios
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10'), // Maximum connections in pool
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '5'),  // Minimum connections maintained
    maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME || '30000'), // 30 seconds
    waitQueueTimeoutMS: parseInt(process.env.MONGO_WAIT_QUEUE_TIMEOUT || '5000'), // 5 seconds
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT || '5000'), // 5 seconds
    socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT || '45000'), // 45 seconds
    heartbeatFrequencyMS: parseInt(process.env.MONGO_HEARTBEAT_FREQUENCY || '10000'), // 10 seconds
    
    // Write concern for optimal performance vs durability balance
    writeConcern: {
      w: process.env.MONGO_WRITE_CONCERN || 'majority',
      j: process.env.MONGO_JOURNAL === 'true', // Journal writes for durability
      wtimeout: parseInt(process.env.MONGO_WRITE_TIMEOUT || '5000'), // 5 seconds
    },
    
    // Read preference for load distribution
    readPreference: process.env.MONGO_READ_PREFERENCE || 'primary',
    readConcern: { level: process.env.MONGO_READ_CONCERN || 'local' },
    
    // Compression for network efficiency (note: removed deprecated compressors format)
    
    // Monitoring and logging
    monitorCommands: process.env.NODE_ENV === 'development',
    
    // SSL/TLS settings
    tls: process.env.MONGO_SSL === 'true',
    
    // Authentication source
    authSource: process.env.MONGO_AUTH_SOURCE || 'admin',
  },
}));
