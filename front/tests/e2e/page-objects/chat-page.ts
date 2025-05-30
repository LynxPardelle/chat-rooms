import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { WebSocketHelper } from '../utils/websocket-helper';

export interface SendMessageOptions {
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE';
  roomId?: string;
}

/**
 * Chat Page Object Model
 * Handles chat interface interactions and WebSocket events
 */
export class ChatPage extends BasePage {
  private wsHelper: WebSocketHelper;

  // Chat-specific selectors
  private readonly chatSelectors = {
    // Main chat interface
    chatContainer: '[data-testid="chat-container"]',
    messageInput: '[data-testid="message-input"]',
    sendButton: '[data-testid="send-button"]',
    fileUploadButton: '[data-testid="file-upload-button"]',
    
    // Messages
    messagesList: '[data-testid="messages-list"]',
    messageItem: '[data-testid="message-item"]',
    messageContent: '[data-testid="message-content"]',
    messageAuthor: '[data-testid="message-author"]',
    messageTimestamp: '[data-testid="message-timestamp"]',
    messageStatus: '[data-testid="message-status"]',
    
    // Real-time indicators
    typingIndicator: '[data-testid="typing-indicator"]',
    onlineUsers: '[data-testid="online-users"]',
    connectionStatus: '[data-testid="connection-status"]',
    
    // Room management
    roomSelector: '[data-testid="room-selector"]',
    currentRoom: '[data-testid="current-room"]',
    createRoomButton: '[data-testid="create-room-button"]',
    joinRoomButton: '[data-testid="join-room-button"]',
    leaveRoomButton: '[data-testid="leave-room-button"]',
    
    // User list
    usersList: '[data-testid="users-list"]',
    userItem: '[data-testid="user-item"]',
    userStatus: '[data-testid="user-status"]',
    
    // Settings
    chatSettings: '[data-testid="chat-settings"]',
    themeSelector: '[data-testid="theme-selector"]',
    notificationToggle: '[data-testid="notification-toggle"]',
  };

  constructor(page: Page) {
    super(page);
    this.wsHelper = new WebSocketHelper(page);
  }

  /**
   * Navigate to chat page
   */
  async navigateToChat(): Promise<void> {
    await this.navigateTo('/');
    await this.waitForChatToLoad();
  }

  /**
   * Wait for chat interface to fully load
   */
  async waitForChatToLoad(): Promise<void> {
    await this.waitForPageLoad();
    await this.page.waitForSelector(this.chatSelectors.chatContainer);
    
    // Wait for WebSocket connection
    await this.waitForWebSocketConnection();
  }

  /**
   * Wait for WebSocket connection to be established
   */
  async waitForWebSocketConnection(): Promise<void> {
    const connectionStatus = this.page.locator(this.chatSelectors.connectionStatus);
    await expect(connectionStatus).toContainText('Connected', { timeout: 10000 });
  }

  /**
   * Send a message
   */
  async sendMessage(options: SendMessageOptions): Promise<void> {
    const { content, type = 'TEXT' } = options;
    
    // Fill message input
    await this.fillInput(this.chatSelectors.messageInput, content);
    
    // Handle file uploads if needed
    if (type === 'IMAGE' || type === 'FILE') {
      await this.handleFileUpload();
    }
    
    // Send message
    await this.clickElement(this.chatSelectors.sendButton);
    
    // Verify message was sent
    await this.waitForMessageSent(content);
  }

