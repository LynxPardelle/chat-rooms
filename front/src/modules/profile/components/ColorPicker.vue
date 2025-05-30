<template>
  <div class="color-picker-container mb-4">
    <h5 class="mb-3">Color Settings</h5>
    
    <!-- Color Input Fields -->
    <div class="row g-3">
      <div class="col-md-6">
        <label for="textColor" class="form-label">Text Color</label>
        <div class="input-group">
          <input 
            id="textColor"
            v-model="localTextColor"
            type="text" 
            class="form-control" 
            placeholder="#000000"
            @input="validateAndEmitTextColor"
          >
          <input 
            type="color" 
            class="form-control form-control-color" 
            v-model="localTextColor" 
            @input="validateAndEmitTextColor"
          >
        </div>
      </div>
      
      <div class="col-md-6">
        <label for="backgroundColor" class="form-label">Background Color</label>
        <div class="input-group">
          <input 
            id="backgroundColor"
            v-model="localBgColor"
            type="text" 
            class="form-control" 
            placeholder="#FFFFFF"
            @input="validateAndEmitBgColor"
          >
          <input 
            type="color" 
            class="form-control form-control-color" 
            v-model="localBgColor" 
            @input="validateAndEmitBgColor"
          >
        </div>
      </div>
    </div>
    
    <!-- Color Contrast Validation -->
    <div class="color-contrast-indicator mt-3">
      <div class="d-flex align-items-center">
        <div class="contrast-badge me-2" :class="contrastClass">
          {{ contrastRatio.toFixed(1) }}:1
        </div>
        <small>
          {{ contrastMessage }}
        </small>
      </div>
      <div 
        v-if="contrastWarning" 
        class="alert alert-warning mt-2 p-2 small"
      >
        {{ contrastWarning }}
      </div>
    </div>
    
    <!-- Predefined Color Themes -->
    <div class="color-themes mt-4">
      <h6 class="mb-2">Predefined Themes</h6>
      <div class="d-flex flex-wrap gap-2">
        <button
          v-for="theme in predefinedThemes"
          :key="theme.name"
          type="button"
          class="theme-button"
          :style="{
            color: theme.textColor,
            backgroundColor: theme.backgroundColor
          }"
          @click="applyTheme(theme)"
          :title="theme.name"
        >
          Aa
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { COLOR_CONSTRAINTS } from '../types/profile.types';
import type { ColorTheme } from '../types/profile.types';

// Props and emit
interface Props {
  textColor?: string;
  bgColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  textColor: '#000000',
  bgColor: '#FFFFFF'
});

const emit = defineEmits<{
  'update:textColor': [value: string];
  'update:bgColor': [value: string];
}>();

// Local state
const localTextColor = ref(props.textColor);
const localBgColor = ref(props.bgColor);

// Predefined color themes
const predefinedThemes = ref<ColorTheme[]>([
  {
    name: 'Default',
    textColor: '#000000',
    backgroundColor: '#FFFFFF',
    isAccessible: true,
    contrastRatio: 21
  },
  {
    name: 'Dark Mode',
    textColor: '#FFFFFF',
    backgroundColor: '#212529',
    isAccessible: true,
    contrastRatio: 14.63
  },
  {
    name: 'Blue',
    textColor: '#FFFFFF',
    backgroundColor: '#0d6efd',
    isAccessible: true,
    contrastRatio: 4.54
  },
  {
    name: 'Green',
    textColor: '#FFFFFF',
    backgroundColor: '#198754',
    isAccessible: true,
    contrastRatio: 4.66
  },
  {
    name: 'Purple',
    textColor: '#FFFFFF',
    backgroundColor: '#6f42c1',
    isAccessible: true,
    contrastRatio: 5.24
  },
  {
    name: 'Orange',
    textColor: '#212529',
    backgroundColor: '#fd7e14',
    isAccessible: true,
    contrastRatio: 4.62
  }
]);

// Computed properties
const contrastRatio = computed((): number => {
  return calculateContrastRatio(localTextColor.value, localBgColor.value);
});

const isContrastValid = computed((): boolean => {
  return contrastRatio.value >= COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO;
});

