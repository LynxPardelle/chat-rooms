/**
 * Standardized DTO for WebSocket errors
 */
export interface SocketErrorDto {
  event: string;           // Event type with format "eventNameError"
  error: {
    message: string;       // Human-readable error message
    code: string;          // Error code for programmatic handling
    timestamp: string;     // ISO timestamp when the error occurred
    context?: any;         // Optional additional context about the error
  };
  success: false;          // Always false for error responses
}
