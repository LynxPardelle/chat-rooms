import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export type HexColorOptions = {
  allowShorthand?: boolean; // Allow 3-digit hex codes like #fff
  allowAlpha?: boolean; // Allow 8-digit hex codes with alpha channel
  allowNamedColors?: boolean; // Allow CSS named colors
  forbidDarkColors?: boolean; // Forbid very dark colors for readability
  forbidLightColors?: boolean; // Forbid very light colors for readability
  minContrast?: number; // Minimum contrast ratio (0-21)
};

const DEFAULT_OPTIONS: HexColorOptions = {
  allowShorthand: true,
  allowAlpha: false,
  allowNamedColors: true,
  forbidDarkColors: false,
  forbidLightColors: false,
  minContrast: undefined,
};

// Common CSS named colors (subset)
const NAMED_COLORS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque',
  'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod',
  'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
  'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
  'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray',
  'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray',
  'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
  'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey',
  'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta',
  'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
  'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise',
  'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
  'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
  'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum',
  'powderblue', 'purple', 'red', 'rosybrown', 'royalblue', 'saddlebrown',
  'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver',
  'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
  'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
];

@ValidatorConstraint({ name: 'isHexColor', async: false })
export class IsHexColorConstraint implements ValidatorConstraintInterface {
  validate(color: string, args: ValidationArguments): boolean {
    if (!color || typeof color !== 'string') {
      return false;
    }

    const options: HexColorOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    const trimmedColor = color.trim().toLowerCase();

    // Check named colors if allowed
    if (options.allowNamedColors && NAMED_COLORS.includes(trimmedColor)) {
      return this.validateColorConstraints(trimmedColor, options);
    }

    // Must start with # for hex colors
    if (!trimmedColor.startsWith('#')) {
      return false;
    }

    const hexPart = trimmedColor.substring(1);

    // Validate hex patterns
    let isValidHex = false;
    
    // 6-digit hex (e.g., #ff0000)
    if (/^[0-9a-f]{6}$/i.test(hexPart)) {
      isValidHex = true;
    }
    
    // 3-digit hex (e.g., #f00) if allowed
    if (options.allowShorthand && /^[0-9a-f]{3}$/i.test(hexPart)) {
      isValidHex = true;
    }
    
    // 8-digit hex with alpha (e.g., #ff0000ff) if allowed
    if (options.allowAlpha && /^[0-9a-f]{8}$/i.test(hexPart)) {
      isValidHex = true;
    }

    if (!isValidHex) {
      return false;
    }

    return this.validateColorConstraints(trimmedColor, options);
  }

  defaultMessage(args: ValidationArguments): string {
    const options: HexColorOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    const allowedFormats = ['6-digit hex (e.g., #ff0000)'];
    
    if (options.allowShorthand) {
      allowedFormats.push('3-digit hex (e.g., #f00)');
    }
    if (options.allowAlpha) {
      allowedFormats.push('8-digit hex with alpha (e.g., #ff0000ff)');
    }
    if (options.allowNamedColors) {
      allowedFormats.push('CSS named colors (e.g., red, blue)');
    }

    let message = `Color must be a valid ${allowedFormats.join(', ')}.`;

    if (options.forbidDarkColors) {
      message += ' Very dark colors are not allowed for readability.';
    }
    if (options.forbidLightColors) {
      message += ' Very light colors are not allowed for readability.';
    }
    if (options.minContrast) {
      message += ` Minimum contrast ratio of ${options.minContrast} is required.`;
    }

    return message;
  }

  private validateColorConstraints(color: string, options: HexColorOptions): boolean {
    // Convert to RGB for luminance calculation
    const rgb = this.colorToRgb(color);
    if (!rgb) {
      return true; // If we can't parse it, assume it's valid (fallback)
    }

    const luminance = this.calculateLuminance(rgb.r, rgb.g, rgb.b);

    // Check dark color constraint
    if (options.forbidDarkColors && luminance < 0.1) {
      return false;
    }

    // Check light color constraint
    if (options.forbidLightColors && luminance > 0.9) {
      return false;
    }

    // TODO: Implement contrast ratio checking if needed
    // This would require a background color to compare against

    return true;
  }

  private colorToRgb(color: string): { r: number; g: number; b: number } | null {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      
      if (hex.length === 3) {
        // Convert 3-digit to 6-digit
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b };
      }
      
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b };
      }
      
      if (hex.length === 8) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b };
      }
    }

    // Handle named colors (simplified - would need full color dictionary in production)
    const namedColorMap: Record<string, { r: number; g: number; b: number }> = {
      'black': { r: 0, g: 0, b: 0 },
      'white': { r: 255, g: 255, b: 255 },
      'red': { r: 255, g: 0, b: 0 },
      'green': { r: 0, g: 128, b: 0 },
      'blue': { r: 0, g: 0, b: 255 },
      'yellow': { r: 255, g: 255, b: 0 },
      'cyan': { r: 0, g: 255, b: 255 },
      'magenta': { r: 255, g: 0, b: 255 },
      'gray': { r: 128, g: 128, b: 128 },
      'grey': { r: 128, g: 128, b: 128 },
    };

    return namedColorMap[color.toLowerCase()] || null;
  }

  private calculateLuminance(r: number, g: number, b: number): number {
    // Convert RGB to relative luminance (WCAG formula)
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;

    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }
}

export function IsHexColor(
  options?: HexColorOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsHexColorConstraint,
    });
  };
}
