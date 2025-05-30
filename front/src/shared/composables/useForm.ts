/**
 * Composable for form validation and management
 */
import { reactive, computed } from 'vue';
import { validateRequired, validateMinLength, validateMaxLength, 
         validatePattern, validateEmail, validateUrl } from '../utils/validation';

export interface FormField {
  name: string;
  value: any;
  rules?: Array<(value: any) => boolean | string>;
  valid?: boolean;
  error?: string;
  touched?: boolean;
  dirty?: boolean;
}

export interface FormState {
  fields: Record<string, FormField>;
  valid: boolean;
  touched: boolean;
  dirty: boolean;
  errors: Record<string, string | undefined>;
}

export function useForm(initialValues: Record<string, any> = {}) {
  // Initialize form state
  const formState = reactive<FormState>({
    fields: {},
    valid: true,
    touched: false,
    dirty: false,
    errors: {}
  });
  
  // Add fields
  const addField = (name: string, value: any, rules: Array<(value: any) => boolean | string> = []) => {
    formState.fields[name] = {
      name,
      value,
      rules,
      valid: true,
      error: undefined,
      touched: false,
      dirty: false
    };
    
    return formState.fields[name];
  };
  
  // Initialize fields from initial values
  Object.entries(initialValues).forEach(([name, value]) => {
    addField(name, value);
  });
  
  // Validate a single field
  const validateField = (name: string): boolean => {
    const field = formState.fields[name];
    
    if (!field) return true;
    
    // Reset validation state
    field.valid = true;
    field.error = undefined;
    
    // Skip validation if no rules
    if (!field.rules || field.rules.length === 0) {
      return true;
    }
    
    // Apply each validation rule
    for (const rule of field.rules) {
      const result = rule(field.value);
      
      // If validation fails
      if (result !== true) {
        field.valid = false;
        field.error = typeof result === 'string' ? result : `Invalid value for ${name}`;
        formState.errors[name] = field.error;
        break;
      }
    }
    
    // Clear error if valid
    if (field.valid) {
      formState.errors[name] = undefined;
    }
    
    return field.valid;
  };
  
  // Validate all fields
  const validate = (): boolean => {
    let isValid = true;
    
    Object.keys(formState.fields).forEach(name => {
      const fieldValid = validateField(name);
      if (!fieldValid) {
        isValid = false;
      }
    });
    
    formState.valid = isValid;
    return isValid;
  };
  
  // Get field value
  const getValue = (name: string): any => {
    return formState.fields[name]?.value;
  };
  
  // Set field value
  const setValue = (name: string, value: any): void => {
    if (formState.fields[name]) {
      formState.fields[name].value = value;
      formState.fields[name].dirty = true;
      formState.dirty = true;
      
      // Validate on change
      validateField(name);
    }
  };
  
  // Mark field as touched (user interacted with it)
  const touchField = (name: string): void => {
    if (formState.fields[name]) {
      formState.fields[name].touched = true;
      formState.touched = true;
      
      // Validate on blur
      validateField(name);
    }
  };
  
  // Reset form to initial values
  const resetForm = (): void => {
    Object.keys(formState.fields).forEach(name => {
      const field = formState.fields[name];
      field.value = initialValues[name] || '';
      field.touched = false;
      field.dirty = false;
      field.valid = true;
      field.error = undefined;
    });
    
    formState.valid = true;
    formState.touched = false;
    formState.dirty = false;
    formState.errors = {};
  };
  
  // Get all form values
  const values = computed(() => {
    const result: Record<string, any> = {};
    Object.keys(formState.fields).forEach(name => {
      result[name] = formState.fields[name].value;
    });
    return result;
  });
  
  // Helper to create required validation rule
  const required = (message = 'This field is required') => {
    return (value: any): boolean | string => {
      return validateRequired(value, true) || message;
    };
  };
  
  // Helper to create min length validation rule
  const minLength = (length: number, message = `Minimum length is ${length} characters`) => {
    return (value: string): boolean | string => {
      return validateMinLength(value, length) || message;
    };
  };
  
  // Helper to create max length validation rule
  const maxLength = (length: number, message = `Maximum length is ${length} characters`) => {
    return (value: string): boolean | string => {
      return validateMaxLength(value, length) || message;
    };
  };
  
  // Helper to create pattern validation rule
  const pattern = (regex: RegExp, message = 'Invalid format') => {
    return (value: string): boolean | string => {
      return validatePattern(value, regex) || message;
    };
  };
  
  // Helper to create email validation rule
  const email = (message = 'Invalid email address') => {
    return (value: string): boolean | string => {
      return validateEmail(value) || message;
    };
  };
  
  // Helper to create URL validation rule
  const url = (message = 'Invalid URL') => {
    return (value: string): boolean | string => {
      return validateUrl(value) || message;
    };
  };
  
  return {
    formState,
    addField,
    validateField,
    validate,
    getValue,
    setValue,
    touchField,
    resetForm,
    values,
    rules: {
      required,
      minLength,
      maxLength,
      pattern,
      email,
      url
    }
  };
}
