import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page';
import { ChatPage } from './page-objects/chat-page';
import { DatabaseHelper } from './utils/database-helper';

test.describe('Chat Functionality', () => {
  let authPage: AuthPage;
  let chatPage: ChatPage;
  let dbHelper: DatabaseHelper;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    chatPage = new ChatPage(page);
    dbHelper = new DatabaseHelper();
    
    await dbHelper.connect();
    await dbHelper.cleanDatabase();
    await dbHelper.seedTestData();
    
    // Login before each test
    await authPage.navigateToLogin();
    await authPage.login({ 
      email: 'testuser@example.com', 
      password: 'TestPassword123!' 
    });
    await chatPage.navigateToChat();
  });

  test.afterEach(async () => {
    await dbHelper.cleanDatabase();
    await dbHelper.disconnect();
  });

  test('should send and receive messages', async () => {
    const testMessage = 'Hello from E2E test!';
    
    // Send message
    await chatPage.sendMessage({ content: testMessage });
    
    // Verify message appears in chat
    await chatPage.waitForMessageSent(testMessage);
    
    // Get all messages and verify
    const messages = await chatPage.getAllMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe(testMessage);
  });

  test('should handle multiple users in chat', async ({ browser }) => {
    // Create second user session
    const secondPage = await browser.newPage();
    const secondAuthPage = new AuthPage(secondPage);
    const secondChatPage = new ChatPage(secondPage);
    
    // Register and login second user
    await secondAuthPage.navigateToRegister();
    await secondAuthPage.register({
      username: 'user2',
      email: 'user2@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    });
    await secondChatPage.navigateToChat();
    
    // Send message from second user
    const message = 'Message from user 2';
    await secondChatPage.sendMessage({ content: message });
    
    // Verify first user receives the message
    await chatPage.waitForMessageReceived(message, 'user2');
    
    await secondPage.close();
  });
  test('should handle connection status', async () => {
    // Navigate to chat and verify connection
    await expect(chatPage.getConnectionStatus()).toContainText('Connected');
    
    // Simulate disconnection
    await chatPage.setOfflineStatus(true);
    
    // Verify disconnected status (may take a moment)
    await expect(chatPage.getConnectionStatus()).toContainText('Disconnected', { timeout: 10000 });
    
    // Reconnect
    await chatPage.setOfflineStatus(false);
    
    // Wait for reconnection
    await chatPage.waitForWebSocketConnection();
  });
});
