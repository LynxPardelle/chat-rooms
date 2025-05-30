/**
 * @fileoverview Enterprise UI Type Definitions
 * @description Comprehensive type definitions for UI components with accessibility,
 * internationalization, theming, and advanced interaction patterns
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

import type { EnhancedUser, EnhancedMessage, EnhancedRoom } from './enhanced-entities.types';

// =============================================================================
// BASE COMPONENT TYPES
// =============================================================================

/**
 * Component Size Variants
 */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Component Color Variants
 */
export type ComponentColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Component State
 */
export type ComponentState = 'idle' | 'loading' | 'success' | 'error' | 'disabled';

/**
 * Base Component Props
 */
export interface BaseComponentProps {
  /** Component identifier */
  id?: string;
  /** CSS classes */
  class?: string | string[] | Record<string, boolean>;
  /** Inline styles */
  style?: Record<string, string | number>;
  /** Data attributes */
  data?: Record<string, string>;
  /** Accessibility properties */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  /** Tab index for keyboard navigation */
  tabindex?: number;
  /** Component role */
  role?: string;
}

/**
 * Interactive Component Props
 */
export interface InteractiveComponentProps extends BaseComponentProps {
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Event handlers */
  onClick?: (event: MouseEvent) => void;
  onKeydown?: (event: KeyboardEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  /** Keyboard shortcuts */
  shortcuts?: Array<{
    key: string;
    modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
    handler: () => void;
    description?: string;
  }>;
}

// =============================================================================
// THEMING SYSTEM
// =============================================================================

/**
 * Theme Mode
 */
export type ThemeMode = 'light' | 'dark' | 'auto' | 'high-contrast';

/**
 * Color Palette
 */
export interface ColorPalette {
  /** Primary colors */
  primary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  /** Secondary colors */
  secondary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  /** Semantic colors */
  success: string;
  warning: string;
  error: string;
  info: string;
  /** Neutral colors */
  neutral: {
    0: string; // white
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    1000: string; // black
  };
}

/**
 * Typography System
 */
export interface TypographySystem {
  /** Font families */
  fontFamily: {
    sans: string[];
    serif: string[];
    mono: string[];
  };
  /** Font sizes */
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
  };
  /** Font weights */
  fontWeight: {
    thin: number;
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    extrabold: number;
    black: number;
  };
  /** Line heights */
  lineHeight: {
    none: number;
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  /** Letter spacing */
  letterSpacing: {
    tighter: string;
    tight: string;
    normal: string;
    wide: string;
    wider: string;
    widest: string;
  };
}

/**
 * Spacing System
 */
export interface SpacingSystem {
  0: string;
  px: string;
  0.5: string;
  1: string;
  1.5: string;
  2: string;
  2.5: string;
  3: string;
  3.5: string;
  4: string;
  5: string;
  6: string;
  7: string;
  8: string;
  9: string;
  10: string;
  11: string;
  12: string;
  14: string;
  16: string;
  20: string;
  24: string;
  28: string;
  32: string;
  36: string;
  40: string;
  44: string;
  48: string;
  52: string;
  56: string;
  60: string;
  64: string;
  72: string;
  80: string;
  96: string;
}

/**
 * Theme Configuration
 */
export interface ThemeConfig {
  /** Theme mode */
  mode: ThemeMode;
  /** Color palette */
  colors: ColorPalette;
  /** Typography system */
  typography: TypographySystem;
  /** Spacing system */
  spacing: SpacingSystem;
  /** Border radius */
  borderRadius: {
    none: string;
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    full: string;
  };
  /** Shadows */
  boxShadow: {
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
    none: string;
  };
  /** Transitions */
  transitions: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };
    easing: {
      linear: string;
      ease: string;
      'ease-in': string;
      'ease-out': string;
      'ease-in-out': string;
    };
  };
  /** Breakpoints */
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  /** Z-index layers */
  zIndex: {
    auto: string;
    base: number;
    dropdown: number;
    modal: number;
    popover: number;
    tooltip: number;
    overlay: number;
    max: number;
  };
}

// =============================================================================
// INTERNATIONALIZATION
// =============================================================================

/**
 * Supported Locales
 */
export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko';

/**
 * Text Direction
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Date Format Style
 */
export type DateFormatStyle = 'short' | 'medium' | 'long' | 'full';

/**
 * Number Format Options
 */
export interface NumberFormatOptions {
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  useGrouping?: boolean;
}

/**
 * Internationalization Configuration
 */
