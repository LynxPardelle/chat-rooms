/**
 * @fileoverview Advanced Forms Type Definitions
 * @description Enterprise-grade form types with validation, auto-save, undo/redo,
 * dynamic fields, and advanced form management capabilities
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

// =============================================================================
// FORM VALIDATION TYPES
// =============================================================================

/**
 * Validation Rule Type
 */
export type ValidationRuleType = 
  | 'required' 
  | 'email' 
  | 'url' 
  | 'min' 
  | 'max' 
  | 'minLength' 
  | 'maxLength' 
  | 'pattern' 
  | 'custom' 
  | 'async'
  | 'conditional'
  | 'cross-field';

/**
 * Validation Severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation Rule
 */
export interface ValidationRule {
  /** Rule type */
  type: ValidationRuleType;
  /** Rule message */
  message: string;
  /** Rule severity */
  severity: ValidationSeverity;
  /** Rule parameters */
  params?: {
    min?: number;
    max?: number;
    pattern?: RegExp | string;
    length?: number;
    validator?: (value: any, formData?: any) => boolean | Promise<boolean>;
    condition?: (formData: any) => boolean;
    dependsOn?: string[];
  };
  /** Rule enabled condition */
  when?: (formData: any) => boolean;
  /** Rule priority */
  priority?: number;
  /** Async validation debounce */
  debounce?: number;
  /** Show validation on */
  trigger?: 'change' | 'blur' | 'submit' | 'manual';
}

/**
 * Validation Result
 */
export interface ValidationResult {
  /** Validation passed */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    field: string;
    rule: string;
    message: string;
    severity: ValidationSeverity;
    value: any;
  }>;
  /** Validation warnings */
  warnings: Array<{
    field: string;
    rule: string;
    message: string;
    value: any;
  }>;
  /** Cross-field validation errors */
  crossFieldErrors: Array<{
    fields: string[];
    rule: string;
    message: string;
    severity: ValidationSeverity;
  }>;
  /** Validation timestamp */
  timestamp: Date;
  /** Validation duration */
  duration: number;
}

/**
 * Field Validation State
 */
export interface FieldValidationState {
  /** Field is valid */
  valid: boolean;
  /** Field has been validated */
  validated: boolean;
  /** Field is currently validating */
  validating: boolean;
  /** Field errors */
  errors: string[];
  /** Field warnings */
  warnings: string[];
  /** Last validation timestamp */
  lastValidation?: Date;
  /** Validation rules applied */
  appliedRules: string[];
}

// =============================================================================
// FORM FIELD TYPES
// =============================================================================

/**
 * Field Data Type
 */
export type FieldDataType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'time' 
  | 'email' 
  | 'url' 
  | 'tel' 
  | 'password'
  | 'array' 
  | 'object' 
  | 'file' 
  | 'json'
  | 'uuid'
  | 'enum';

/**
 * Field Input Type
 */
export type FieldInputType = 
  | 'text' 
  | 'textarea' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'switch' 
  | 'slider' 
  | 'range'
  | 'number' 
  | 'email' 
  | 'password' 
  | 'date' 
  | 'datetime' 
  | 'time' 
  | 'color'
  | 'file' 
  | 'image' 
  | 'rich-text' 
  | 'code' 
  | 'json' 
  | 'tags' 
  | 'autocomplete'
  | 'combobox' 
  | 'multi-select' 
  | 'tree-select' 
  | 'cascader' 
  | 'rating' 
  | 'signature';

/**
 * Field Configuration
 */
