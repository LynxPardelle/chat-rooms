# Test Data Setup Guide

## Overview

This guide provides instructions for setting up test data and test scenarios for manual testing of the Chat Rooms application.

## Database Setup

### Test Users

Create the following test users in your database:

```javascript
// User 1 - Primary test user
{
  username: "testuser1",
  email: "testuser1@example.com",
  password: "TestPassword123!", // hashed
  isActive: true,
  createdAt: new Date(),
  preferences: {
    theme: "light",
    textColor: "#000000",
    backgroundColor: "#ffffff"
  }
}

// User 2 - Secondary test user for multi-user testing
{
  username: "testuser2", 
  email: "testuser2@example.com",
  password: "TestPassword123!", // hashed
  isActive: true,
  createdAt: new Date(),
  preferences: {
    theme: "dark",
    textColor: "#ffffff", 
    backgroundColor: "#1a1a1a"
  }
}

// User 3 - Admin user (if roles implemented)
{
  username: "admin",
  email: "admin@example.com", 
  password: "AdminPassword123!", // hashed
  isActive: true,
  role: "admin",
  createdAt: new Date()
}

// User 4 - Inactive user for testing inactive states
{
  username: "inactiveuser",
  email: "inactive@example.com",
  password: "TestPassword123!", // hashed
  isActive: false,
  createdAt: new Date()
}
```

### Test Messages

Create sample chat messages:

```javascript
[
  {
    userId: "testuser1_id",
    username: "testuser1",
    content: "Hello everyone! This is a test message.",
    timestamp: new Date(),
    type: "text"
  },
  {
    userId: "testuser2_id", 
    username: "testuser2",
    content: "Hi there! How is everyone doing today?",
    timestamp: new Date(),
    type: "text"
  },
  {
    userId: "testuser1_id",
    username: "testuser1", 
    content: "This is a longer test message to see how the application handles messages with more content. It should wrap properly and display nicely in the chat interface.",
    timestamp: new Date(),
    type: "text"
  },
  {
    userId: "testuser2_id",
    username: "testuser2",
    content: "Here's a message with special characters: !@#$%^&*()_+-=[]{}|;':\",./<>?`~",
    timestamp: new Date(),
    type: "text"
  },
  {
    userId: "testuser1_id",
    username: "testuser1",
    content: "Testing emoji support 😊 🎉 🚀 ❤️ 👍",
    timestamp: new Date(),
    type: "text"
  }
]
```

## Test Scenarios Setup

### Authentication Test Scenarios

#### Valid User Credentials
```
Email: testuser1@example.com
Password: TestPassword123!
```

#### Invalid Credentials for Testing
```
Email: wrong@email.com
Password: wrongpassword
```

#### Edge Case Emails
```
- test+tag@example.com (plus addressing)
- test.dots@example.com (dots in local part)  
- test-hyphen@example.com (hyphens)
- test_underscore@example.com (underscores)
```

### Registration Test Data

#### Valid Registration Data
```
Username: newtestuser
Email: newtestuser@example.com  
Password: NewPassword123!
Confirm Password: NewPassword123!
```

#### Invalid Registration Test Cases

**Invalid Emails:**
```
- invalid-email (missing @)
- test@incomplete (incomplete domain)
- @example.com (missing local part)
- test@.com (invalid domain)
```

**Weak Passwords:**
```
- 123 (too short)
- password (no numbers/special chars)
- PASSWORD123 (no lowercase)  
- password123 (no uppercase)
- Password123 (no special characters)
```

**Username Edge Cases:**
```
- ab (too short)
- verylongusernamethatexceedsmaximumlength (too long)
- user@name (invalid characters)
- 123user (starts with number)
- user name (contains space)
```

### Chat Testing Scenarios

#### Message Content Variations

**Normal Messages:**
```
- "Hello world!"
- "How are you today?"
- "Good morning everyone!"
```

**Long Messages:**
```javascript
const longMessage = "A".repeat(1000); // 1000 character message
const veryLongMessage = "Long message content ".repeat(50); // Very long message
```

**Special Character Messages:**
```
- "Testing special chars: !@#$%^&*()"
- "Unicode test: ñáéíóú"
- "Emoji test: 😊🎉🚀❤️👍"
- "Code snippet: function test() { return true; }"
```

**Empty/Whitespace Messages:**
```
- "" (empty)
- "   " (only spaces)
- "\n\n\n" (only newlines)
- "\t\t\t" (only tabs)
```

### File Upload Test Files

Create test files for avatar upload testing:

#### Valid Image Files
- `test-avatar-small.jpg` (50KB, 100x100px)
- `test-avatar-medium.png` (200KB, 300x300px)  
- `test-avatar-large.jpeg` (800KB, 800x800px)

#### Invalid Files for Testing
- `test-document.pdf` (wrong file type)
- `test-oversized.jpg` (10MB, too large)
- `test-corrupted.jpg` (corrupted image file)
- `test-no-extension` (file without extension)

## Environment Configuration

### Development Environment Variables

```bash
# Frontend (.env.local)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_ENVIRONMENT=development
VITE_DEBUG_MODE=true

