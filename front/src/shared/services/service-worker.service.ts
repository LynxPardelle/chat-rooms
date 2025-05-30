import { Workbox, messageSW } from 'workbox-window';

/**
 * Interface for service worker registration options
 */
export interface ServiceWorkerOptions {
  scope?: string;
  updateInterval?: number; // In milliseconds
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

/**
 * Service for managing service worker registration and updates
 */
export class ServiceWorkerService {
  private static workbox: Workbox | null = null;
  private static updateCheckInterval: any = null;

  /**
   * Register the service worker
   */
  static async register(options: ServiceWorkerOptions = {}): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported in this browser');
      return false;
    }

    try {
      // Create a new Workbox instance
      this.workbox = new Workbox('/service-worker.js', { scope: options.scope });

      // Add event listeners for various lifecycle events
      this.workbox.addEventListener('installed', event => {
        if (event.isUpdate) {
          console.log('Service worker updated');
        } else {
          console.log('Service worker installed for the first time');
        }
      });

      this.workbox.addEventListener('waiting', event => {
        console.log('New service worker waiting to activate');
        if (options.onUpdate && event.sw && event.isUpdate) {
          this.promptUserToRefresh(event.sw, options.onUpdate);
        }
      });

      this.workbox.addEventListener('controlling', () => {
        console.log('Service worker is controlling the page');
        window.location.reload(); // Reload page when new SW takes control
      });

      this.workbox.addEventListener('activated', event => {
        if (event.isUpdate) {
          console.log('Service worker updated and activated');
        } else {
          console.log('Service worker activated for the first time');
          if (options.onSuccess) {
            navigator.serviceWorker.ready.then(options.onSuccess);
          }
        }
      });

      this.workbox.addEventListener('redundant', () => {
        console.log('Service worker became redundant');
      });

      // Register the service worker
      const registration = await this.workbox.register();
      console.log('Service worker registered successfully', registration);

      // Set up periodic update checks if specified
      if (options.updateInterval) {
        this.setupUpdateChecks(options.updateInterval);
      }

      return true;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      if (options.onError) {
        options.onError(error as Error);
      }
      return false;
    }
  }

  /**
   * Set up periodic checks for service worker updates
   */
  private static setupUpdateChecks(intervalMs: number): void {
    // Clear any existing interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    // Set new interval
    this.updateCheckInterval = setInterval(() => {
      console.log('Checking for service worker updates...');
      if (this.workbox) {
        this.workbox.update();
      }
    }, intervalMs);
  }

  /**
   * Prompt user to refresh the page for new service worker
   */  private static async promptUserToRefresh(
    _sw: ServiceWorker,
    callback: (registration: ServiceWorkerRegistration) => void
  ): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      callback(registration);
    }
  }

  /**
   * Update the service worker immediately
   */
  static async update(): Promise<void> {
    if (this.workbox) {
      await this.workbox.update();
    } else {
      console.warn('Workbox instance not available for update');
    }
  }  /**
   * Send a message to the service worker
   */
  static async sendMessage(message: any): Promise<any> {
    if (!this.workbox) {
      console.warn('Workbox instance not available for messaging');
      return null;
    }

    const messageChannel = new MessageChannel();
    
    return new Promise(async (resolve) => {
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      try {
        const sw = await this.workbox!.getSW();
        if (sw) {
          messageSW(sw, message);
        } else {
          console.warn('Active service worker not found');
          resolve(null);
        }
      } catch (error) {
        console.error('Failed to send message to service worker:', error);
        resolve(null);
      }
    });
  }

  /**
   * Unregister all service workers and clean up
   */
  static async unregister(): Promise<boolean> {
    try {
      // Clean up interval
      if (this.updateCheckInterval) {
        clearInterval(this.updateCheckInterval);
        this.updateCheckInterval = null;
      }

      // Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
      }

      this.workbox = null;
      console.log('Service workers unregistered successfully');
      return true;
    } catch (error) {
      console.error('Service worker unregistration failed:', error);
      return false;
    }
  }
}
