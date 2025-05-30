# Step 5.3: Routing and State Management

## Overview

Implement comprehensive routing system with React Router and global state management with Zustand for the Chat Rooms application.

## Implementation Details

### 1. Router Configuration

```typescript
// src/router/AppRouter.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'auth',
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: <LoginPage />
          },
          {
            path: 'register',
            element: <RegisterPage />
          },
          {
            path: 'forgot-password',
            element: <ForgotPasswordPage />
          },
          {
            path: 'reset-password/:token',
            element: <ResetPasswordPage />
          },
          {
            path: 'verify-email/:token',
            element: <VerifyEmailPage />
          }
        ]
      },
      {
        path: 'chat',
        element: (
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <ChatDashboard />
          },
          {
            path: 'room/:roomId',
            element: <ChatRoom />,
            loader: roomLoader
          },
          {
            path: 'direct/:userId',
            element: <DirectMessage />,
            loader: directMessageLoader
          }
        ]
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="profile" replace />
          },
          {
            path: 'profile',
            element: <ProfileSettings />
          },
          {
            path: 'notifications',
            element: <NotificationSettings />
          },
          {
            path: 'privacy',
            element: <PrivacySettings />
          },
          {
            path: 'security',
            element: <SecuritySettings />
          }
        ]
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requiredRoles={['admin', 'moderator']}>
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <AdminDashboard />
          },
          {
            path: 'users',
            element: <UserManagement />
          },
          {
            path: 'rooms',
            element: <RoomManagement />
          },
          {
            path: 'analytics',
            element: <Analytics />
          }
        ]
      }
    ]
  }
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
```

### 2. Global App Store

```typescript
// src/stores/appStore.ts
interface AppState {
  // UI State
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  activeTab: string;
  notifications: Notification[];
  
  // Chat State
  activeRoom: string | null;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>;
  unreadCounts: Record<string, number>;
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  setActiveRoom: (roomId: string | null) => void;
  setOnlineUsers: (users: string[]) => void;
  setTypingUsers: (roomId: string, users: string[]) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  incrementUnreadCount: (roomId: string) => void;
  clearUnreadCount: (roomId: string) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'system',
        sidebarCollapsed: false,
        activeTab: 'chat',
        notifications: [],
        activeRoom: null,
        onlineUsers: [],
        typingUsers: {},
        unreadCounts: {},

        // UI Actions
        setTheme: (theme) => set({ theme }),
        toggleSidebar: () => set(state => ({ 
          sidebarCollapsed: !state.sidebarCollapsed 
        })),
        setActiveTab: (tab) => set({ activeTab: tab }),

        // Notification Actions
        addNotification: (notification) => set(state => ({
          notifications: [
            ...state.notifications,
            { ...notification, id: crypto.randomUUID() }
          ]
        })),
        removeNotification: (id) => set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        })),
        clearNotifications: () => set({ notifications: [] }),

        // Chat Actions
        setActiveRoom: (roomId) => set({ activeRoom: roomId }),
        setOnlineUsers: (users) => set({ onlineUsers: users }),
        setTypingUsers: (roomId, users) => set(state => ({
          typingUsers: { ...state.typingUsers, [roomId]: users }
        })),
        setUnreadCount: (roomId, count) => set(state => ({
          unreadCounts: { ...state.unreadCounts, [roomId]: count }
        })),
        incrementUnreadCount: (roomId) => set(state => ({
          unreadCounts: {
            ...state.unreadCounts,
            [roomId]: (state.unreadCounts[roomId] || 0) + 1
          }
        })),
        clearUnreadCount: (roomId) => set(state => {
          const newCounts = { ...state.unreadCounts };
          delete newCounts[roomId];
          return { unreadCounts: newCounts };
        })
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          activeTab: state.activeTab
        })
      }
    )
  )
);
```

### 3. Chat Store

```typescript
// src/stores/chatStore.ts
interface ChatState {
  rooms: Room[];
  messages: Record<string, Message[]>;
  currentRoom: Room | null;
  directMessages: Record<string, Message[]>;
  
  // Loading states
  loadingRooms: boolean;
  loadingMessages: Record<string, boolean>;
  
  // Actions
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  
  setCurrentRoom: (room: Room | null) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  addMessage: (roomId: string, message: Message) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (roomId: string, messageId: string) => void;
  
  setDirectMessages: (userId: string, messages: Message[]) => void;
  addDirectMessage: (userId: string, message: Message) => void;
  
  loadRooms: () => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, attachments?: File[]) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  devtools((set, get) => ({
    rooms: [],
    messages: {},
    currentRoom: null,
    directMessages: {},
    loadingRooms: false,
    loadingMessages: {},

    setRooms: (rooms) => set({ rooms }),
    addRoom: (room) => set(state => ({
      rooms: [...state.rooms, room]
    })),
    updateRoom: (roomId, updates) => set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId ? { ...room, ...updates } : room
      )
    })),
    removeRoom: (roomId) => set(state => ({
      rooms: state.rooms.filter(room => room.id !== roomId)
    })),

    setCurrentRoom: (room) => set({ currentRoom: room }),
    setMessages: (roomId, messages) => set(state => ({
      messages: { ...state.messages, [roomId]: messages }
    })),
    addMessage: (roomId, message) => set(state => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), message]
      }
    })),

    loadRooms: async () => {
      set({ loadingRooms: true });
      try {
        const rooms = await apiService.chat.getRooms();
        set({ rooms, loadingRooms: false });
      } catch (error) {
        set({ loadingRooms: false });
        throw error;
      }
    },

    loadMessages: async (roomId) => {
      set(state => ({
        loadingMessages: { ...state.loadingMessages, [roomId]: true }
      }));
      try {
        const messages = await apiService.chat.getMessages(roomId);
        set(state => ({
          messages: { ...state.messages, [roomId]: messages },
          loadingMessages: { ...state.loadingMessages, [roomId]: false }
        }));
      } catch (error) {
        set(state => ({
          loadingMessages: { ...state.loadingMessages, [roomId]: false }
        }));
        throw error;
      }
    },

    sendMessage: async (roomId, content, attachments) => {
      try {
        const message = await apiService.chat.sendMessage(roomId, {
          content,
          attachments
        });
        get().addMessage(roomId, message);
      } catch (error) {
        throw error;
      }
    }
  }))
);
```

