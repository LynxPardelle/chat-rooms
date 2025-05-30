# Step 8.2: Testing Integral del Frontend

## Objetivos

- Implementar suite completa de testing para React frontend
- Configurar testing de componentes con React Testing Library
- Desarrollar tests de integración y E2E con Playwright
- Establecer visual regression testing y accessibility testing

## Estrategia de Testing Frontend

### 1. Test Setup y Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test')
    }
  }
});

// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { server } from './mocks/server';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN
}));

// Start MSW server
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock zustand stores
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false
  }))
}));
```

### 2. Test Utilities y Helpers

```typescript
// src/test/utils/test-utils.tsx
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  queryClient?: QueryClient;
  user?: User | null;
}

export function createWrapper({
  initialRoute = '/',
  queryClient,
  user = null
}: Omit<CustomRenderOptions, 'children'> = {}) {
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider initialUser={user}>
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
}

export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { initialRoute, queryClient, user, ...renderOptions } = options;

  return render(ui, {
    wrapper: createWrapper({ initialRoute, queryClient, user }),
    ...renderOptions
  });
}

// Mock data factories
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  profile: {
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: 'https://example.com/avatar.jpg'
  },
  settings: {
    theme: 'light',
    notifications: true,
    language: 'en'
  }
} as User;

export const mockThread = {
  id: '1',
  title: 'Test Thread',
  description: 'Test thread description',
  type: 'public',
  participantCount: 2,
  lastActivity: new Date().toISOString(),
  createdBy: mockUser.id
} as Thread;

export const mockMessage = {
  id: '1',
  content: 'Test message content',
  senderId: mockUser.id,
  sender: mockUser,
  threadId: mockThread.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  type: 'text',
  status: 'sent'
} as Message;

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
```

### 3. Component Unit Tests

```typescript
// src/components/ui/Button/Button.test.tsx
import { render, screen, fireEvent } from '@test/utils/test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled button</Button>);
    const button = screen.getByText('Disabled button');
    
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows loading state', () => {
    render(<Button loading>Loading button</Button>);
    
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-secondary');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-danger');
  });

  it('supports different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-lg');
  });
});

// src/components/chat/MessageList/MessageList.test.tsx
import { render, screen, waitFor } from '@test/utils/test-utils';
import { MessageList } from './MessageList';
import { mockMessage, mockUser } from '@test/utils/test-utils';

const mockMessages: Message[] = [
  { ...mockMessage, id: '1', content: 'First message' },
  { ...mockMessage, id: '2', content: 'Second message' },
  { ...mockMessage, id: '3', content: 'Third message' }
];

describe('MessageList', () => {
  it('renders messages correctly', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        currentUser={mockUser}
        onLoadMore={() => {}} 
      />
    );

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    render(
      <MessageList 
        messages={[]} 
        currentUser={mockUser}
        loading={true}
        onLoadMore={() => {}} 
      />
    );

    expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(
      <MessageList 
        messages={[]} 
        currentUser={mockUser}
        onLoadMore={() => {}} 
      />
    );

    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('handles scroll to load more messages', async () => {
    const onLoadMore = vi.fn();
    
    render(
      <MessageList 
        messages={mockMessages} 
        currentUser={mockUser}
        hasMore={true}
        onLoadMore={onLoadMore} 
      />
    );

    const messageList = screen.getByTestId('message-list');
    
    // Simulate scroll to top
    fireEvent.scroll(messageList, { target: { scrollTop: 0 } });
    
    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalled();
    });
  });

  it('handles message reactions', async () => {
    const onReact = vi.fn();
    
    render(
      <MessageList 
        messages={mockMessages} 
        currentUser={mockUser}
        onReact={onReact}
        onLoadMore={() => {}} 
      />
    );

    // Click on first message to show reactions
    const firstMessage = screen.getByTestId('message-1');
    fireEvent.mouseEnter(firstMessage);

    await waitFor(() => {
      expect(screen.getByTestId('reaction-button-👍')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reaction-button-👍'));
    
    expect(onReact).toHaveBeenCalledWith('1', '👍');
  });

  it('handles message editing', async () => {
    const onEdit = vi.fn();
    const messagesWithUserMessage = [
      { ...mockMessage, id: '1', senderId: mockUser.id, content: 'My message' }
    ];
    
    render(
      <MessageList 
        messages={messagesWithUserMessage} 
        currentUser={mockUser}
        onEdit={onEdit}
        onLoadMore={() => {}} 
      />
    );

    // Right click on user's message to show context menu
    const message = screen.getByTestId('message-1');
    fireEvent.contextMenu(message);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));
    
    expect(onEdit).toHaveBeenCalledWith('1');
  });
});

