import { appConfig } from '../config/app.config';
import type { StorageItem } from '../types/api.types';

/**
 * Enterprise-grade storage service with encryption and automatic cleanup
 */
export class StorageService {
  private static instance: StorageService;
  private readonly maxSize: number;
  private readonly enableEncryption: boolean;
  private readonly encryptionKey: string;

  private constructor() {
    this.maxSize = appConfig.security.maxStorageSize * 1024 * 1024; // Convert MB to bytes
    this.enableEncryption = appConfig.security.enableEncryption;
    this.encryptionKey = appConfig.security.encryptionKey;
    
    // Initialize cleanup on startup
    this.performCleanup();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Store data with optional encryption and expiry
   */
  public setItem<T>(
    key: string, 
    value: T, 
    options?: {
      encrypt?: boolean;
      expiryMinutes?: number;
      persistent?: boolean;
    }
  ): boolean {
    try {
      const storage = options?.persistent ? localStorage : sessionStorage;
      const encrypt = options?.encrypt ?? false;
      const expiry = options?.expiryMinutes 
        ? Date.now() + (options.expiryMinutes * 60 * 1000)
        : undefined;      const item: StorageItem<T | string> = {
        value: encrypt && this.enableEncryption ? this.encrypt(JSON.stringify(value)) : value,
        expiry,
        encrypted: encrypt && this.enableEncryption
      };

      const serialized = JSON.stringify(item);
      
      // Check storage size limit
      if (this.getCurrentStorageSize(storage) + serialized.length > this.maxSize) {
        console.warn('Storage size limit exceeded, performing cleanup');
        this.performCleanup();
        
        // Check again after cleanup
        if (this.getCurrentStorageSize(storage) + serialized.length > this.maxSize) {
          console.error('Cannot store item: storage size limit exceeded');
          return false;
        }
      }

      storage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Error storing item:', error);
      return false;
    }
  }

  /**
   * Retrieve data with automatic decryption and expiry check
   */
  public getItem<T>(key: string, persistent: boolean = false): T | null {
    try {
      const storage = persistent ? localStorage : sessionStorage;
      const serialized = storage.getItem(key);
      
      if (!serialized) {
        return null;
      }

      const item: StorageItem<T> = JSON.parse(serialized);
      
      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        this.removeItem(key, persistent);
        return null;
      }

      // Decrypt if necessary
      if (item.encrypted && this.enableEncryption) {
        try {
          const decrypted = this.decrypt(item.value as string);
          return JSON.parse(decrypted);
        } catch (error) {
          console.error('Error decrypting item:', error);
          this.removeItem(key, persistent);
          return null;
        }
      }

      return item.value;
    } catch (error) {
      console.error('Error retrieving item:', error);
      return null;
    }
  }

  /**
   * Remove specific item from storage
   */
  public removeItem(key: string, persistent: boolean = false): void {
    try {
      const storage = persistent ? localStorage : sessionStorage;
      storage.removeItem(key);
    } catch (error) {
      console.error('Error removing item:', error);
    }
  }

  /**
   * Clear all storage data
   */
  public clear(persistent: boolean = false): void {
    try {
      const storage = persistent ? localStorage : sessionStorage;
      storage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Get current storage usage in bytes
   */
  public getStorageSize(persistent: boolean = false): number {
    const storage = persistent ? localStorage : sessionStorage;
    return this.getCurrentStorageSize(storage);
  }

  /**
   * Check if storage is available
   */
  public isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform automatic cleanup of expired items
   */
  public performCleanup(): void {
    try {
      [localStorage, sessionStorage].forEach(storage => {
        const toRemove: string[] = [];
        
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key) continue;
          
          try {
            const item: StorageItem = JSON.parse(storage.getItem(key) || '{}');
            if (item.expiry && Date.now() > item.expiry) {
              toRemove.push(key);
            }
          } catch {
            // Remove corrupted items
            toRemove.push(key);
          }
        }
        
        toRemove.forEach(key => storage.removeItem(key));
      });
    } catch (error) {
      console.error('Error during storage cleanup:', error);
    }
  }

  /**
   * Simple encryption (for development - use proper encryption in production)
   */
  private encrypt(data: string): string {
    if (!this.enableEncryption) return data;
    
    // Simple XOR encryption (replace with proper encryption in production)
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
      );
    }
    return btoa(result);
  }

  /**
   * Simple decryption (for development - use proper decryption in production)
   */
  private decrypt(data: string): string {
    if (!this.enableEncryption) return data;
    
    try {
      const decoded = atob(data);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(
          decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
        );
      }
      return result;
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Calculate current storage size
   */
  private getCurrentStorageSize(storage: Storage): number {
    let size = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const value = storage.getItem(key);
        if (value) {
          size += key.length + value.length;
        }
      }
    }
    return size;
  }

  /**
   * Store data with encryption (convenience method)
   */
  public setSecure<T>(key: string, value: T, expiryMinutes?: number): boolean {
    return this.setItem(key, value, {
      encrypt: true,
      expiryMinutes,
      persistent: true
    });
  }

  /**
   * Retrieve encrypted data (convenience method)
   */
  public getSecure<T>(key: string): T | null {
    return this.getItem<T>(key, true);
  }

  /**
   * Remove encrypted data (convenience method)
   */
  public removeSecure(key: string): void {
    this.removeItem(key, true);
  }

  /**
   * Clear all data
   */
  public clearAll(): void {
    this.clear(false); // Session storage
    this.clear(true);  // Local storage
  }
}

// Create singleton instance
export const storageService = StorageService.getInstance();
export default storageService;
