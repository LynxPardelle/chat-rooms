/**
 * Core component types for the chat-rooms application
 * These types provide consistent interfaces for component props across the system
 */

export type Size = 'sm' | 'md' | 'lg' | 'xl';
export type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
export type Alignment = 'left' | 'center' | 'right';

/**
 * Common properties shared across interactive components
 */
export interface CommonProps {
  id?: string;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  testId?: string;
}

/**
 * Component state for styling and behavior
 */
export interface ComponentState {
  size?: Size;
  variant?: Variant;
  outline?: boolean;
  rounded?: boolean;
  block?: boolean;
}

/**
 * Icon configuration interface
 */
export interface IconProps {
  name?: string;
  position?: 'left' | 'right';
  size?: Size;
  color?: string;
}

/**
 * Validation state interface
 */
export interface ValidationState {
  valid?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  successMessage?: string;
}

/**
 * Form input base interface
 */
export interface FormInputProps extends CommonProps, ValidationState {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  readonly?: boolean;
  helpText?: string;
  maxLength?: number;
  minLength?: number;
}

/**
 * Table column configuration
 */
export interface TableColumn<T = Record<string, any>> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: Alignment;
  formatter?: (value: any, row: T) => string;
  headerClass?: string;
  cellClass?: string;
}

/**
 * Toast notification interface
 */
export interface ToastOptions {
  id?: string;
  title?: string;
  message: string;
  variant?: Variant;
  timeout?: number;
  closable?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  icon?: string;
}

/**
 * Modal dialog configuration
 */
export interface ModalOptions {
  id?: string;
  title?: string;
  size?: Size;
  closable?: boolean;
  hideFooter?: boolean;
  fullscreen?: boolean;
  persistent?: boolean; // Prevents closing when clicking outside
  contentClass?: string;
}

/**
 * Theme configuration interface
 */
export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  errorColor: string;
  warningColor: string;
  successColor: string;
  infoColor: string;
  borderRadius: string;
  fontFamily: string;
  boxShadow: string;
  spacing: Record<string, string>;
}