// src/components/chat/MessageInput/MessageInput.test.tsx
import { render, screen, fireEvent, waitFor } from '@test/utils/test-utils';
import { MessageInput } from './MessageInput';

describe('MessageInput', () => {
  it('allows typing messages', () => {
    render(<MessageInput onSend={() => {}} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello world' } });
    
    expect(input).toHaveValue('Hello world');
  });

  it('sends message on Enter key', async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello world' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({
        content: 'Hello world',
        attachments: [],
        mentions: []
      });
    });
    
    expect(input).toHaveValue('');
  });

  it('does not send empty messages', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(onSend).not.toHaveBeenCalled();
  });

  it('sends message with Shift+Enter for new line', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Line 1' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('Line 1\n');
  });

  it('handles file attachments', async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Message with file' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({
        content: 'Message with file',
        attachments: [expect.objectContaining({ name: 'test.txt' })],
        mentions: []
      });
    });
  });

  it('shows typing indicator', async () => {
    const onTyping = vi.fn();
    render(<MessageInput onSend={() => {}} onTyping={onTyping} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'H' } });
    
    expect(onTyping).toHaveBeenCalledWith(true);
    
    // Stop typing after 1 second
    await waitFor(() => {
      expect(onTyping).toHaveBeenCalledWith(false);
    }, { timeout: 1500 });
  });

  it('handles mentions autocomplete', async () => {
    const users = [
      { id: '1', username: 'john', displayName: 'John Doe' },
      { id: '2', username: 'jane', displayName: 'Jane Smith' }
    ];
    
    render(<MessageInput onSend={() => {}} users={users} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello @j' } });
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('John Doe'));
    
    expect(input).toHaveValue('Hello @john ');
  });
});
```

### 4. Integration Tests

```typescript
// src/test/integration/ChatFlow.test.tsx
import { render, screen, fireEvent, waitFor } from '@test/utils/test-utils';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { mockUser, mockThread, mockMessage } from '@test/utils/test-utils';
import { server } from '@test/mocks/server';
import { rest } from 'msw';

