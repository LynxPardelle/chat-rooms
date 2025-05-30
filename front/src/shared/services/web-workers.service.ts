/**
 * Web Workers Service
 * 
 * Provides an interface to communicate with web workers to offload heavy tasks
 * from the main thread, improving UI responsiveness.
 */

interface WorkerRequest {
  requestId: string;
  type: string;
  payload: any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export class WebWorkersService {
  private static workers: Record<string, Worker> = {};
  private static pendingRequests: Record<string, WorkerRequest> = {};
  private static requestIdCounter = 0;

  /**
   * Initialize a worker by type if not already created
   */
  private static initWorker(workerType: string): Worker {
    if (!this.workers[workerType]) {
      let worker: Worker;
      
      switch (workerType) {
        case 'message-search':
          worker = new Worker(new URL('../../workers/message-search.worker.ts', import.meta.url), { type: 'module' });
          break;
        // Add other worker types here
        default:
          throw new Error(`Unknown worker type: ${workerType}`);
      }
      
      // Set up message handler for worker responses
      worker.addEventListener('message', this.handleWorkerMessage.bind(this));
      
      // Store worker instance
      this.workers[workerType] = worker;
    }
    
    return this.workers[workerType];
  }

  /**
   * Handle messages from workers
   */
  private static handleWorkerMessage(event: MessageEvent): void {
    const { payload, error, requestId } = event.data;
    
    // Find the pending request
    const request = this.pendingRequests[requestId];
    if (!request) {
      console.warn('Received response for unknown request:', requestId);
      return;
    }
    
    // Handle response
    if (error) {
      request.reject(new Error(error));
    } else {
      request.resolve(payload);
    }
    
    // Clean up
    delete this.pendingRequests[requestId];
  }

  /**
   * Send a request to a worker and return a promise
   */
  private static sendToWorker<T>(
    workerType: string, 
    requestType: string, 
    payload: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        // Get worker
        const worker = this.initWorker(workerType);
        
        // Create unique request ID
        const requestId = `${Date.now()}-${++this.requestIdCounter}`;
        
        // Store promise callbacks
        this.pendingRequests[requestId] = {
          requestId,
          type: requestType,
          payload,
          resolve,
          reject
        };
        
        // Send message to worker
        worker.postMessage({
          type: requestType,
          payload: { ...payload, requestId }
        });
        
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Search messages using a web worker
   */
  static searchMessages(params: {
    messages: any[];
    query: string;
    options?: {
      caseSensitive?: boolean;
      exactMatch?: boolean;
      searchFields?: string[];
      maxResults?: number;
    };
  }): Promise<any[]> {
    return this.sendToWorker('message-search', 'search', params);
  }

  /**
   * Filter messages using a web worker
   */
  static filterMessages(params: {
    messages: any[];
    filters: Array<{
      field: string;
      value: any;
      operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'startsWith' | 'endsWith';
    }>;
  }): Promise<any[]> {
    return this.sendToWorker('message-search', 'filter', params);
  }

  /**
   * Sort messages using a web worker
   */
  static sortMessages(params: {
    messages: any[];
    sortBy: string;
    direction: 'asc' | 'desc';
  }): Promise<any[]> {
    return this.sendToWorker('message-search', 'sort', params);
  }

  /**
   * Process attachments using a web worker
   */
  static processAttachments(params: {
    messages: any[];
  }): Promise<any> {
    return this.sendToWorker('message-search', 'processAttachments', params);
  }

  /**
   * Terminates all running workers
   */
  static terminateAll(): void {
    Object.values(this.workers).forEach(worker => {
      worker.terminate();
    });
    
    this.workers = {};
    
    // Reject any pending requests
    Object.values(this.pendingRequests).forEach(request => {
      request.reject(new Error('Worker terminated'));
    });
    
    this.pendingRequests = {};
  }
}
