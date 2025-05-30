import { test, expect, devices } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page';
import { ChatPage } from './page-objects/chat-page';
import { DatabaseHelper } from './utils/database-helper';

test.describe('Cross-Platform Compatibility', () => {
  let dbHelper: DatabaseHelper;

  test.beforeEach(async () => {
    dbHelper = new DatabaseHelper();
    await dbHelper.connect();
    await dbHelper.cleanDatabase();
    await dbHelper.seedTestData();
  });

  test.afterEach(async () => {
    await dbHelper.cleanDatabase();
    await dbHelper.disconnect();
  });

  // Desktop browsers
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`should work on ${browserName}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const authPage = new AuthPage(page);
      const chatPage = new ChatPage(page);
      
      // Test basic functionality
      await authPage.navigateToLogin();
      await authPage.login({ 
        email: 'testuser@example.com', 
        password: 'TestPassword123!' 
      });
      
      await chatPage.navigateToChat();
      await chatPage.sendMessage({ content: 'Cross-platform test message' });
      
      // Verify message was sent
      const messages = await chatPage.getAllMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Cross-platform test message');
      
      await context.close();
    });
  });

  // Mobile devices
  test('should work on iPhone Safari', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13']
    });
    const page = await context.newPage();
    
    const authPage = new AuthPage(page);
    const chatPage = new ChatPage(page);
    
    // Test mobile-specific interactions
    await authPage.navigateToLogin();
    await authPage.login({ 
      email: 'testuser@example.com', 
      password: 'TestPassword123!' 
    });
    
    await chatPage.navigateToChat();
    
    // Test touch interactions
    await chatPage.sendMessage({ content: 'Mobile test message' });
    
    // Verify responsive layout
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    
    await context.close();
  });

  test('should work on Android Chrome', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Pixel 5']
    });
    const page = await context.newPage();
    
    const authPage = new AuthPage(page);
    const chatPage = new ChatPage(page);
    
    await authPage.navigateToLogin();
    await authPage.login({ 
      email: 'testuser@example.com', 
      password: 'TestPassword123!' 
    });
    
    await chatPage.navigateToChat();
    await chatPage.sendMessage({ content: 'Android test message' });
    
    // Verify mobile-specific features
    const messages = await chatPage.getAllMessages();
    expect(messages).toHaveLength(1);
    
    await context.close();
  });

  test('should work on iPad', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPad Pro']
    });
    const page = await context.newPage();
    
    const authPage = new AuthPage(page);
    const chatPage = new ChatPage(page);
    
    await authPage.navigateToLogin();
    await authPage.login({ 
      email: 'testuser@example.com', 
      password: 'TestPassword123!' 
    });
    
    await chatPage.navigateToChat();
    
    // Test tablet-specific layout
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    // Test orientation changes
    await page.setViewportSize({ width: 1024, height: 768 }); // Landscape
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    await page.setViewportSize({ width: 768, height: 1024 }); // Portrait
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    await context.close();
  });

  test('should handle different screen resolutions', async ({ browser }) => {
    const resolutions = [
      { width: 1920, height: 1080, name: 'Full HD' },
      { width: 1366, height: 768, name: 'Laptop' },
      { width: 1280, height: 800, name: 'Small Desktop' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 375, height: 667, name: 'Mobile' }
    ];
    
    for (const resolution of resolutions) {
      const context = await browser.newContext({
        viewport: { width: resolution.width, height: resolution.height }
      });
      const page = await context.newPage();
      
      const authPage = new AuthPage(page);
      const chatPage = new ChatPage(page);
      
      await authPage.navigateToLogin();
      await authPage.login({ 
        email: 'testuser@example.com', 
        password: 'TestPassword123!' 
      });
      
      await chatPage.navigateToChat();
      
      // Verify layout works at this resolution
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
      
      // Test message sending at this resolution
      await chatPage.sendMessage({ content: `Test at ${resolution.name}` });
      
      const messages = await chatPage.getAllMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      await context.close();
    }
  });

  test('should handle different user agents', async ({ browser }) => {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    for (const userAgent of userAgents) {
      const context = await browser.newContext({
        userAgent: userAgent
      });
      const page = await context.newPage();
      
      const authPage = new AuthPage(page);
      const chatPage = new ChatPage(page);
      
      await authPage.navigateToLogin();
      await authPage.login({ 
        email: 'testuser@example.com', 
        password: 'TestPassword123!' 
      });
      
      await chatPage.navigateToChat();
      await chatPage.sendMessage({ content: 'User agent test' });
      
      const messages = await chatPage.getAllMessages();
      expect(messages).toHaveLength(1);
      
      await context.close();
    }
  });

  test('should work with keyboard navigation', async ({ page }) => {
    const authPage = new AuthPage(page);
    const chatPage = new ChatPage(page);
    
    await authPage.navigateToLogin();
    
    // Navigate using keyboard
    await page.keyboard.press('Tab'); // Email field
    await page.keyboard.type('testuser@example.com');
    await page.keyboard.press('Tab'); // Password field
    await page.keyboard.type('TestPassword123!');
    await page.keyboard.press('Enter'); // Submit form
    
    // Wait for navigation to chat
    await chatPage.navigateToChat();
    
    // Test keyboard message sending
    await page.keyboard.press('Tab'); // Navigate to message input
    await page.keyboard.type('Keyboard navigation test');
    await page.keyboard.press('Enter'); // Send message
    
    const messages = await chatPage.getAllMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Keyboard navigation test');
  });
});