  /**
   * Wait for message to appear in chat
   */
  async waitForMessageSent(content: string): Promise<void> {
    const messageItem = this.page.locator(this.chatSelectors.messageItem).filter({
      hasText: content
    }).last();
    
    await messageItem.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Wait for message to be received from another user
   */
  async waitForMessageReceived(content: string, fromUser?: string): Promise<void> {
    const messageSelector = fromUser 
      ? `${this.chatSelectors.messageItem}:has(${this.chatSelectors.messageAuthor}:text("${fromUser}"))`
      : this.chatSelectors.messageItem;
    
    const messageItem = this.page.locator(messageSelector).filter({
      hasText: content
    }).last();
    
    await messageItem.waitFor({ state: 'visible', timeout: 15000 });
  }
  /**
   * Get all messages in chat
   */
  async getAllMessages(): Promise<Array<{content: string, author: string, timestamp: string}>> {
    const messageItems = this.page.locator(this.chatSelectors.messageItem);
    const count = await messageItems.count();
    
    const messages: Array<{content: string, author: string, timestamp: string}> = [];
    for (let i = 0; i < count; i++) {
      const item = messageItems.nth(i);
      const content = await item.locator(this.chatSelectors.messageContent).textContent() || '';
      const author = await item.locator(this.chatSelectors.messageAuthor).textContent() || '';
      const timestamp = await item.locator(this.chatSelectors.messageTimestamp).textContent() || '';
      
      messages.push({ content, author, timestamp });
    }
    
    return messages;
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    return await this.getElementCount(this.chatSelectors.messageItem);
  }

  /**
   * Start typing (triggers typing indicator)
   */
  async startTyping(): Promise<void> {
    const input = this.page.locator(this.chatSelectors.messageInput);
    await input.focus();
    await input.type('typing...', { delay: 100 });
  }

  /**
   * Stop typing
   */
  async stopTyping(): Promise<void> {
    const input = this.page.locator(this.chatSelectors.messageInput);
    await input.clear();
  }

  /**
   * Wait for typing indicator to appear
   */
  async waitForTypingIndicator(user?: string): Promise<void> {
    const indicator = this.page.locator(this.chatSelectors.typingIndicator);
    await indicator.waitFor({ state: 'visible', timeout: 5000 });
    
    if (user) {
      await expect(indicator).toContainText(user);
    }
  }

  /**
   * Wait for typing indicator to disappear
   */
  async waitForTypingIndicatorToDisappear(): Promise<void> {
    const indicator = this.page.locator(this.chatSelectors.typingIndicator);
    await indicator.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Join a room
   */
  async joinRoom(roomId: string): Promise<void> {
    await this.clickElement(this.chatSelectors.roomSelector);
    
    // Select room from dropdown or enter room ID
    const roomOption = this.page.locator(`[data-room-id="${roomId}"]`);
    if (await roomOption.isVisible()) {
      await roomOption.click();
    } else {
      // If room doesn't exist, create it
      await this.createRoom(roomId);
    }
    
    await this.waitForRoomJoined(roomId);
  }

  /**
   * Create a new room
   */
  async createRoom(roomName: string): Promise<void> {
    await this.clickElement(this.chatSelectors.createRoomButton);
    
    // Fill room name in modal
    await this.fillInput('[data-testid="room-name-input"]', roomName);
    await this.clickElement(this.selectors.confirmButton);
    
    await this.waitForRoomJoined(roomName);
  }

  /**
   * Leave current room
   */
  async leaveRoom(): Promise<void> {
    await this.clickElement(this.chatSelectors.leaveRoomButton);
    await this.clickElement(this.selectors.confirmButton);
  }

  /**
   * Wait for room to be joined
   */
  async waitForRoomJoined(roomId: string): Promise<void> {
    const currentRoom = this.page.locator(this.chatSelectors.currentRoom);
    await expect(currentRoom).toContainText(roomId, { timeout: 10000 });
  }
  /**
   * Get list of online users
   */
  async getOnlineUsers(): Promise<string[]> {
    const userItems = this.page.locator(this.chatSelectors.userItem);
    const count = await userItems.count();
    
    const users: string[] = [];
    for (let i = 0; i < count; i++) {
      const username = await userItems.nth(i).textContent();
      if (username) {
        users.push(username.trim());
      }
    }
    
    return users;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(username: string): Promise<boolean> {
    const onlineUsers = await this.getOnlineUsers();
    return onlineUsers.includes(username);
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(filePath?: string): Promise<void> {
    const defaultFile = filePath || './test-assets/sample-image.jpg';
    
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(defaultFile);
    
    // Wait for upload to complete
    await this.waitForText('Upload complete');
  }

  /**
   * Change chat theme
   */
  async changeTheme(theme: string): Promise<void> {
    await this.clickElement(this.chatSelectors.chatSettings);
    await this.selectOption(this.chatSelectors.themeSelector, theme);
    
    // Wait for theme to be applied
    await this.page.waitForTimeout(1000);
  }

  /**
   * Toggle notifications
   */
  async toggleNotifications(): Promise<void> {
    await this.clickElement(this.chatSelectors.notificationToggle);
  }

  /**
   * Scroll to bottom of messages
   */
  async scrollToBottomOfMessages(): Promise<void> {
    const messagesList = this.page.locator(this.chatSelectors.messagesList);
    await messagesList.evaluate(el => el.scrollTop = el.scrollHeight);
  }

  /**
   * Scroll to top of messages
   */
  async scrollToTopOfMessages(): Promise<void> {
    const messagesList = this.page.locator(this.chatSelectors.messagesList);
    await messagesList.evaluate(el => el.scrollTop = 0);
  }

  /**
   * Clear message input
   */
  async clearMessageInput(): Promise<void> {
    const input = this.page.locator(this.chatSelectors.messageInput);
    await input.clear();
  }

  /**
   * Get WebSocket helper for direct WebSocket testing
   */
  getWebSocketHelper(): WebSocketHelper {
    return this.wsHelper;
  }

  /**
   * Get connection status locator
   */
  getConnectionStatus(): Locator {
    return this.page.locator(this.chatSelectors.connectionStatus);
  }

  /**
   * Set page offline/online status
   */
  async setOfflineStatus(offline: boolean): Promise<void> {
    await this.page.context().setOffline(offline);
  }

  /**
   * Get page instance for direct access
   */
  getPage(): Page {
    return this.page;
  }

  /**
   * Verify chat UI elements are visible
   */
  async verifyChatUIElements(): Promise<void> {
    await expect(this.page.locator(this.chatSelectors.chatContainer)).toBeVisible();
    await expect(this.page.locator(this.chatSelectors.messageInput)).toBeVisible();
    await expect(this.page.locator(this.chatSelectors.sendButton)).toBeVisible();
    await expect(this.page.locator(this.chatSelectors.messagesList)).toBeVisible();
    await expect(this.page.locator(this.chatSelectors.onlineUsers)).toBeVisible();
  }
}