export interface FieldConfig {
  /** Field name */
  name: string;
  /** Field label */
  label: string;
  /** Field description */
  description?: string;
  /** Field data type */
  dataType: FieldDataType;
  /** Field input type */
  inputType: FieldInputType;
  /** Default value */
  defaultValue?: any;
  /** Field is required */
  required?: boolean;
  /** Field is readonly */
  readonly?: boolean;
  /** Field is disabled */
  disabled?: boolean;
  /** Field is hidden */
  hidden?: boolean;
  /** Field placeholder */
  placeholder?: string;
  /** Field help text */
  helpText?: string;
  /** Field validation rules */
  validation?: ValidationRule[];
  /** Field options for select/radio */
  options?: Array<{
    value: any;
    label: string;
    disabled?: boolean;
    group?: string;
    icon?: string;
    description?: string;
  }>;
  /** Field dependencies */
  dependencies?: string[];
  /** Conditional display */
  condition?: (formData: any) => boolean;
  /** Field formatting */
  format?: {
    input?: (value: any) => string;
    output?: (value: string) => any;
    display?: (value: any) => string;
    mask?: string;
  };
  /** Field constraints */
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp | string;
    accept?: string; // for file inputs
    multiple?: boolean;
  };
  /** Field UI configuration */
  ui?: {
    size?: 'sm' | 'md' | 'lg';
    variant?: string;
    color?: string;
    icon?: string;
    prefix?: string;
    suffix?: string;
    width?: string | number;
    grid?: {
      column?: number;
      row?: number;
      span?: number;
    };
  };
  /** Custom field renderer */
  renderer?: (field: FieldConfig, value: any, onChange: (value: any) => void) => any;
}

/**
 * Field State
 */
export interface FieldState {
  /** Field value */
  value: any;
  /** Field initial value */
  initialValue: any;
  /** Field touched state */
  touched: boolean;
  /** Field dirty state (value changed) */
  dirty: boolean;
  /** Field focused state */
  focused: boolean;
  /** Field disabled state */
  disabled: boolean;
  /** Field readonly state */
  readonly: boolean;
  /** Field hidden state */
  hidden: boolean;
  /** Field validation state */
  validation: FieldValidationState;
  /** Field error display */
  showErrors: boolean;
  /** Field metadata */
  metadata?: Record<string, any>;
}

// =============================================================================
// FORM MANAGEMENT
// =============================================================================

/**
 * Form State
 */
export interface FormState {
  /** Form values */
  values: Record<string, any>;
  /** Form initial values */
  initialValues: Record<string, any>;
  /** Form field states */
  fields: Map<string, FieldState>;
  /** Form validation state */
  validation: ValidationResult;
  /** Form is submitting */
  submitting: boolean;
  /** Form is submitted */
  submitted: boolean;
  /** Form is valid */
  valid: boolean;
  /** Form is dirty (has changes) */
  dirty: boolean;
  /** Form is pristine (no changes) */
  pristine: boolean;
  /** Form errors */
  errors: Record<string, string[]>;
  /** Form warnings */
  warnings: Record<string, string[]>;
  /** Form metadata */
  metadata: {
    created: Date;
    modified: Date;
    version: number;
    submitCount: number;
    validationCount: number;
  };
}

/**
 * Form Configuration
 */
export interface FormConfig {
  /** Form name */
  name: string;
  /** Form title */
  title?: string;
  /** Form description */
  description?: string;
  /** Form fields */
  fields: FieldConfig[];
  /** Form validation mode */
  validationMode: 'onChange' | 'onBlur' | 'onSubmit' | 'manual';
  /** Form submit behavior */
  submitBehavior: 'default' | 'preventDefault' | 'async';
  /** Form reset on submit */
  resetOnSubmit?: boolean;
  /** Form auto-save */
  autoSave?: {
    enabled: boolean;
    interval: number; // milliseconds
    storage: 'localStorage' | 'sessionStorage' | 'custom';
    key?: string;
    encrypt?: boolean;
  };
  /** Form undo/redo */
  undoRedo?: {
    enabled: boolean;
    maxHistory: number;
    debounce: number;
    excludeFields?: string[];
  };
  /** Form layout */
  layout?: {
    type: 'grid' | 'flex' | 'stack' | 'custom';
    columns?: number;
    gap?: string;
    responsive?: boolean;
  };
  /** Form theming */
  theme?: {
    variant?: string;
    size?: 'sm' | 'md' | 'lg';
    colorScheme?: string;
  };
}

/**
 * Form Event
 */
