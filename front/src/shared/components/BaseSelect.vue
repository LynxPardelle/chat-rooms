<template>
  <div class="form-group" :class="{ 'form-group-error': hasError }" role="region" aria-label="Select field container">
    <label 
      v-if="label" 
      :for="selectId" 
      class="form-label"
      :class="{ required: required }"
    >
      {{ label }}
    </label>
    
    <div class="select-wrapper" :class="sizeClass">
      <select
        :id="selectId"
        :value="modelValue"
        :class="selectClasses"
        :multiple="multiple"
        :disabled="disabled"
        :required="required"
        :aria-describedby="errorId"
        :aria-invalid="hasError ? 'true' : undefined"
        :aria-required="required ? 'true' : undefined"
        :data-test="testId"
        @change="onChange"
        @blur="onBlur"
        @focus="onFocus"
      >
        <option v-if="placeholder && !multiple" value="" disabled selected hidden>
          {{ placeholder }}
        </option>
        
        <optgroup 
          v-for="(group, groupName) in optionGroups" 
          :key="`group-${groupName}`" 
          :label="groupName"
        >
          <option 
            v-for="option in group" 
            :key="getOptionKey(option)" 
            :value="getOptionValue(option)"
            :disabled="option.disabled"
          >
            {{ getOptionLabel(option) }}
          </option>
        </optgroup>
        
        <option 
          v-for="option in ungroupedOptions" 
          :key="getOptionKey(option)" 
          :value="getOptionValue(option)"
          :disabled="option.disabled"
        >
          {{ getOptionLabel(option) }}
        </option>
      </select>
      
      <span class="select-arrow"></span>
    </div>
    
    <div v-if="hasError" :id="errorId" class="form-error">
      {{ errorMessage }}
    </div>
    
    <div v-else-if="helpText" class="form-help-text">
      {{ helpText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Size } from '../types';
import { getComponentClasses, getSizeClass } from '../utils/style';
import { generateUniqueId } from '../utils/accessibility';

interface SelectOption {
  label?: string;
  value: any;
  disabled?: boolean;
  group?: string;
  [key: string]: any;
}

interface Props {
  modelValue: any;
  id?: string;
  options: Array<SelectOption | string | number>;
  label?: string;
  placeholder?: string;
  size?: Size;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  errorMessage?: string;
  helpText?: string;
  valueKey?: string;
  labelKey?: string;
  testId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
  required: false,
  multiple: false,
  valueKey: 'value',
  labelKey: 'label'
});

const emits = defineEmits<{
  (e: 'update:modelValue', value: any): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'change', value: any): void;
}>();

const selectId = computed(() => props.id || generateUniqueId());
const errorId = computed(() => `${selectId.value}-error`);
const hasError = computed(() => !!props.errorMessage);
const sizeClass = computed(() => getSizeClass(props.size, 'select-wrapper'));

// Process options to normalize them
const normalizedOptions = computed<SelectOption[]>(() => {
  return props.options.map(option => {
    // If the option is a string or number, convert it to an object
    if (typeof option === 'string' || typeof option === 'number') {
      return {
        label: String(option),
        value: option
      };
    }
    return option as SelectOption;
  });
});

// Group options by the group attribute
const optionGroups = computed(() => {
  const groups: Record<string, SelectOption[]> = {};
  
  normalizedOptions.value.forEach(option => {
    if (option.group) {
      if (!groups[option.group]) {
        groups[option.group] = [];
      }
      groups[option.group].push(option);
    }
  });
  
  return groups;
});

// Options that don't belong to any group
const ungroupedOptions = computed(() => {
  return normalizedOptions.value.filter(option => !option.group);
});

/**
 * Get the key to use for option rendering
 */
const getOptionKey = (option: SelectOption) => {
  return option.value;
};

/**
 * Get the label to display for an option
 */
const getOptionLabel = (option: SelectOption) => {
  return option[props.labelKey] ?? option.label ?? option.value;
};

/**
 * Get the value of an option
 */
const getOptionValue = (option: SelectOption) => {
  return option[props.valueKey] ?? option.value;
};

/**
 * Generate select CSS classes
 */
const selectClasses = computed(() => {
  const baseClasses = getComponentClasses('form-control', {
    size: props.size,
  });
  
  const stateClasses = [
    props.disabled ? 'disabled' : '',
    hasError.value ? 'is-invalid' : '',
    props.multiple ? 'is-multiple' : ''
  ].filter(Boolean);
  
  return [baseClasses, ...stateClasses].join(' ');
});

/**
 * Handle change event
 */
const onChange = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  let value;
  
  if (props.multiple) {
    value = Array.from(select.selectedOptions).map(option => option.value);
  } else {
    value = select.value;
  }
  
  emits('update:modelValue', value);
  emits('change', value);
};

/**
 * Handle blur event
 */
const onBlur = (event: FocusEvent) => {
  emits('blur', event);
};

/**
 * Handle focus event
 */
const onFocus = (event: FocusEvent) => {
  emits('focus', event);
};
</script>

<style scoped>
.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: inline-block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-label.required::after {
  content: "*";
  color: var(--danger-color);
  margin-left: 0.25rem;
}

.select-wrapper {
  position: relative;
  display: block;
}

.select-wrapper::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--text-muted);
  pointer-events: none;
}

.form-control {
  display: block;
  width: 100%;
  height: var(--input-height-md);
  padding: 0.5rem 2.25rem 0.5rem 0.75rem;
  font-size: var(--font-size-md);
  line-height: 1.5;
  color: var(--text-primary);
  background-color: var(--card-bg);
  background-clip: padding-box;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  appearance: none;
}

.form-control:focus {
  border-color: var(--primary-hover);
  outline: 0;
  box-shadow: 0 0 0 3px var(--focus-ring-color);
}

.form-control:disabled,
.form-control.disabled {
  background-color: var(--light-bg);
  opacity: 0.65;
  cursor: not-allowed;
}

.form-control.is-invalid {
  border-color: var(--danger-color);
}

.form-control.is-invalid:focus {
  box-shadow: 0 0 0 3px rgba(var(--danger-color), 0.25);
}

.form-control.is-multiple {
  height: auto;
  min-height: var(--input-height-md);
}

/* Size variants */
.select-wrapper-sm .form-control {
  height: var(--input-height-sm);
  padding: 0.25rem 2.25rem 0.25rem 0.5rem;
  font-size: var(--font-size-sm);
  border-radius: var(--border-radius-sm);
}

.select-wrapper-lg .form-control {
  height: var(--input-height-lg);
  padding: 0.75rem 2.25rem 0.75rem 1rem;
  font-size: var(--font-size-lg);
  border-radius: var(--border-radius-lg);
}

/* Error message */
.form-error {
  font-size: var(--font-size-sm);
  color: var(--danger-color);
  margin-top: 0.25rem;
}

.form-help-text {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.form-group-error .form-label {
  color: var(--danger-color);
}
</style>
