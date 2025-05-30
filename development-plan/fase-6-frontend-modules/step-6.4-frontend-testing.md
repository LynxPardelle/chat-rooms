# Step 6.4: Frontend Testing Implementation

## Overview

Implement comprehensive frontend testing strategy including unit tests, integration tests, E2E tests, and visual regression testing for the Chat Rooms application.

## Implementation Details

### 1. Testing Setup and Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './src/test')
    }
  }
});

// src/test/setup.ts
import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Cleanup after each test
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});
```

### 2. Testing Utilities

```typescript
// src/test/utils.tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock providers for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  queryClient?: QueryClient;
}

const AllTheProviders: React.FC<{ 
  children: React.ReactNode;
  queryClient: QueryClient;
  initialRoute?: string;
}> = ({ children, queryClient, initialRoute = '/' }) => {
  window.history.pushState({}, 'Test page', initialRoute);
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialRoute, queryClient = createTestQueryClient(), ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient} initialRoute={initialRoute}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock data factories
export const createMockUser = (overrides = {}): User => ({
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  avatar: 'https://example.com/avatar.jpg',
  roles: ['user'],
  isOnline: true,
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockMessage = (overrides = {}): Message => ({
  id: 'msg-1',
  content: 'Test message',
  senderId: 'user-1',
  senderName: 'Test User',
  senderAvatar: 'https://example.com/avatar.jpg',
  roomId: 'room-1',
  type: 'text',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockRoom = (overrides = {}): Room => ({
  id: 'room-1',
  name: 'Test Room',
  description: 'A test room',
  type: 'public',
  avatar: 'https://example.com/room.jpg',
  memberCount: 5,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// API mocking utilities
export const mockApiCall = <T>(data: T, delay = 100) =>
  vi.fn().mockImplementation(() =>
    new Promise((resolve) => setTimeout(() => resolve(data), delay))
  );

export const mockApiError = (error: string, delay = 100) =>
  vi.fn().mockImplementation(() =>
    new Promise((_, reject) => setTimeout(() => reject(new Error(error)), delay))
  );

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
```

### 3. Component Unit Tests

```typescript
// src/components/ui/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@test/utils';
import { Button } from '../Button';

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary-600');
  });

  it('applies variant classes correctly', () => {
    render(<Button variant="secondary">Secondary</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gray-600');
  });

  it('shows loading state', () => {
    render(<Button isLoading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Button</Button>);
    
    expect(ref).toHaveBeenCalled();
  });
});
```

```typescript
// src/components/chat/__tests__/MessageBubble.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@test/utils';
import { MessageBubble } from '../MessageBubble';
import { createMockMessage } from '@test/utils';

describe('MessageBubble Component', () => {
  const mockMessage = createMockMessage();

  it('renders message content', () => {
    render(
      <MessageBubble 
        message={mockMessage} 
        isOwnMessage={false} 
        showTimestamp={true} 
      />
    );
    
    expect(screen.getByText(mockMessage.content)).toBeInTheDocument();
  });

  it('applies correct styles for own messages', () => {
    render(
      <MessageBubble 
        message={mockMessage} 
        isOwnMessage={true} 
        showTimestamp={true} 
      />
    );
    
    const bubble = screen.getByText(mockMessage.content).closest('div');
    expect(bubble).toHaveClass('bg-primary-600');
  });

  it('shows timestamp when specified', () => {
    render(
      <MessageBubble 
        message={mockMessage} 
        isOwnMessage={false} 
        showTimestamp={true} 
      />
    );
    
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('shows message actions on hover', async () => {
    render(
      <MessageBubble 
        message={mockMessage} 
        isOwnMessage={false} 
        showTimestamp={true} 
      />
    );
    
    const bubble = screen.getByText(mockMessage.content).closest('.group');
    fireEvent.mouseEnter(bubble!);
    
    expect(screen.getByTestId('message-actions')).toBeInTheDocument();
  });

  it('handles reaction clicks', () => {
    const onReaction = vi.fn();
    render(
      <MessageBubble 
        message={mockMessage} 
        isOwnMessage={false} 
        showTimestamp={true}
        onReaction={onReaction}
      />
    );
    
    const reactionButton = screen.getByLabelText('Add reaction');
    fireEvent.click(reactionButton);
    
    expect(onReaction).toHaveBeenCalled();
  });
});
```

### 4. Store Testing

```typescript
// src/stores/__tests__/chatStore.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../chatStore';
import { createMockMessage, createMockRoom } from '@test/utils';

// Mock API service
vi.mock('@/services/apiService', () => ({
  apiService: {
    chat: {
      getRooms: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn()
    }
  }
}));

describe('Chat Store', () => {
  beforeEach(() => {
    // Reset store
    useChatStore.setState({
      rooms: [],
      messages: {},
      currentRoom: null,
      loadingRooms: false,
      loadingMessages: {}
    });
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useChatStore());
    
    expect(result.current.rooms).toEqual([]);
    expect(result.current.messages).toEqual({});
    expect(result.current.currentRoom).toBeNull();
  });

  it('loads rooms successfully', async () => {
    const mockRooms = [createMockRoom(), createMockRoom({ id: 'room-2' })];
    const { apiService } = await import('@/services/apiService');
    vi.mocked(apiService.chat.getRooms).mockResolvedValue(mockRooms);

    const { result } = renderHook(() => useChatStore());
    
    await act(async () => {
      await result.current.loadRooms();
    });
    
    expect(result.current.rooms).toEqual(mockRooms);
    expect(result.current.loadingRooms).toBe(false);
  });

  it('adds new message to store', () => {
    const { result } = renderHook(() => useChatStore());
    const mockMessage = createMockMessage();
    
    act(() => {
      result.current.addMessage('room-1', mockMessage);
    });
    
    expect(result.current.messages['room-1']).toContain(mockMessage);
  });

  it('handles loading states correctly', async () => {
    const { result } = renderHook(() => useChatStore());
    
    act(() => {
      result.current.loadMessages('room-1');
    });
    
    expect(result.current.loadingMessages['room-1']).toBe(true);
  });
});
```

### 5. Integration Tests

```typescript
// src/components/chat/__tests__/ChatContainer.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@test/utils';
import { ChatContainer } from '../ChatContainer';
import { createMockMessage, createMockRoom } from '@test/utils';

// Mock WebSocket
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ socket: mockSocket })
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'testuser' }
  })
}));