export interface I18nConfig {
  /** Current locale */
  locale: SupportedLocale;
  /** Fallback locale */
  fallbackLocale: SupportedLocale;
  /** Available locales */
  availableLocales: SupportedLocale[];
  /** Text direction */
  direction: TextDirection;
  /** Date formatting */
  dateFormat: {
    date: DateFormatStyle;
    time: DateFormatStyle;
    datetime: DateFormatStyle;
  };
  /** Number formatting */
  numberFormat: NumberFormatOptions;
  /** Currency */
  currency: string;
  /** Timezone */
  timezone: string;
  /** Pluralization rules */
  pluralizationRules?: Record<string, (count: number) => string>;
}

/**
 * Translation Function Type
 */
export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>,
  count?: number
) => string;

// =============================================================================
// ACCESSIBILITY
// =============================================================================

/**
 * Accessibility Level
 */
export type AccessibilityLevel = 'A' | 'AA' | 'AAA';

/**
 * Screen Reader Announcement
 */
export interface ScreenReaderAnnouncement {
  /** Announcement message */
  message: string;
  /** Announcement priority */
  priority: 'polite' | 'assertive';
  /** Announcement type */
  type: 'status' | 'alert' | 'log';
  /** Clear previous announcements */
  clear?: boolean;
}

/**
 * Keyboard Navigation Configuration
 */
export interface KeyboardNavigationConfig {
  /** Enable keyboard navigation */
  enabled: boolean;
  /** Tab order management */
  tabOrder: 'auto' | 'manual';
  /** Focus trap for modals */
  focusTrap: boolean;
  /** Focus visible indicator */
  focusVisible: boolean;
  /** Skip links */
  skipLinks: Array<{
    target: string;
    label: string;
  }>;
}

/**
 * Accessibility Configuration
 */
export interface AccessibilityConfig {
  /** Target WCAG level */
  level: AccessibilityLevel;
  /** High contrast mode */
  highContrast: boolean;
  /** Reduced motion */
  reducedMotion: boolean;
  /** Screen reader support */
  screenReader: boolean;
  /** Keyboard navigation */
  keyboardNavigation: KeyboardNavigationConfig;
  /** Focus management */
  focusManagement: {
    returnFocus: boolean;
    trapFocus: boolean;
    skipToContent: boolean;
  };
  /** Color contrast ratios */
  colorContrast: {
    normal: number; // 4.5:1 for AA
    large: number; // 3:1 for AA
    enhanced: number; // 7:1 for AAA
  };
}

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

/**
 * Layout Container Props
 */
export interface LayoutContainerProps extends BaseComponentProps {
  /** Container max width */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'none';
  /** Padding */
  padding?: ComponentSize;
  /** Center content */
  centered?: boolean;
  /** Responsive breakpoints */
  responsive?: boolean;
}

/**
 * Grid System Props
 */
export interface GridProps extends BaseComponentProps {
  /** Number of columns */
  columns?: number | Record<string, number>;
  /** Gap between items */
  gap?: ComponentSize;
  /** Alignment */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Justify content */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Auto-fit columns */
  autoFit?: boolean;
  /** Minimum column width */
  minColumnWidth?: string;
}

/**
 * Flex Props
 */
export interface FlexProps extends BaseComponentProps {
  /** Flex direction */
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  /** Flex wrap */
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** Align items */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Justify content */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Gap between items */
  gap?: ComponentSize;
  /** Flex grow */
  grow?: boolean | number;
  /** Flex shrink */
  shrink?: boolean | number;
  /** Flex basis */
  basis?: string | number;
}

// =============================================================================
// FORM COMPONENTS
// =============================================================================

/**
 * Form Field State
 */
export interface FormFieldState {
  /** Field value */
  value: any;
  /** Validation errors */
  errors: string[];
  /** Field touched state */
  touched: boolean;
  /** Field dirty state */
  dirty: boolean;
  /** Field valid state */
  valid: boolean;
  /** Field disabled state */
  disabled: boolean;
  /** Field loading state */
  loading: boolean;
}

/**
 * Input Component Props
 */
export interface InputProps extends InteractiveComponentProps {
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Input value */
  value?: string | number;
  /** Placeholder text */
  placeholder?: string;
  /** Size variant */
  size?: ComponentSize;
  /** Color variant */
  color?: ComponentColor;
  /** Field state */
  state?: ComponentState;
  /** Required field */
  required?: boolean;
  /** Readonly field */
  readonly?: boolean;
  /** Auto-complete */
  autocomplete?: string;
  /** Auto-focus */
  autofocus?: boolean;
  /** Maximum length */
  maxlength?: number;
  /** Minimum length */
  minlength?: number;
  /** Pattern validation */
  pattern?: string;
  /** Validation message */
  validationMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Prefix icon or text */
  prefix?: string | { icon: string; text?: string };
  /** Suffix icon or text */
  suffix?: string | { icon: string; text?: string };
  /** Input events */
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  onValidate?: (value: string) => string | null;
}

/**
 * Button Component Props
 */