### 4. Navigation Hooks

```typescript
// src/hooks/useNavigation.ts
export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const goToChat = useCallback((roomId?: string) => {
    if (roomId) {
      navigate(`/chat/room/${roomId}`);
    } else {
      navigate('/chat');
    }
  }, [navigate]);

  const goToDirectMessage = useCallback((userId: string) => {
    navigate(`/chat/direct/${userId}`);
  }, [navigate]);

  const goToSettings = useCallback((section?: string) => {
    if (section) {
      navigate(`/settings/${section}`);
    } else {
      navigate('/settings');
    }
  }, [navigate]);

  const goToAdmin = useCallback((section?: string) => {
    if (section) {
      navigate(`/admin/${section}`);
    } else {
      navigate('/admin');
    }
  }, [navigate]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const isActive = useCallback((path: string) => {
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  return {
    navigate,
    location,
    goToChat,
    goToDirectMessage,
    goToSettings,
    goToAdmin,
    goBack,
    isActive
  };
};
```

### 5. Route Loaders

```typescript
// src/router/loaders.ts
export const roomLoader = async ({ params }: LoaderFunctionArgs) => {
  const { roomId } = params;
  if (!roomId) throw new Error('Room ID is required');

  try {
    const [room, messages] = await Promise.all([
      apiService.chat.getRoom(roomId),
      apiService.chat.getMessages(roomId)
    ]);
    
    return { room, messages };
  } catch (error) {
    throw new Response('Room not found', { status: 404 });
  }
};

export const directMessageLoader = async ({ params }: LoaderFunctionArgs) => {
  const { userId } = params;
  if (!userId) throw new Error('User ID is required');

  try {
    const [user, messages] = await Promise.all([
      apiService.users.getUser(userId),
      apiService.chat.getDirectMessages(userId)
    ]);
    
    return { user, messages };
  } catch (error) {
    throw new Response('User not found', { status: 404 });
  }
};
```

### 6. Layout Components

```typescript
// src/layouts/RootLayout.tsx
export const RootLayout: React.FC = () => {
  const { theme } = useAppStore();
  
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.classList.toggle('dark', mediaQuery.matches);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <Toaster />
    </div>
  );
};

// src/layouts/ChatLayout.tsx
export const ChatLayout: React.FC = () => {
  const { sidebarCollapsed } = useAppStore();
  
  return (
    <div className="flex h-screen">
      <ChatSidebar collapsed={sidebarCollapsed} />
      <main className="flex-1 flex flex-col">
        <ChatHeader />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
```

### 7. Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
export const ErrorBoundary: React.FC = () => {
  const error = useRouteError() as Error;
  const navigate = useNavigate();

  const isRouteErrorResponse = (error: any): error is Response => {
    return error && typeof error.status === 'number';
  };

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            {error.status} {error.statusText}
          </h1>
          <p className="text-muted-foreground mb-4">
            The page you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
        <p className="text-muted-foreground mb-4">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    </div>
  );
};
```

## State Management Architecture

### 1. Store Separation

- **AuthStore**: User authentication and session management
- **AppStore**: Global UI state and preferences
- **ChatStore**: Chat-specific data and operations
- **NotificationStore**: Real-time notifications

### 2. Persistence Strategy

- Authentication tokens in encrypted storage
- User preferences in localStorage
- Chat data in memory with cache invalidation
- Offline message queue for reliability

### 3. Real-time Updates

- WebSocket integration with stores
- Optimistic updates for better UX
- Conflict resolution for concurrent edits
- Auto-reconnection handling

## Routing Features

### 1. Route Protection

- Authentication-based routing
- Role-based access control
- Automatic redirects
- Loading states

### 2. Dynamic Loading

- Code splitting by route
- Lazy loading of components
- Progressive enhancement
- Error boundaries

### 3. URL State Management

- Deep linking support
- Browser history integration
- Search parameter handling
- Route-based data loading

## Performance Optimizations

### 1. State Management

- Selective subscriptions
- Computed values with selectors
- Batched updates
- Memory leak prevention

### 2. Routing

- Route-based code splitting
- Preloading critical routes
- Parallel data loading
- Cache optimization

## Integration Points

- WebSocket service for real-time updates
- API service for data fetching
- Storage service for persistence
- Notification system for alerts

## Testing Strategy

- Store unit tests with mock data
- Route integration tests
- Navigation flow tests
- State persistence tests

## Next Steps

- Phase 6: Frontend modules development
- Chat component implementation
- Real-time messaging integration
- Advanced UI components
