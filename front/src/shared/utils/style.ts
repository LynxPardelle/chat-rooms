/**
 * Styling utilities for components
 */
import type { ComponentState, Size, Variant } from '../types';

/**
 * Generate classes based on component size
 * @param size Component size ('sm', 'md', 'lg', 'xl')
 * @param prefix Class prefix to use before the size
 * @returns CSS class string
 */
export const getSizeClass = (size?: Size, prefix = ''): string => {
  if (!size || size === 'md') return '';
  return `${prefix}${prefix ? '-' : ''}${size}`;
};

/**
 * Generate classes based on component variant
 * @param variant Component variant ('primary', 'secondary', etc.)
 * @param prefix Class prefix to use before the variant
 * @param outline Whether the component uses an outline style
 * @returns CSS class string
 */
export const getVariantClass = (
  variant?: Variant, 
  prefix = '', 
  outline = false
): string => {
  if (!variant) return '';
  const outlinePart = outline ? '-outline' : '';
  return `${prefix}${prefix ? '-' : ''}${variant}${outlinePart}`;
};

/**
 * Generate a complete class list for a component based on its state
 * @param baseClass The base component class
 * @param state Component state (size, variant, etc.)
 * @returns Complete class string
 */
export const getComponentClasses = (
  baseClass: string, 
  state?: ComponentState
): string => {
  const classes: string[] = [baseClass];
  
  if (!state) return baseClass;
  
  if (state.size) {
    const sizeClass = getSizeClass(state.size, baseClass);
    if (sizeClass) classes.push(sizeClass);
  }
  
  if (state.variant) {
    const variantClass = getVariantClass(state.variant, baseClass, !!state.outline);
    if (variantClass) classes.push(variantClass);
  }
  
  if (state.rounded) {
    classes.push(`${baseClass}-rounded`);
  }
  
  if (state.block) {
    classes.push(`${baseClass}-block`);
  }
  
  return classes.filter(Boolean).join(' ');
};

/**
 * Create a CSS variable value with a fallback
 * @param value Main value
 * @param fallback Fallback value
 * @returns CSS var() with fallback
 */
export const cssVar = (value: string, fallback?: string): string => {
  if (fallback) {
    return `var(${value}, ${fallback})`;
  }
  return `var(${value})`;
};

/**
 * Generate utility classes based on props
 * @param props Object with boolean flags for utility classes
 * @returns String of utility classes
 */
export const utilityClasses = (props: Record<string, boolean | undefined>): string => {
  return Object.entries(props)
    .filter(([, value]) => value === true)
    .map(([key]) => key.replace(/([A-Z])/g, '-$1').toLowerCase())
    .join(' ');
};