describe('Chat Flow Integration', () => {
  beforeEach(() => {
    // Setup MSW handlers for chat endpoints
    server.use(
      rest.get('/api/threads/:threadId/messages', (req, res, ctx) => {
        return res(ctx.json({
          data: [mockMessage],
          pagination: { hasMore: false, total: 1 }
        }));
      }),
      rest.post('/api/threads/:threadId/messages', (req, res, ctx) => {
        return res(ctx.json({
          ...mockMessage,
          id: Date.now().toString(),
          content: req.body.content,
          createdAt: new Date().toISOString()
        }));
      }),
      rest.get('/api/threads/:threadId', (req, res, ctx) => {
        return res(ctx.json(mockThread));
      })
    );
  });

  it('loads and displays chat thread', async () => {
    render(
      <ChatContainer threadId={mockThread.id} />,
      { user: mockUser }
    );

    await waitFor(() => {
      expect(screen.getByText(mockThread.title)).toBeInTheDocument();
      expect(screen.getByText(mockMessage.content)).toBeInTheDocument();
    });
  });

  it('sends new message and updates UI', async () => {
    render(
      <ChatContainer threadId={mockThread.id} />,
      { user: mockUser }
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type a message...');
    const newMessageContent = 'This is a new test message';

    fireEvent.change(input, { target: { value: newMessageContent } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(newMessageContent)).toBeInTheDocument();
    });

    expect(input).toHaveValue('');
  });

  it('handles real-time message updates', async () => {
    const { container } = render(
      <ChatContainer threadId={mockThread.id} />,
      { user: mockUser }
    );

    await waitFor(() => {
      expect(screen.getByText(mockMessage.content)).toBeInTheDocument();
    });

    // Simulate receiving a real-time message
    const newMessage = {
      ...mockMessage,
      id: 'realtime-1',
      content: 'Real-time message',
      senderId: 'other-user'
    };

    // Trigger WebSocket event
    const websocketEvent = new CustomEvent('websocket-message', {
      detail: { type: 'message', data: newMessage }
    });
    container.dispatchEvent(websocketEvent);

    await waitFor(() => {
      expect(screen.getByText('Real-time message')).toBeInTheDocument();
    });
  });

  it('handles typing indicators', async () => {
    render(
      <ChatContainer threadId={mockThread.id} />,
      { user: mockUser }
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Typing...' } });

    // Simulate receiving typing indicator from another user
    const typingEvent = new CustomEvent('websocket-message', {
      detail: {
        type: 'typing',
        data: { userId: 'other-user', username: 'Other User', isTyping: true }
      }
    });
    
    const { container } = render(<div />);
    container.dispatchEvent(typingEvent);

    await waitFor(() => {
      expect(screen.getByText('Other User is typing...')).toBeInTheDocument();
    });
  });

  it('handles message reactions', async () => {
    server.use(
      rest.post('/api/messages/:messageId/reactions', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      })
    );

    render(
      <ChatContainer threadId={mockThread.id} />,
      { user: mockUser }
    );

    await waitFor(() => {
      expect(screen.getByText(mockMessage.content)).toBeInTheDocument();
    });

    // Hover over message to show reaction buttons
    const message = screen.getByTestId(`message-${mockMessage.id}`);
    fireEvent.mouseEnter(message);

    await waitFor(() => {
      expect(screen.getByTestId('reaction-button-👍')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reaction-button-👍'));

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Reaction count
    });
  });
});

// src/test/integration/AuthFlow.test.tsx
import { render, screen, fireEvent, waitFor } from '@test/utils/test-utils';
import { App } from '@/App';
import { server } from '@test/mocks/server';
import { rest } from 'msw';

describe('Authentication Flow', () => {
  beforeEach(() => {
    server.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        const { email, password } = req.body;
        if (email === 'test@example.com' && password === 'password') {
          return res(ctx.json({
            token: 'jwt-token',
            user: mockUser
          }));
        }
        return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }));
      }),
      rest.post('/api/auth/logout', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      }),
      rest.get('/api/auth/me', (req, res, ctx) => {
        const authHeader = req.headers.get('authorization');
        if (authHeader === 'Bearer jwt-token') {
          return res(ctx.json(mockUser));
        }
        return res(ctx.status(401));
      })
    );
  });

  it('shows login form when not authenticated', () => {
    render(<App />);
    
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('logs in user with valid credentials', async () => {
    render(<App />);
    
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' }
    });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument();
    });
  });

  it('shows error for invalid credentials', async () => {
    render(<App />);
    
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' }
    });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('logs out user', async () => {
    render(<App />, { user: mockUser });

    // User should be logged in
    expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument();

    // Click logout
    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });
  });

  it('redirects to login when token expires', async () => {
    server.use(
      rest.get('/api/auth/me', (req, res, ctx) => {
        return res(ctx.status(401));
      })
    );

    render(<App />, { user: mockUser });

    // Trigger a request that would validate the token
    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });
  });
});
```

### 5. E2E Tests con Playwright

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Application E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('/');
  });

  test('user can send and receive messages', async ({ page, context }) => {
    // Open second browser context for second user
    const secondPage = await context.newPage();
    await secondPage.goto('/login');
    await secondPage.fill('[data-testid="email-input"]', 'user2@example.com');
    await secondPage.fill('[data-testid="password-input"]', 'password');
    await secondPage.click('[data-testid="login-button"]');

    // Both users join the same thread
    const threadId = 'test-thread-1';
    await page.goto(`/chat/${threadId}`);
    await secondPage.goto(`/chat/${threadId}`);

    // First user sends a message
    await page.fill('[data-testid="message-input"]', 'Hello from user 1!');
    await page.press('[data-testid="message-input"]', 'Enter');

    // Verify message appears in both browsers
    await expect(page.locator('text=Hello from user 1!')).toBeVisible();
    await expect(secondPage.locator('text=Hello from user 1!')).toBeVisible();

    // Second user responds
    await secondPage.fill('[data-testid="message-input"]', 'Hello back from user 2!');
    await secondPage.press('[data-testid="message-input"]', 'Enter');

    // Verify response appears in both browsers
    await expect(page.locator('text=Hello back from user 2!')).toBeVisible();
    await expect(secondPage.locator('text=Hello back from user 2!')).toBeVisible();
  });

  test('user can upload and share files', async ({ page }) => {
    await page.goto('/chat/test-thread-1');

    // Upload a file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content')
    });

    // Verify file appears in message input
    await expect(page.locator('text=test.txt')).toBeVisible();

    // Add message and send
    await page.fill('[data-testid="message-input"]', 'Here is a test file');
    await page.press('[data-testid="message-input"]', 'Enter');

    // Verify file message appears
    await expect(page.locator('text=Here is a test file')).toBeVisible();
    await expect(page.locator('[data-testid="file-attachment"]')).toBeVisible();
  });

  test('user can react to messages', async ({ page }) => {
    await page.goto('/chat/test-thread-1');

    // Send a message first
    await page.fill('[data-testid="message-input"]', 'React to this message!');
    await page.press('[data-testid="message-input"]', 'Enter');

    // Hover over the message to show reaction buttons
    const message = page.locator('[data-testid*="message-"]').last();
    await message.hover();

    // Click on thumbs up reaction
    await page.click('[data-testid="reaction-button-👍"]');

    // Verify reaction appears
    await expect(page.locator('[data-testid="reaction-👍"]')).toBeVisible();
    await expect(page.locator('text=1')).toBeVisible(); // Reaction count
  });

  test('typing indicators work correctly', async ({ page, context }) => {
    const secondPage = await context.newPage();
    await secondPage.goto('/login');
    await secondPage.fill('[data-testid="email-input"]', 'user2@example.com');
    await secondPage.fill('[data-testid="password-input"]', 'password');
    await secondPage.click('[data-testid="login-button"]');

    // Both users join the same thread
    await page.goto('/chat/test-thread-1');
    await secondPage.goto('/chat/test-thread-1');

    // First user starts typing
    await page.fill('[data-testid="message-input"]', 'I am typing...');

    // Second user should see typing indicator
    await expect(secondPage.locator('text=is typing...')).toBeVisible();

    // First user stops typing (clears input)
    await page.fill('[data-testid="message-input"]', '');

    // Typing indicator should disappear
    await expect(secondPage.locator('text=is typing...')).not.toBeVisible();
  });

  test('user can search messages', async ({ page }) => {
    await page.goto('/chat/test-thread-1');

    // Send some test messages
    const messages = [
      'This is the first test message',
      'Here is another message about cats',
      'Final message for testing search'
    ];

    for (const message of messages) {
      await page.fill('[data-testid="message-input"]', message);
      await page.press('[data-testid="message-input"]', 'Enter');
      await page.waitForTimeout(100); // Small delay between messages
    }

    // Open search
    await page.click('[data-testid="search-button"]');
    
    // Search for "test"
    await page.fill('[data-testid="search-input"]', 'test');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Should find 2 messages with "test"
    await expect(page.locator('[data-testid="search-result"]')).toHaveCount(2);
    await expect(page.locator('text=first test message')).toBeVisible();
    await expect(page.locator('text=testing search')).toBeVisible();
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');

    // Check initial theme (light)
    await expect(page.locator('html')).not.toHaveClass('dark');

    // Toggle to dark mode
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).toHaveClass('dark');

    // Toggle back to light mode
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).not.toHaveClass('dark');
  });
});

// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('home page is accessible', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('chat page is accessible', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');

    await page.goto('/chat/test-thread-1');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/login');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();

    // Submit form with Enter
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/');
  });
});
```