describe('ChatContainer Integration', () => {
  const mockRoom = createMockRoom();
  const mockMessages = [
    createMockMessage(),
    createMockMessage({ id: 'msg-2', content: 'Second message' })
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads messages on room change', async () => {
    render(<ChatContainer roomId={mockRoom.id} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
    });
  });

  it('sends message when form is submitted', async () => {
    render(<ChatContainer roomId={mockRoom.id} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByLabelText('Send message');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('send-message', {
        roomId: mockRoom.id,
        content: 'Test message'
      });
    });
  });

  it('joins room on mount and leaves on unmount', () => {
    const { unmount } = render(<ChatContainer roomId={mockRoom.id} />);
    
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', mockRoom.id);
    
    unmount();
    
    expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', mockRoom.id);
  });

  it('handles typing indicators', () => {
    render(<ChatContainer roomId={mockRoom.id} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    
    fireEvent.change(input, { target: { value: 'Typing...' } });
    
    expect(mockSocket.emit).toHaveBeenCalledWith('typing', {
      roomId: mockRoom.id,
      isTyping: true
    });
  });
});
```

### 6. E2E Tests with Playwright

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Application', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/chat');
  });

  test('should send and receive messages', async ({ page, context }) => {
    // Open second browser context for second user
    const secondUser = await context.newPage();
    
    // Join the same room in both browsers
    await page.click('[data-testid="room-general"]');
    await secondUser.goto('/chat/room/general');
    
    // Send message from first user
    await page.fill('[data-testid="message-input"]', 'Hello from user 1');
    await page.click('[data-testid="send-button"]');
    
    // Verify message appears in both browsers
    await expect(page.locator('text=Hello from user 1')).toBeVisible();
    await expect(secondUser.locator('text=Hello from user 1')).toBeVisible();
    
    // Reply from second user
    await secondUser.fill('[data-testid="message-input"]', 'Hello from user 2');
    await secondUser.click('[data-testid="send-button"]');
    
    // Verify reply appears in both browsers
    await expect(page.locator('text=Hello from user 2')).toBeVisible();
    await expect(secondUser.locator('text=Hello from user 2')).toBeVisible();
  });

  test('should upload and share files', async ({ page }) => {
    await page.click('[data-testid="room-general"]');
    
    // Click attachment button
    await page.click('[data-testid="attachment-button"]');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/test-image.png');
    
    // Verify file appears in message
    await expect(page.locator('[data-testid="file-attachment"]')).toBeVisible();
    
    // Click on file to preview
    await page.click('[data-testid="file-attachment"]');
    
    // Verify preview modal opens
    await expect(page.locator('[data-testid="file-preview-modal"]')).toBeVisible();
  });

  test('should show typing indicators', async ({ page, context }) => {
    const secondUser = await context.newPage();
    
    // Both users join the same room
    await page.click('[data-testid="room-general"]');
    await secondUser.goto('/chat/room/general');
    
    // Start typing in second user's browser
    await secondUser.fill('[data-testid="message-input"]', 'typing...');
    
    // Verify typing indicator appears in first user's browser
    await expect(page.locator('text=typing')).toBeVisible();
    
    // Stop typing
    await secondUser.fill('[data-testid="message-input"]', '');
    
    // Verify typing indicator disappears
    await expect(page.locator('text=typing')).not.toBeVisible();
  });

  test('should handle offline/online status', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);
    
    // Try to send message
    await page.fill('[data-testid="message-input"]', 'Offline message');
    await page.click('[data-testid="send-button"]');
    
    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
    
    // Verify message is sent when back online
    await expect(page.locator('text=Offline message')).toBeVisible();
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
  });
});
```