export interface ButtonProps extends InteractiveComponentProps {
  /** Button variant */
  variant?: 'solid' | 'outline' | 'ghost' | 'link';
  /** Size variant */
  size?: ComponentSize;
  /** Color variant */
  color?: ComponentColor;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Icon */
  icon?: string;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Button content */
  children?: string;
  /** Full width */
  fullWidth?: boolean;
  /** Loading text */
  loadingText?: string;
}

/**
 * Select Component Props
 */
export interface SelectProps extends InteractiveComponentProps {
  /** Select options */
  options: Array<{
    value: string | number;
    label: string;
    disabled?: boolean;
    group?: string;
  }>;
  /** Selected value */
  value?: string | number | (string | number)[];
  /** Multiple selection */
  multiple?: boolean;
  /** Searchable options */
  searchable?: boolean;
  /** Clear button */
  clearable?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Size variant */
  size?: ComponentSize;
  /** Color variant */
  color?: ComponentColor;
  /** Max height for dropdown */
  maxHeight?: string;
  /** Virtual scrolling for large lists */
  virtual?: boolean;
  /** Option renderer */
  optionRenderer?: (option: SelectProps['options'][0]) => string;
  /** Selection events */
  onSelect?: (value: string | number | (string | number)[]) => void;
  onSearch?: (query: string) => void;
}

// =============================================================================
// CHAT-SPECIFIC COMPONENTS
// =============================================================================

/**
 * Message Component Props
 */
export interface MessageComponentProps extends BaseComponentProps {
  /** Message data */
  message: EnhancedMessage;
  /** Current user */
  currentUser?: EnhancedUser;
  /** Show avatar */
  showAvatar?: boolean;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Message grouping */
  grouped?: boolean;
  /** Highlight message */
  highlighted?: boolean;
  /** Message actions */
  actions?: Array<{
    id: string;
    label: string;
    icon?: string;
    onClick: (message: EnhancedMessage) => void;
    visible?: (message: EnhancedMessage, user?: EnhancedUser) => boolean;
  }>;
  /** Event handlers */
  onReply?: (message: EnhancedMessage) => void;
  onEdit?: (message: EnhancedMessage) => void;
  onDelete?: (message: EnhancedMessage) => void;
  onReact?: (message: EnhancedMessage, emoji: string) => void;
  onMention?: (userId: string) => void;
}

/**
 * Chat Input Component Props
 */
