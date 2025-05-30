# Step 6.2: Chat Module Implementation

## Overview

Implement the core chat module with message display, real-time messaging, room management, and interactive chat features.

## Implementation Details

### 1. Chat Container Component

```typescript
// src/components/chat/ChatContainer.tsx
interface ChatContainerProps {
  roomId: string;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ roomId }) => {
  const { user } = useAuth();
  const { 
    currentRoom, 
    messages, 
    loadingMessages, 
    loadMessages, 
    sendMessage 
  } = useChatStore();
  const { socket } = useWebSocket();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (roomId) {
      loadMessages(roomId);
    }
  }, [roomId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit('join-room', roomId);

    const handleNewMessage = (message: Message) => {
      // Add message to store via WebSocket
    };

    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      // Handle typing indicators
    };

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleTyping);
      socket.emit('leave-room', roomId);
    };
  }, [socket, roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      await sendMessage(roomId, newMessage);
      setNewMessage('');
      setIsTyping(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTyping = useCallback(
    debounce(() => {
      if (socket && roomId) {
        socket.emit('typing', { roomId, isTyping: false });
      }
      setIsTyping(false);
    }, 1000),
    [socket, roomId]
  );

  const onMessageChange = (value: string) => {
    setNewMessage(value);
    if (!isTyping && value.trim()) {
      setIsTyping(true);
      if (socket && roomId) {
        socket.emit('typing', { roomId, isTyping: true });
      }
    }
    handleTyping();
  };

  if (loadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader room={currentRoom} />
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages[roomId] || []} 
          currentUserId={user?.id}
        />
        <div ref={messagesEndRef} />
      </div>
      <TypingIndicator roomId={roomId} />
      <MessageInput
        value={newMessage}
        onChange={onMessageChange}
        onSend={handleSendMessage}
        disabled={!currentRoom}
      />
    </div>
  );
};
```

### 2. Message List Component

```typescript
// src/components/chat/MessageList.tsx
interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  currentUserId 
}) => {
  const virtualizerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => virtualizerRef.current,
    estimateSize: () => 80,
    overscan: 5
  });

  useEffect(() => {
    const element = virtualizerRef.current;
    if (!element) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    virtualizerRef.current?.scrollTo({
      top: virtualizerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  };

  const groupedMessages = useMemo(() => {
    return messages.reduce((groups: MessageGroup[], message, index) => {
      const prevMessage = messages[index - 1];
      const shouldGroup = prevMessage && 
        prevMessage.senderId === message.senderId &&
        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000;

      if (shouldGroup) {
        groups[groups.length - 1].messages.push(message);
      } else {
        groups.push({
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar,
          messages: [message],
          timestamp: message.createdAt
        });
      }

      return groups;
    }, []);
  }, [messages]);

  return (
    <div className="relative h-full">
      <div
        ref={virtualizerRef}
        className="h-full overflow-auto p-4 space-y-4"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const group = groupedMessages[virtualItem.index];
            return (
              <div
                key={virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                <MessageGroup
                  group={group}
                  isOwnMessage={group.senderId === currentUserId}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showScrollButton && (
        <Button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          size="sm"
        >
          <ChevronDownIcon className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};
```

### 3. Message Components

```typescript
// src/components/chat/MessageGroup.tsx
interface MessageGroupProps {
  group: MessageGroup;
  isOwnMessage: boolean;
}

export const MessageGroup: React.FC<MessageGroupProps> = ({ 
  group, 
  isOwnMessage 
}) => {
  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isOwnMessage && (
        <Avatar
          src={group.senderAvatar}
          alt={group.senderName}
          size="md"
          className="mr-3 flex-shrink-0"
        />
      )}
      <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'mr-3' : ''}`}>
        {!isOwnMessage && (
          <div className="text-sm text-gray-600 mb-1 px-3">
            {group.senderName}
          </div>
        )}
        <div className="space-y-1">
          {group.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={isOwnMessage}
              showTimestamp={message === group.messages[group.messages.length - 1]}
            />
          ))}
        </div>
      </div>
      {isOwnMessage && (
        <Avatar
          src={group.senderAvatar}
          alt={group.senderName}
          size="md"
          className="ml-3 flex-shrink-0"
        />
      )}
    </div>
  );
};