### 7. Visual Regression Tests

```typescript
// tests/visual/components.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('chat interface should match visual baseline', async ({ page }) => {
    await page.goto('/chat');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="message-list"]');
    
    // Take screenshot
    await expect(page).toHaveScreenshot('chat-interface.png');
  });

  test('message bubbles should render correctly', async ({ page }) => {
    await page.goto('/chat/room/test');
    
    // Wait for messages to load
    await page.waitForSelector('[data-testid="message-bubble"]');
    
    // Take screenshot of message area
    await expect(page.locator('[data-testid="message-list"]')).toHaveScreenshot('message-bubbles.png');
  });

  test('file upload modal should match design', async ({ page }) => {
    await page.goto('/files');
    
    // Open upload modal
    await page.click('[data-testid="upload-button"]');
    await page.waitForSelector('[data-testid="upload-modal"]');
    
    // Take screenshot
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot('upload-modal.png');
  });
});
```

### 8. Performance Tests

```typescript
// tests/performance/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('chat should load within performance budget', async ({ page }) => {
    // Start tracing
    await page.tracing.start({ screenshots: true, snapshots: true });
    
    // Navigate to chat
    await page.goto('/chat');
    
    // Wait for content
    await page.waitForSelector('[data-testid="message-list"]');
    
    // Stop tracing
    await page.tracing.stop({ path: 'trace.zip' });
    
    // Check performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime
      };
    });
    
    // Assert performance budgets
    expect(metrics.loadTime).toBeLessThan(2000); // 2 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(1500); // 1.5 seconds
  });

  test('large message list should perform well', async ({ page }) => {
    // Navigate to room with many messages
    await page.goto('/chat/room/large-room');
    
    // Measure scroll performance
    const startTime = Date.now();
    
    // Scroll to bottom
    await page.evaluate(() => {
      const messageList = document.querySelector('[data-testid="message-list"]');
      messageList?.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(500);
    
    const endTime = Date.now();
    const scrollTime = endTime - startTime;
    
    // Assert scroll performance
    expect(scrollTime).toBeLessThan(1000); // 1 second
  });
});
```

## Testing Strategy

### 1. Unit Tests (70%)

- Component behavior testing
- Store logic validation
- Utility function testing
- Hook testing

### 2. Integration Tests (20%)

- Component interaction testing
- API integration testing
- WebSocket communication testing
- Route navigation testing

### 3. E2E Tests (10%)

- Critical user flows
- Cross-browser compatibility
- Real-time features
- File upload/download

## Test Coverage Goals

- Minimum 80% code coverage
- 100% coverage for critical paths
- Visual regression testing for UI components
- Performance budgets for key metrics

## Continuous Integration

### 1. Test Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:coverage
      
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install
      - run: npm run test:e2e
```

### 2. Quality Gates

- All tests must pass
- Coverage must meet thresholds
- No critical accessibility issues
- Performance budgets met

## Next Steps

- Phase 7: Advanced features implementation
- Monitoring and analytics
- Performance optimization
- Security enhancements