# Backend (.env)
PORT=3001
MONGO_URI=mongodb://localhost:27017/livechat-test
JWT_SECRET=test-jwt-secret-key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### Test Database Initialization Script

```javascript
// scripts/setup-test-data.js
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function setupTestData() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('livechat-test');
  
  // Clear existing data
  await db.collection('users').deleteMany({});
  await db.collection('messages').deleteMany({});
  
  // Create test users
  const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
  
  const testUsers = [
    {
      username: 'testuser1',
      email: 'testuser1@example.com',
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      preferences: {
        theme: 'light',
        textColor: '#000000',
        backgroundColor: '#ffffff'
      }
    },
    {
      username: 'testuser2',
      email: 'testuser2@example.com', 
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      preferences: {
        theme: 'dark',
        textColor: '#ffffff',
        backgroundColor: '#1a1a1a'
      }
    }
  ];
  
  await db.collection('users').insertMany(testUsers);
  
  console.log('Test data setup complete!');
  await client.close();
}

setupTestData().catch(console.error);
```

## Test Execution Scripts

### Quick Test Setup Script

```bash
#!/bin/bash
# scripts/quick-test-setup.sh

echo "Setting up test environment..."

# Start services
docker-compose up -d mongodb
npm run dev:backend &
npm run dev:frontend &

# Wait for services to start
sleep 10

# Setup test data
node scripts/setup-test-data.js

echo "Test environment ready!"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:3001"
echo ""
echo "Test credentials:"
echo "User 1: testuser1@example.com / TestPassword123!"
echo "User 2: testuser2@example.com / TestPassword123!"
```

### Test Data Reset Script

```bash
#!/bin/bash
# scripts/reset-test-data.sh

echo "Resetting test data..."

# Reset database
node scripts/setup-test-data.js

# Clear browser storage (optional)
echo "Clear browser localStorage and sessionStorage manually"

echo "Test data reset complete!"
```

## Manual Testing Checklist

### Pre-test Setup
- [ ] Backend server is running
- [ ] Frontend development server is running  
- [ ] Database is connected and accessible
- [ ] Test data is loaded
- [ ] Browser developer tools are open

### Test User Accounts Available
- [ ] testuser1@example.com (primary test user)
- [ ] testuser2@example.com (secondary test user)
- [ ] admin@example.com (admin user, if applicable)
- [ ] inactive@example.com (inactive user for testing)

### Test Files Available
- [ ] Valid image files for avatar upload
- [ ] Invalid files for error testing
- [ ] Various file sizes for testing limits

### Test Scenarios Ready
- [ ] Valid and invalid login credentials prepared
- [ ] Registration test data prepared
- [ ] Chat message test content prepared
- [ ] Error scenario data prepared

## Troubleshooting Test Setup

### Common Issues

**Database Connection Failed:**
```bash
# Check MongoDB is running
docker ps
# or
brew services list | grep mongodb
```

**Test Users Not Created:**
```bash
# Verify database connection and run setup script again
node scripts/setup-test-data.js
```

**Frontend/Backend Not Communicating:**
```bash
# Check CORS settings and environment variables
# Verify API_URL in frontend matches backend port
```

**File Upload Not Working:**
```bash
# Check file permissions in upload directory
# Verify file size limits in backend configuration
```

### Reset Commands

```bash
# Complete environment reset
npm run test:reset

# Database only reset  
npm run test:reset-db

# Frontend cache reset
npm run test:reset-frontend
```

## Test Data Validation

After setup, verify test data with these queries:

```javascript
// MongoDB queries to verify test data
db.users.find({}).pretty()
db.messages.find({}).sort({timestamp: -1}).limit(10).pretty()
db.users.countDocuments({isActive: true})
```

## Notes for Testers

1. **Always start with fresh test data** for consistent results
2. **Use different browsers** for multi-user testing scenarios  
3. **Keep browser developer tools open** to monitor for errors
4. **Clear browser cache** between test sessions if needed
5. **Document any data-related issues** found during testing
6. **Report any test data that needs to be added** for better coverage

---

**Test Data Setup Complete:** ☐ Yes ☐ No  
**All Test Users Accessible:** ☐ Yes ☐ No  
**Test Environment Verified:** ☐ Yes ☐ No