### 6. Visual Regression Tests

```typescript
// tests/visual/components.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('button components look correct', async ({ page }) => {
    await page.goto('/storybook/buttons');
    
    // Test different button variants
    await expect(page.locator('[data-testid="button-primary"]')).toHaveScreenshot('button-primary.png');
    await expect(page.locator('[data-testid="button-secondary"]')).toHaveScreenshot('button-secondary.png');
    await expect(page.locator('[data-testid="button-danger"]')).toHaveScreenshot('button-danger.png');
  });

  test('message list looks correct', async ({ page }) => {
    await page.goto('/storybook/message-list');
    
    // Screenshot message list with various message types
    await expect(page.locator('[data-testid="message-list"]')).toHaveScreenshot('message-list.png');
  });

  test('chat interface looks correct in different themes', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');

    await page.goto('/chat/test-thread-1');

    // Light theme
    await expect(page).toHaveScreenshot('chat-light-theme.png');

    // Switch to dark theme
    await page.click('[data-testid="theme-toggle"]');
    await expect(page).toHaveScreenshot('chat-dark-theme.png');
  });

  test('responsive design looks correct', async ({ page }) => {
    await page.goto('/');

    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page).toHaveScreenshot('desktop-view.png');

    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot('tablet-view.png');

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('mobile-view.png');
  });
});
```