export interface ChatInputProps extends BaseComponentProps {
  /** Current room */
  roomId?: string;
  /** Input value */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Auto-focus */
  autofocus?: boolean;
  /** Maximum message length */
  maxLength?: number;
  /** Enable rich text editing */
  richText?: boolean;
  /** Enable file uploads */
  fileUpload?: boolean;
  /** Allowed file types */
  allowedFileTypes?: string[];
  /** Maximum file size */
  maxFileSize?: number;
  /** Emoji picker */
  emojiPicker?: boolean;
  /** Mention suggestions */
  mentionSuggestions?: boolean;
  /** Typing indicator */
  typingIndicator?: boolean;
  /** Message drafts */
  drafts?: boolean;
  /** Event handlers */
  onSend?: (content: string, attachments?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  onDraftSave?: (content: string) => void;
  onMention?: (query: string) => EnhancedUser[];
  onFileSelect?: (files: File[]) => void;
}

/**
 * User List Component Props
 */
export interface UserListProps extends BaseComponentProps {
  /** List of users */
  users: EnhancedUser[];
  /** Current user */
  currentUser?: EnhancedUser;
  /** Show online status */
  showStatus?: boolean;
  /** Show user roles */
  showRoles?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Search functionality */
  searchable?: boolean;
  /** Grouping */
  groupBy?: 'role' | 'status' | 'alphabetical' | 'none';
  /** User actions */
  actions?: Array<{
    id: string;
    label: string;
    icon?: string;
    onClick: (user: EnhancedUser) => void;
    visible?: (user: EnhancedUser, currentUser?: EnhancedUser) => boolean;
  }>;
  /** Event handlers */
  onUserClick?: (user: EnhancedUser) => void;
  onUserContextMenu?: (user: EnhancedUser, event: MouseEvent) => void;
}

/**
 * Room List Component Props
 */
export interface RoomListProps extends BaseComponentProps {
  /** List of rooms */
  rooms: EnhancedRoom[];
  /** Active room */
  activeRoom?: string;
  /** Show unread counts */
  showUnreadCounts?: boolean;
  /** Show room previews */
  showPreviews?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Search functionality */
  searchable?: boolean;
  /** Room grouping */
  groupBy?: 'type' | 'alphabetical' | 'recent' | 'none';
  /** Room actions */
  actions?: Array<{
    id: string;
    label: string;
    icon?: string;
    onClick: (room: EnhancedRoom) => void;
    visible?: (room: EnhancedRoom) => boolean;
  }>;
  /** Event handlers */
  onRoomSelect?: (room: EnhancedRoom) => void;
  onRoomContextMenu?: (room: EnhancedRoom, event: MouseEvent) => void;
}

// =============================================================================
// MODAL AND OVERLAY COMPONENTS
// =============================================================================

/**
 * Modal Component Props
 */
export interface ModalProps extends BaseComponentProps {
  /** Modal visibility */
  visible: boolean;
  /** Modal title */
  title?: string;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Persistent modal */
  persistent?: boolean;
  /** Focus trap */
  focusTrap?: boolean;
  /** Return focus */
  returnFocus?: boolean;
  /** Z-index */
  zIndex?: number;
  /** Transition */
  transition?: string;
  /** Event handlers */
  onClose?: () => void;
  onOpen?: () => void;
  onBackdropClick?: () => void;
  onEscapeKey?: () => void;
}

/**
 * Toast Notification Props
 */
export interface ToastProps extends BaseComponentProps {
  /** Toast type */
  type: 'info' | 'success' | 'warning' | 'error';
  /** Toast title */
  title?: string;
  /** Toast message */
  message: string;
  /** Auto-close duration */
  duration?: number;
  /** Show close button */
  closable?: boolean;
  /** Toast position */
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /** Toast actions */
  actions?: Array<{
    label: string;
    onClick: () => void;
    style?: 'primary' | 'secondary';
  }>;
  /** Event handlers */
  onClose?: () => void;
  onAction?: (actionId: string) => void;
}

// =============================================================================
// RESPONSIVE DESIGN
// =============================================================================

/**
 * Breakpoint Configuration
 */
export interface BreakpointConfig {
  /** Breakpoint name */
  name: string;
  /** Minimum width */
  minWidth: number;
  /** Maximum width */
  maxWidth?: number;
  /** Columns for grid */
  columns?: number;
  /** Container max width */
  containerMaxWidth?: number;
}

/**
 * Responsive Value
 */
export type ResponsiveValue<T> = T | Partial<Record<string, T>>;

/**
 * Media Query Hook Return
 */
export interface MediaQueryResult {
  /** Current breakpoint */
  current: string;
  /** Check if matches breakpoint */
  matches: (breakpoint: string) => boolean;
  /** Check if above breakpoint */
  above: (breakpoint: string) => boolean;
  /** Check if below breakpoint */
  below: (breakpoint: string) => boolean;
  /** Check if between breakpoints */
  between: (min: string, max: string) => boolean;
}

// =============================================================================
// ANIMATION AND TRANSITIONS
// =============================================================================

/**
 * Animation Type
 */
export type AnimationType = 'fade' | 'slide' | 'scale' | 'bounce' | 'rotate' | 'flip' | 'none';

/**
 * Animation Direction
 */
export type AnimationDirection = 'up' | 'down' | 'left' | 'right' | 'in' | 'out';

/**
 * Animation Configuration
 */
export interface AnimationConfig {
  /** Animation type */
  type: AnimationType;
  /** Animation direction */
  direction?: AnimationDirection;
  /** Animation duration */
  duration: number;
  /** Animation delay */
  delay?: number;
  /** Animation easing */
  easing: string;
  /** Animation iteration count */
  iterations?: number | 'infinite';
  /** Fill mode */
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

/**
 * Transition Configuration
 */
export interface TransitionConfig {
  /** Transition property */
  property: string | string[];
  /** Transition duration */
  duration: number;
  /** Transition delay */
  delay?: number;
  /** Transition easing */
  easing: string;
}

// =============================================================================
// COMPONENT COMPOSITION
// =============================================================================

/**
 * Component Variant System
 */
export interface ComponentVariants {
  /** Base styles */
  base: Record<string, any>;
  /** Size variants */
  sizes: Record<ComponentSize, Record<string, any>>;
  /** Color variants */
  colors: Record<ComponentColor, Record<string, any>>;
  /** State variants */
  states: Record<ComponentState, Record<string, any>>;
  /** Custom variants */
  variants?: Record<string, Record<string, any>>;
}

/**
 * Component Theme Integration
 */
export interface ComponentTheme {
  /** Component default props */
  defaultProps?: Record<string, any>;
  /** Component variants */
  variants: ComponentVariants;
  /** Component compound variants */
  compoundVariants?: Array<{
    conditions: Record<string, any>;
    styles: Record<string, any>;
  }>;
}

/**
 * Design System Configuration
 */
export interface DesignSystemConfig {
  /** Theme configuration */
  theme: ThemeConfig;
  /** Internationalization */
  i18n: I18nConfig;
  /** Accessibility */
  accessibility: AccessibilityConfig;
  /** Component themes */
  components: Record<string, ComponentTheme>;
  /** Global styles */
  globalStyles: Record<string, any>;
  /** CSS variables */
  cssVariables: Record<string, string>;
}