export interface FormEvent {
  /** Event type */
  type: 'field_change' | 'field_focus' | 'field_blur' | 'validation' | 'submit' | 'reset' | 'auto_save' | 'undo' | 'redo';
  /** Event timestamp */
  timestamp: Date;
  /** Field involved (if applicable) */
  field?: string;
  /** Event payload */
  payload: any;
  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Form History Entry
 */
export interface FormHistoryEntry {
  /** History entry ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Form values snapshot */
  values: Record<string, any>;
  /** Action description */
  action: string;
  /** Fields changed */
  changedFields: string[];
  /** User who made the change */
  user?: string;
}

// =============================================================================
// DYNAMIC FORMS
// =============================================================================

/**
 * Dynamic Field Action
 */
export type DynamicFieldAction = 'add' | 'remove' | 'move' | 'duplicate' | 'toggle' | 'transform';

/**
 * Dynamic Field Rule
 */
export interface DynamicFieldRule {
  /** Rule name */
  name: string;
  /** Rule condition */
  condition: (formData: any, fieldName: string) => boolean;
  /** Rule action */
  action: DynamicFieldAction;
  /** Action parameters */
  params?: {
    targetField?: string;
    newField?: FieldConfig;
    position?: number;
    template?: string;
    transformation?: (field: FieldConfig) => FieldConfig;
  };
  /** Rule priority */
  priority?: number;
}

/**
 * Form Section
 */
export interface FormSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Section fields */
  fields: string[];
  /** Section is collapsible */
  collapsible?: boolean;
  /** Section is collapsed */
  collapsed?: boolean;
  /** Section condition */
  condition?: (formData: any) => boolean;
  /** Section validation */
  validation?: ValidationRule[];
  /** Section layout */
  layout?: FormConfig['layout'];
}

/**
 * Form Wizard Step
 */
export interface FormWizardStep {
  /** Step ID */
  id: string;
  /** Step title */
  title: string;
  /** Step description */
  description?: string;
  /** Step fields */
  fields: string[];
  /** Step is optional */
  optional?: boolean;
  /** Step condition */
  condition?: (formData: any) => boolean;
  /** Step validation */
  validation?: ValidationRule[];
  /** Navigation rules */
  navigation?: {
    canGoNext?: (formData: any) => boolean;
    canGoPrevious?: (formData: any) => boolean;
    nextStep?: string | ((formData: any) => string);
    previousStep?: string | ((formData: any) => string);
  };
}

// =============================================================================
// FORM SUBMISSION AND DATA HANDLING
// =============================================================================

/**
 * Form Submission Result
 */
export interface FormSubmissionResult {
  /** Submission success */
  success: boolean;
  /** Submission data */
  data?: any;
  /** Submission errors */
  errors?: Record<string, string[]>;
  /** Server response */
  response?: any;
  /** Submission metadata */
  metadata?: {
    submissionId: string;
    timestamp: Date;
    duration: number;
    retryCount: number;
  };
}

/**
 * Form Data Transformer
 */
export interface FormDataTransformer {
  /** Transform form data before submission */
  beforeSubmit?: (data: any) => any | Promise<any>;
  /** Transform response data after submission */
  afterSubmit?: (response: any) => any | Promise<any>;
  /** Transform data for display */
  forDisplay?: (data: any) => any;
  /** Transform data for storage */
  forStorage?: (data: any) => any;
  /** Transform data for validation */
  forValidation?: (data: any) => any;
}

/**
 * Form API Integration
 */
export interface FormApiIntegration {
  /** Submit endpoint */
  submitUrl?: string;
  /** Validation endpoint */
  validationUrl?: string;
  /** Auto-save endpoint */
  autoSaveUrl?: string;
  /** Data fetch endpoint */
  fetchUrl?: string;
  /** HTTP method for submission */
  method?: 'POST' | 'PUT' | 'PATCH';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request timeout */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoff: 'linear' | 'exponential';
    delay: number;
  };
  /** Response validation */
  responseValidation?: (response: any) => boolean;
}

// =============================================================================
// FORM HOOKS AND LIFECYCLE
// =============================================================================

/**
 * Form Lifecycle Hooks
 */