### 7. Performance Tests

```typescript
// tests/performance/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('page load performance', async ({ page }) => {
    // Start performance monitoring
    const perfMark = 'navigation-start';
    await page.addInitScript(() => {
      performance.mark('navigation-start');
    });

    await page.goto('/');

    // Measure time to interactive
    const timeToInteractive = await page.evaluate(() => {
      performance.mark('navigation-end');
      const measure = performance.measure('navigation', 'navigation-start', 'navigation-end');
      return measure.duration;
    });

    expect(timeToInteractive).toBeLessThan(3000); // Less than 3 seconds
  });

  test('message rendering performance', async ({ page }) => {
    // Login and navigate to chat
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');

    await page.goto('/chat/test-thread-1');

    // Measure time to render 100 messages
    const renderTime = await page.evaluate(async () => {
      const start = performance.now();
      
      // Simulate loading 100 messages
      const messageList = document.querySelector('[data-testid="message-list"]');
      for (let i = 0; i < 100; i++) {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `Message ${i}`;
        messageDiv.className = 'message';
        messageList?.appendChild(messageDiv);
      }
      
      // Wait for next frame
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      return performance.now() - start;
    });

    expect(renderTime).toBeLessThan(1000); // Less than 1 second
  });

  test('bundle size is reasonable', async ({ page }) => {
    await page.goto('/');

    // Get all loaded resources
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(resource => ({
        name: resource.name,
        size: resource.transferSize,
        type: resource.initiatorType
      }));
    });

    // Check JavaScript bundle size
    const jsResources = resources.filter(r => r.name.includes('.js'));
    const totalJsSize = jsResources.reduce((sum, resource) => sum + resource.size, 0);
    
    expect(totalJsSize).toBeLessThan(500 * 1024); // Less than 500KB

    // Check CSS bundle size
    const cssResources = resources.filter(r => r.name.includes('.css'));
    const totalCssSize = cssResources.reduce((sum, resource) => sum + resource.size, 0);
    
    expect(totalCssSize).toBeLessThan(100 * 1024); // Less than 100KB
  });
});
```

## Tareas de Implementación

### Fase 1: Test Infrastructure (Días 1-2)

- [ ] Configurar Vitest y React Testing Library
- [ ] Crear utilities y helpers de testing
- [ ] Configurar MSW para API mocking
- [ ] Setup de Playwright para E2E tests

### Fase 2: Component Unit Tests (Días 3-5)

- [ ] Tests para componentes UI básicos
- [ ] Tests para componentes de chat
- [ ] Tests para formularios y validaciones
- [ ] Tests para hooks y utilities

### Fase 3: Integration Tests (Días 6-7)

- [ ] Tests de flujos de autenticación
- [ ] Tests de chat flow completo
- [ ] Tests de WebSocket integration
- [ ] Tests de routing y navigation

### Fase 4: E2E Tests (Días 8-9)

- [ ] Tests de user journeys completos
- [ ] Tests de real-time functionality
- [ ] Tests de accessibility
- [ ] Tests cross-browser

### Fase 5: Performance & Visual Tests (Días 10-12)

- [ ] Visual regression tests
- [ ] Performance benchmarking
- [ ] Bundle size monitoring
- [ ] Responsive design tests

## Métricas de Calidad

### Code Coverage

- **Line Coverage**: Mínimo 85%
- **Branch Coverage**: Mínimo 80%
- **Function Coverage**: Mínimo 90%
- **Component Coverage**: 100% de componentes críticos

### Performance Metrics

- **Page Load**: < 3 segundos
- **Time to Interactive**: < 2 segundos
- **Bundle Size**: < 500KB JS, < 100KB CSS
- **Memory Usage**: < 50MB baseline

### Test Quality

- **Test Reliability**: < 1% flaky tests
- **Test Speed**: < 30 segundos suite completa
- **E2E Coverage**: 100% user journeys críticos
- **Accessibility**: 0 violations en páginas principales

Este conjunto completo de tests asegurará la calidad, performance y accesibilidad del frontend React.
