import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page';
import { ChatPage } from './page-objects/chat-page';
import { DatabaseHelper } from './utils/database-helper';

test.describe('Performance Tests', () => {
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

  test('should handle rapid message sending', async () => {
    const messageCount = 50;
    const startTime = Date.now();
    
    // Send messages rapidly
    for (let i = 1; i <= messageCount; i++) {
      await chatPage.sendMessage({ content: `Rapid message ${i}` });
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Verify all messages were sent
    const messages = await chatPage.getAllMessages();
    expect(messages).toHaveLength(messageCount);
    
    // Performance assertion - should send messages reasonably fast
    // Allow 100ms per message on average
    expect(totalTime).toBeLessThan(messageCount * 100);
    
    console.log(`Sent ${messageCount} messages in ${totalTime}ms (${totalTime/messageCount}ms per message)`);
  });

  test('should handle large message content', async () => {
    // Create a large message (close to limit)
    const largeMessage = 'A'.repeat(1000); // 1KB message
    
    const startTime = Date.now();
    await chatPage.sendMessage({ content: largeMessage });
    const endTime = Date.now();
    
    const sendTime = endTime - startTime;
    
    // Verify message was sent
    const messages = await chatPage.getAllMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe(largeMessage);
    
    // Should handle large messages in reasonable time
    expect(sendTime).toBeLessThan(5000); // 5 seconds max
    
    console.log(`Large message sent in ${sendTime}ms`);
  });

  test('should maintain performance with message history', async () => {
    // Send initial batch of messages
    for (let i = 1; i <= 100; i++) {
      await chatPage.sendMessage({ content: `History message ${i}` });
    }
    
    // Measure performance of sending additional messages
    const startTime = Date.now();
    await chatPage.sendMessage({ content: 'Performance test message' });
    const endTime = Date.now();
    
    const sendTime = endTime - startTime;
    
    // Should not significantly slow down with message history
    expect(sendTime).toBeLessThan(2000); // 2 seconds max
    
    console.log(`Message sent with 100+ history in ${sendTime}ms`);
  });

  test('should handle WebSocket reconnection efficiently', async () => {
    // Measure initial connection time
    await chatPage.setOfflineStatus(true);
    
    const startReconnect = Date.now();
    await chatPage.setOfflineStatus(false);
    await chatPage.waitForWebSocketConnection();
    const endReconnect = Date.now();
    
    const reconnectTime = endReconnect - startReconnect;
    
    // Verify connection is restored
    await expect(chatPage.getConnectionStatus()).toContainText('Connected');
    
    // Reconnection should be fast
    expect(reconnectTime).toBeLessThan(5000); // 5 seconds max
    
    console.log(`WebSocket reconnected in ${reconnectTime}ms`);
  });
  test('should handle concurrent users efficiently', async ({ browser }) => {
    const userCount = 5;
    const contexts: Array<{context: any, page: any, chatPage: ChatPage}> = [];
    
    // Create multiple user sessions
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const authPage = new AuthPage(page);
      const chatPage = new ChatPage(page);
      
      await authPage.navigateToRegister();
      await authPage.register({
        username: `user${i + 1}`,
        email: `user${i + 1}@example.com`,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      });
      await chatPage.navigateToChat();
      
      contexts.push({ context, page, chatPage });
    }
    
    // Measure performance of concurrent message sending
    const startTime = Date.now();
    
    // All users send messages simultaneously
    const promises = contexts.map((ctx, index) => 
      ctx.chatPage.sendMessage({ content: `Concurrent message from user ${index + 1}` })
    );
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    const concurrentTime = endTime - startTime;
    
    // Verify all messages were sent
    const firstUserMessages = await contexts[0].chatPage.getAllMessages();
    expect(firstUserMessages.length).toBeGreaterThanOrEqual(userCount);
    
    // Should handle concurrent users efficiently
    expect(concurrentTime).toBeLessThan(10000); // 10 seconds max
    
    console.log(`${userCount} concurrent users sent messages in ${concurrentTime}ms`);
    
    // Clean up
    for (const ctx of contexts) {
      await ctx.context.close();
    }
  });

  test('should load page efficiently', async ({ page }) => {
    // Measure page load performance
    const startTime = Date.now();
    
    await chatPage.navigateToChat();
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Verify page loaded correctly
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    // Page should load quickly
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
    
    console.log(`Chat page loaded in ${loadTime}ms`);
  });

  test('should handle scroll performance with many messages', async () => {
    // Send many messages to create scroll content
    for (let i = 1; i <= 200; i++) {
      await chatPage.sendMessage({ content: `Scroll test message ${i}` });
    }
    
    const chatContainer = chatPage.getPage().locator('[data-testid="messages-list"]');
    
    // Measure scroll performance
    const startTime = Date.now();
    
    // Scroll to top
    await chatContainer.evaluate(element => {
      element.scrollTop = 0;
    });
    
    // Wait for any lazy loading
    await chatPage.getPage().waitForTimeout(1000);
    
    // Scroll to bottom
    await chatContainer.evaluate(element => {
      element.scrollTop = element.scrollHeight;
    });
    
    const endTime = Date.now();
    const scrollTime = endTime - startTime;
    
    // Scrolling should be smooth and fast
    expect(scrollTime).toBeLessThan(3000); // 3 seconds max
    
    console.log(`Scrolled through 200 messages in ${scrollTime}ms`);
  });

  test('should maintain memory usage within limits', async ({ page }) => {
    // Send messages and monitor memory
    const initialMetrics = await page.evaluate(() => {
      return {
        usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
        totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0
      };
    });
    
    // Send many messages
    for (let i = 1; i <= 100; i++) {
      await chatPage.sendMessage({ content: `Memory test message ${i}` });
    }
    
    const finalMetrics = await page.evaluate(() => {
      return {
        usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
        totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0
      };
    });
    
    const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
    
    // Memory increase should be reasonable (less than 50MB for 100 messages)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    console.log(`Memory increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for 100 messages`);
  });
});
