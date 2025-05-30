/**
 * Web Worker for message search and filtering operations
 * Offloads CPU-intensive tasks from the main thread to maintain UI responsiveness
 */

// Define message types for type safety
interface MessageData {
  type: string;
  payload: any;
}

interface SearchParams {
  messages: any[];
  query: string;
  options?: {
    caseSensitive?: boolean;
    exactMatch?: boolean;
    searchFields?: string[];
    maxResults?: number;
  };
}

interface FilterParams {
  messages: any[];
  filters: {
    field: string;
    value: any;
    operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'startsWith' | 'endsWith';
  }[];
}

self.addEventListener('message', (event: MessageEvent<MessageData>) => {
  const { type, payload } = event.data;

  try {
    let result;

    switch (type) {
      case 'search':
        result = searchMessages(payload);
        break;
      case 'filter':
        result = filterMessages(payload);
        break;
      case 'sort':
        result = sortMessages(payload);
        break;
      case 'processAttachments':
        result = processAttachments(payload);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    // Send result back to main thread
    self.postMessage({
      type: `${type}Result`,
      payload: result,
      error: null,
      requestId: payload.requestId
    });  } catch (error) {
    // Send error back to main thread
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in worker';
    self.postMessage({
      type: 'error',
      payload: null,
      error: errorMessage,
      requestId: payload?.requestId
    });
  }
});

/**
 * Search messages for text matches
 */
function searchMessages(params: SearchParams): any[] {
  const { messages, query, options = {} } = params;
  
  if (!query || !query.trim() || !messages?.length) {
    return [];
  }

  const {
    caseSensitive = false,
    exactMatch = false,
    searchFields = ['content', 'username'],
    maxResults = 100
  } = options;

  // Create search comparator
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  
  // Search function
  const matchesSearch = (message: any): boolean => {
    for (const field of searchFields) {
      if (!message[field]) continue;
      
      const fieldValue = caseSensitive ? message[field] : message[field].toLowerCase();
      
      if (exactMatch) {
        if (fieldValue === searchQuery) return true;
      } else {
        if (fieldValue.includes(searchQuery)) return true;
      }
    }
    
    return false;
  };

  // Perform search
  return messages
    .filter(matchesSearch)
    .slice(0, maxResults);
}

/**
 * Filter messages based on criteria
 */
function filterMessages(params: FilterParams): any[] {
  const { messages, filters } = params;
  
  if (!filters?.length || !messages?.length) {
    return messages;
  }

  return messages.filter(message => {
    return filters.every(filter => {
      const { field, value, operator = 'eq' } = filter;
      const fieldValue = message[field];

      switch (operator) {
        case 'eq':
          return fieldValue === value;
        case 'neq':
          return fieldValue !== value;
        case 'gt':
          return fieldValue > value;
        case 'gte':
          return fieldValue >= value;
        case 'lt':
          return fieldValue < value;
        case 'lte':
          return fieldValue <= value;
        case 'includes':
          return Array.isArray(fieldValue) && fieldValue.includes(value);
        case 'startsWith':
          return typeof fieldValue === 'string' && fieldValue.startsWith(value);
        case 'endsWith':
          return typeof fieldValue === 'string' && fieldValue.endsWith(value);
        default:
          return false;
      }
    });
  });
}

/**
 * Sort messages based on criteria
 */
function sortMessages(params: { messages: any[], sortBy: string, direction: 'asc' | 'desc' }): any[] {
  const { messages, sortBy, direction = 'asc' } = params;
  
  if (!sortBy || !messages?.length) {
    return messages;
  }
  
  const directionMultiplier = direction === 'asc' ? 1 : -1;
  
  return [...messages].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    
    // Handle dates
    if (aValue instanceof Date && bValue instanceof Date) {
      return (aValue.getTime() - bValue.getTime()) * directionMultiplier;
    }
    
    // Handle strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * directionMultiplier;
    }
    
    // Handle numbers and others
    if (aValue < bValue) return -1 * directionMultiplier;
    if (aValue > bValue) return 1 * directionMultiplier;
    return 0;
  });
}

/**
 * Process attachments (e.g., count by type, analyze sizes)
 */
function processAttachments(params: { messages: any[] }): any {
  const { messages } = params;
  
  if (!messages?.length) {
    return { totalAttachments: 0 };
  }
  
  const result = {
    totalAttachments: 0,
    byType: {} as Record<string, number>,
    totalSize: 0,
    largestAttachment: { size: 0, messageId: null, filename: null }
  };
  
  messages.forEach(message => {
    const attachments = message.attachments || [];
    
    result.totalAttachments += attachments.length;
      attachments.forEach((attachment: any) => {
      // Count by type
      const type = attachment.mimeType || 'unknown';
      result.byType[type] = (result.byType[type] || 0) + 1;
      
      // Track sizes
      const size = attachment.size || 0;
      result.totalSize += size;
      
      // Track largest
      if (size > result.largestAttachment.size) {
        result.largestAttachment = {
          size,
          messageId: message.id,
          filename: attachment.filename
        };
      }
    });
  });
  
  return result;
}
