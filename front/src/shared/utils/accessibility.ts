/**
 * Accessibility utilities for enhancing component accessibility
 */

/**
 * Generate unique IDs for accessibility purposes
 * @returns A unique string ID
 */
export const generateUniqueId = (): string => {
  return `id-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Converts size string to corresponding aria-size attribute value
 * @param size Component size variant
 * @returns Appropriate aria-size value or undefined if not applicable
 */
export const sizeToAriaSize = (size?: string): string | undefined => {
  if (!size) return undefined;
  
  switch (size) {
    case 'sm': return 'small';
    case 'lg': return 'large';
    case 'xl': return 'xlarge';
    default: return undefined;
  }
};

/**
 * Creates an aria-label if none is provided but a label is available
 * @param ariaLabel Explicit aria-label
 * @param label Visual label that could be used for aria-label
 * @returns Appropriate aria-label value or undefined
 */
export const createAriaLabel = (ariaLabel?: string, label?: string): string | undefined => {
  return ariaLabel || (label ? label : undefined);
};

/**
 * Check if a component is currently in a pressed state
 * (for toggle buttons or similar components)
 * @param isPressed Whether the component is pressed
 * @returns The aria-pressed attribute value
 */
export const getAriaPressed = (isPressed?: boolean): string | undefined => {
  return isPressed !== undefined ? String(isPressed) : undefined;
};

/**
 * Generate appropriate ARIA attributes for a form field
 * @param id Element ID
 * @param isRequired Whether the field is required
 * @param isInvalid Whether the field is invalid
 * @param errorId ID of the error message element
 * @returns Object containing appropriate ARIA attributes
 */
export const getFormFieldAriaAttributes = (
  id?: string,
  isRequired?: boolean,
  isInvalid?: boolean,
  errorId?: string
): Record<string, string | undefined> => {
  return {
    'aria-required': isRequired ? 'true' : undefined,
    'aria-invalid': isInvalid ? 'true' : undefined,
    'aria-describedby': errorId,
    id
  };
};

/**
 * Check if a string is empty or only whitespace
 * @param value String to check
 * @returns True if the string is empty or only contains whitespace
 */
export const isEmptyString = (value?: string): boolean => {
  return !value || value.trim() === '';
};

/**
 * Returns the correct role for an interactive element based on its behavior
 * @param isDisabled Whether the element is disabled
 * @param role The explicit role
 * @returns The appropriate role attribute value
 */
export const getElementRole = (isDisabled?: boolean, role?: string): string | undefined => {
  // If explicitly disabled, some elements should have role="presentation" instead
  // of their interactive role
  if (isDisabled && ['link', 'button'].includes(role || '')) {
    return 'presentation';
  }
  return role;
};