const contrastClass = computed((): string => {
  if (contrastRatio.value >= 7) {
    return 'contrast-high';
  } else if (contrastRatio.value >= COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO) {
    return 'contrast-good';
  } else if (contrastRatio.value >= COLOR_CONSTRAINTS.LARGE_TEXT_MIN_CONTRAST_RATIO) {
    return 'contrast-medium';
  } else {
    return 'contrast-low';
  }
});

const contrastMessage = computed((): string => {
  if (contrastRatio.value >= 7) {
    return 'Excellent contrast - AAA compliant';
  } else if (contrastRatio.value >= COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO) {
    return 'Good contrast - AA compliant';
  } else if (contrastRatio.value >= COLOR_CONSTRAINTS.LARGE_TEXT_MIN_CONTRAST_RATIO) {
    return 'Fair contrast - AA compliant for large text only';
  } else {
    return 'Poor contrast - Not WCAG compliant';
  }
});

const contrastWarning = computed((): string | null => {
  if (!isContrastValid.value) {
    return `Consider using colors with higher contrast (at least ${COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO}:1) for better readability.`;
  }
  return null;
});

// Methods
function validateAndEmitTextColor() {
  if (isValidHex(localTextColor.value)) {
    emit('update:textColor', localTextColor.value);
  }
}

function validateAndEmitBgColor() {
  if (isValidHex(localBgColor.value)) {
    emit('update:bgColor', localBgColor.value);
  }
}

function isValidHex(color: string): boolean {
  // Test if string is a valid hex color (with or without leading #)
  return /^#?([a-f\d]{3}|[a-f\d]{6})$/i.test(color);
}

function applyTheme(theme: ColorTheme) {
  localTextColor.value = theme.textColor;
  localBgColor.value = theme.backgroundColor;
  emit('update:textColor', theme.textColor);
  emit('update:bgColor', theme.backgroundColor);
}

/**
 * Calculate contrast ratio between two colors
 */
function calculateContrastRatio(textColor: string, backgroundColor: string): number {
  // Convert hex to RGB
  const textRgb = hexToRgb(textColor);
  const bgRgb = hexToRgb(backgroundColor);
  
  if (!textRgb || !bgRgb) return 21; // Default high contrast if colors invalid
  
  // Calculate luminance
  const textLuminance = calculateLuminance(textRgb);
  const bgLuminance = calculateLuminance(bgRgb);
  
  // Calculate contrast ratio
  const lighter = Math.max(textLuminance, bgLuminance);
  const darker = Math.min(textLuminance, bgLuminance);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  // Ensure hex has # prefix
  const formattedHex = hex.charAt(0) === '#' ? hex : `#${hex}`;
  
  // Convert short format (#RGB) to long format (#RRGGBB) if needed
  const fullHex = formattedHex.length === 4 ? 
    `#${formattedHex.charAt(1)}${formattedHex.charAt(1)}${formattedHex.charAt(2)}${formattedHex.charAt(2)}${formattedHex.charAt(3)}${formattedHex.charAt(3)}` : 
    formattedHex;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result 
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}

/**
 * Calculate relative luminance from RGB values
 */
function calculateLuminance({ r, g, b }: { r: number, g: number, b: number }): number {
  // Convert RGB to sRGB
  const sR = r / 255;
  const sG = g / 255;
  const sB = b / 255;
  
  // Calculate luminance
  const R = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
  const G = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
  const B = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);
  
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Watch props changes
watch(() => props.textColor, (newColor) => {
  if (newColor !== localTextColor.value) {
    localTextColor.value = newColor;
  }
});

watch(() => props.bgColor, (newColor) => {
  if (newColor !== localBgColor.value) {
    localBgColor.value = newColor;
  }
});
</script>

<style scoped>
.color-picker-container {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.contrast-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: bold;
  min-width: 56px;
  text-align: center;
  font-size: 0.875rem;
}

.contrast-high {
  background-color: #198754;
  color: white;
}

.contrast-good {
  background-color: #0dcaf0;
  color: #212529;
}

.contrast-medium {
  background-color: #ffc107;
  color: #212529;
}

.contrast-low {
  background-color: #dc3545;
  color: white;
}

.theme-button {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 2px solid transparent;
  font-weight: bold;
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.theme-button:hover {
  transform: scale(1.05);
  border-color: #0d6efd;
}

.form-control-color {
  width: 48px;
}
</style>