// src/components/chat/MessageBubble.tsx
interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showTimestamp: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isOwnMessage, 
  showTimestamp 
}) => {
  const [showActions, setShowActions] = useState(false);

  const handleReaction = (emoji: string) => {
    // Handle message reaction
  };

  const handleReply = () => {
    // Handle message reply
  };

  const handleEdit = () => {
    // Handle message edit
  };

  const handleDelete = () => {
    // Handle message delete
  };

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`
          px-4 py-2 rounded-2xl max-w-full break-words
          ${isOwnMessage 
            ? 'bg-primary-600 text-white rounded-br-md' 
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }
        `}
      >
        {message.replyTo && (
          <MessageReply 
            replyTo={message.replyTo} 
            isOwnMessage={isOwnMessage} 
          />
        )}
        
        <MessageContent content={message.content} />
        
        {message.attachments && message.attachments.length > 0 && (
          <MessageAttachments attachments={message.attachments} />
        )}
        
        {message.reactions && message.reactions.length > 0 && (
          <MessageReactions 
            reactions={message.reactions}
            onReaction={handleReaction}
          />
        )}
        
        {showTimestamp && (
          <div className={`
            text-xs mt-1 opacity-70
            ${isOwnMessage ? 'text-white' : 'text-gray-500'}
          `}>
            {formatTime(message.createdAt)}
            {message.edited && (
              <span className="ml-1">(edited)</span>
            )}
          </div>
        )}
      </div>

      {showActions && (
        <MessageActions
          message={message}
          isOwnMessage={isOwnMessage}
          onReaction={handleReaction}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};
```

### 4. Message Input Component

```typescript
// src/components/chat/MessageInput.tsx
interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type a message..."
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onChange(value + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleFileUpload = (type: 'image' | 'file') => {
    const input = fileInputRef.current;
    if (input) {
      input.accept = type === 'image' ? 'image/*' : '*/*';
      input.click();
    }
    setShowAttachmentMenu(false);
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex items-end space-x-2">
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            disabled={disabled}
          >
            <PaperClipIcon className="w-5 h-5" />
          </Button>
          
          {showAttachmentMenu && (
            <div className="absolute bottom-12 left-0 bg-white border rounded-lg shadow-lg p-2 min-w-[150px]">
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center"
                onClick={() => handleFileUpload('image')}
              >
                <PhotoIcon className="w-4 h-4 mr-2" />
                Image
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center"
                onClick={() => handleFileUpload('file')}
              >
                <DocumentIcon className="w-4 h-4 mr-2" />
                File
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={disabled}
          >
            <FaceSmileIcon className="w-5 h-5" />
          </Button>
          
          {showEmojiPicker && (
            <div className="absolute bottom-12 right-0">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </div>
          )}
        </div>

        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size="sm"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          // Handle file upload
        }}
      />
    </div>
  );
};
```

### 5. Chat Sidebar Component

```typescript
// src/components/chat/ChatSidebar.tsx
interface ChatSidebarProps {
  collapsed: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ collapsed }) => {
  const { rooms, loadRooms } = useChatStore();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'rooms' | 'direct'>('rooms');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  if (collapsed) {
    return (
      <div className="w-16 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-4">
        <Button variant="ghost" size="sm" className="mb-4">
          <ChatBubbleLeftIcon className="w-6 h-6" />
        </Button>
        <div className="space-y-2">
          {rooms.slice(0, 4).map((room) => (
            <Avatar
              key={room.id}
              src={room.avatar}
              alt={room.name}
              size="sm"
              className="cursor-pointer"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chats</h2>
          <Button variant="ghost" size="sm">
            <PlusIcon className="w-5 h-5" />
          </Button>
        </div>
        
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
        />
      </div>

      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'rooms'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('rooms')}
        >
          Rooms
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'direct'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('direct')}
        >
          Direct
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'rooms' ? (
          <RoomList rooms={filteredRooms} />
        ) : (
          <DirectMessageList />
        )}
      </div>
    </div>
  );
};
```

### 6. Real-time Features

```typescript
// src/components/chat/TypingIndicator.tsx
interface TypingIndicatorProps {
  roomId: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ roomId }) => {
  const { typingUsers } = useAppStore();
  const { user } = useAuth();

  const currentTypingUsers = useMemo(() => {
    const users = typingUsers[roomId] || [];
    return users.filter(userId => userId !== user?.id);
  }, [typingUsers, roomId, user?.id]);

  if (currentTypingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (currentTypingUsers.length === 1) {
      return `${currentTypingUsers[0]} is typing...`;
    } else if (currentTypingUsers.length === 2) {
      return `${currentTypingUsers[0]} and ${currentTypingUsers[1]} are typing...`;
    } else {
      return `${currentTypingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 border-t">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
        </div>
        <span>{getTypingText()}</span>
      </div>
    </div>
  );
};

// src/components/chat/OnlineIndicator.tsx
export const OnlineIndicator: React.FC = () => {
  const { onlineUsers } = useAppStore();
  const { socket } = useWebSocket();

  return (
    <div className="px-4 py-2 bg-green-50 border-b border-green-200">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="text-sm text-green-700">
          {onlineUsers.length} online
        </span>
      </div>
    </div>
  );
};
```

## Chat Features

### 1. Real-time Messaging

- WebSocket integration
- Message delivery status
- Typing indicators
- Online presence

### 2. Message Types

- Text messages with formatting
- File attachments
- Image previews
- Reply threading

### 3. Interactive Elements

- Message reactions
- Quick replies
- Message search
- Mention support

### 4. Performance Features

- Virtual scrolling for large conversations
- Message pagination
- Optimistic updates
- Efficient re-rendering

## Integration Points

- WebSocket service for real-time updates
- File upload service for attachments
- Storage service for message caching
- Notification service for alerts

## Next Steps

- Step 6.3: File management frontend
- Step 6.4: Frontend testing
- Advanced chat features
- Mobile optimizations