export interface FormLifecycleHooks {
  /** Before form initialization */
  beforeInit?: (config: FormConfig) => void | Promise<void>;
  /** After form initialization */
  afterInit?: (form: FormState) => void | Promise<void>;
  /** Before field value change */
  beforeChange?: (field: string, value: any, oldValue: any) => boolean | Promise<boolean>;
  /** After field value change */
  afterChange?: (field: string, value: any, oldValue: any) => void | Promise<void>;
  /** Before form validation */
  beforeValidation?: (data: any) => void | Promise<void>;
  /** After form validation */
  afterValidation?: (result: ValidationResult) => void | Promise<void>;
  /** Before form submission */
  beforeSubmit?: (data: any) => boolean | Promise<boolean>;
  /** After form submission */
  afterSubmit?: (result: FormSubmissionResult) => void | Promise<void>;
  /** Before form reset */
  beforeReset?: () => boolean | Promise<boolean>;
  /** After form reset */
  afterReset?: () => void | Promise<void>;
  /** On form destroy */
  onDestroy?: () => void | Promise<void>;
}

/**
 * Form Context
 */
export interface FormContext {
  /** Form configuration */
  config: FormConfig;
  /** Form state */
  state: FormState;
  /** Form actions */
  actions: {
    setValue: (field: string, value: any) => void;
    setValues: (values: Record<string, any>) => void;
    setFieldState: (field: string, state: Partial<FieldState>) => void;
    validateField: (field: string) => Promise<FieldValidationState>;
    validateForm: () => Promise<ValidationResult>;
    submit: () => Promise<FormSubmissionResult>;
    reset: () => void;
    undo: () => void;
    redo: () => void;
    autoSave: () => Promise<void>;
    addField: (field: FieldConfig, position?: number) => void;
    removeField: (field: string) => void;
    moveField: (field: string, position: number) => void;
  };
  /** Form utilities */
  utils: {
    getFieldValue: (field: string) => any;
    getFieldState: (field: string) => FieldState;
    isFieldValid: (field: string) => boolean;
    isFieldDirty: (field: string) => boolean;
    isFieldTouched: (field: string) => boolean;
    getChangedFields: () => string[];
    getDirtyFields: () => string[];
    getTouchedFields: () => string[];
    getErrorFields: () => string[];
  };
}

// =============================================================================
// ADVANCED FORM FEATURES
// =============================================================================

/**
 * Form Template
 */
export interface FormTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Template category */
  category: string;
  /** Template tags */
  tags: string[];
  /** Template configuration */
  config: FormConfig;
  /** Template variables */
  variables?: Record<string, any>;
  /** Template metadata */
  metadata: {
    version: string;
    author: string;
    created: Date;
    updated: Date;
    usage: number;
  };
}

/**
 * Form Builder Configuration
 */
export interface FormBuilderConfig {
  /** Available field types */
  fieldTypes: FieldInputType[];
  /** Available validation rules */
  validationRules: ValidationRuleType[];
  /** Drag and drop */
  dragAndDrop: boolean;
  /** Live preview */
  livePreview: boolean;
  /** Code generation */
  codeGeneration: {
    enabled: boolean;
    formats: ('json' | 'yaml' | 'typescript' | 'javascript')[];
  };
  /** Template system */
  templates: {
    enabled: boolean;
    builtin: FormTemplate[];
    custom: FormTemplate[];
  };
}

/**
 * Form Analytics
 */
export interface FormAnalytics {
  /** Form completion rate */
  completionRate: number;
  /** Field interaction data */
  fieldInteractions: Record<string, {
    views: number;
    interactions: number;
    errors: number;
    timeSpent: number;
    abandonmentRate: number;
  }>;
  /** Common errors */
  commonErrors: Array<{
    field: string;
    error: string;
    count: number;
    percentage: number;
  }>;
  /** Performance metrics */
  performance: {
    loadTime: number;
    renderTime: number;
    validationTime: number;
    submissionTime: number;
  };
  /** User behavior */
  userBehavior: {
    averageTimeToComplete: number;
    mostAbandonedField: string;
    mostProblematicField: string;
    conversionFunnel: Array<{
      step: string;
      users: number;
      dropoffRate: number;
    }>;
  };
}

/**
 * Form Export Configuration
 */
export interface FormExportConfig {
  /** Export format */
  format: 'json' | 'csv' | 'excel' | 'pdf' | 'xml';
  /** Include metadata */
  includeMetadata: boolean;
  /** Include validation */
  includeValidation: boolean;
  /** Include empty fields */
  includeEmptyFields: boolean;
  /** Field mapping */
  fieldMapping?: Record<string, string>;
  /** Custom transformers */
  transformers?: Record<string, (value: any) => any>;
}
