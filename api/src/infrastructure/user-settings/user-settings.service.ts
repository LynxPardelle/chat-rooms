import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/index';
import { UpdateUserSettingsDto, UserThemeDto, AccessibilityConfigDto } from '../../application/dtos/user-settings.dto';
import { IUserSettingsService } from '../../domain/interfaces/user-settings.interface';

@Injectable()
export class UserSettingsService implements IUserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
  ) {}

  async updateUserSettings(userId: string, settings: UpdateUserSettingsDto): Promise<User> {
    try {
      this.logger.log(`Updating settings for user ${userId}`);
      
      // Validate settings
      await this.validateSettings(settings);
      
      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            ...settings,
            updatedAt: new Date(),
          },
        },
        { new: true, runValidators: true }
      ).exec();

      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      this.logger.log(`Settings updated successfully for user ${userId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating settings for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserSettings(userId: string): Promise<User> {
    try {
      const user = await this.userModel.findById(userId).exec();
      
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Error getting settings for user ${userId}:`, error);
      throw error;
    }
  }

  async updateTheme(userId: string, theme: UserThemeDto): Promise<User> {
    try {
      this.logger.log(`Updating theme for user ${userId}`);
      
      // Validate theme
      await this.validateTheme(theme);
      
      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            theme: theme,
            updatedAt: new Date(),
          },
        },
        { new: true }
      ).exec();

      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating theme for user ${userId}:`, error);
      throw error;
    }
  }

  async updateAccessibilityConfig(userId: string, config: AccessibilityConfigDto): Promise<User> {
    try {
      this.logger.log(`Updating accessibility config for user ${userId}`);
      
      // Validate accessibility configuration
      await this.validateAccessibilityConfig(config);
      
      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            accessibilityConfig: config,
            updatedAt: new Date(),
          },
        },
        { new: true }
      ).exec();

      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating accessibility config for user ${userId}:`, error);
      throw error;
    }
  }

  async exportUserSettings(userId: string): Promise<any> {
    try {
      const user = await this.userModel.findById(userId).exec();
      
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return {
        theme: user.theme,
        textColor: user.textColor,
        backgroundColor: user.backgroundColor,
        accessibilityConfig: user.accessibilityConfig,
        notificationSettings: user.notificationSettings,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };
    } catch (error) {
      this.logger.error(`Error exporting settings for user ${userId}:`, error);
      throw error;
    }
  }

  async importUserSettings(userId: string, settings: any): Promise<User> {
    try {
      this.logger.log(`Importing settings for user ${userId}`);
      
      // Validate imported settings
      if (!settings || typeof settings !== 'object') {
        throw new BadRequestException('Invalid settings format');
      }

      const updateData: any = {};
      
      if (settings.theme) {
        await this.validateTheme(settings.theme);
        updateData.theme = settings.theme;
      }
      
      if (settings.textColor) {
        updateData.textColor = settings.textColor;
      }
      
      if (settings.backgroundColor) {
        updateData.backgroundColor = settings.backgroundColor;
      }
      
      if (settings.accessibilityConfig) {
        await this.validateAccessibilityConfig(settings.accessibilityConfig);
        updateData.accessibilityConfig = settings.accessibilityConfig;
      }

      updateData.updatedAt = new Date();

      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).exec();

      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return updatedUser;
    } catch (error) {
      this.logger.error(`Error importing settings for user ${userId}:`, error);
      throw error;
    }
  }

  private async validateSettings(settings: UpdateUserSettingsDto): Promise<void> {
    // Validate color formats
    if (settings.textColor && !this.isValidHexColor(settings.textColor)) {
      throw new BadRequestException('Invalid text color format');
    }
    
    if (settings.backgroundColor && !this.isValidHexColor(settings.backgroundColor)) {
      throw new BadRequestException('Invalid background color format');
    }

    // Validate contrast ratio
    if (settings.textColor && settings.backgroundColor) {
      const contrastRatio = this.calculateContrastRatio(settings.textColor, settings.backgroundColor);
      if (contrastRatio < 4.5) {
        throw new BadRequestException('Color combination does not meet accessibility standards (minimum contrast ratio: 4.5:1)');
      }
    }
  }

  private async validateTheme(theme: UserThemeDto): Promise<void> {
    const validThemes = ['light', 'dark', 'high-contrast', 'sepia', 'custom'];
    
    if (!validThemes.includes(theme.name)) {
      throw new BadRequestException(`Invalid theme name. Valid themes: ${validThemes.join(', ')}`);
    }    if (theme.customColors) {
      for (const [key, color] of Object.entries(theme.customColors)) {
        if (typeof color === 'string' && !this.isValidHexColor(color)) {
          throw new BadRequestException(`Invalid color format for ${key}`);
        }
      }
    }
  }

  private async validateAccessibilityConfig(config: AccessibilityConfigDto): Promise<void> {
    if (config.fontSize && (config.fontSize < 0.5 || config.fontSize > 3.0)) {
      throw new BadRequestException('Font size must be between 0.5 and 3.0');
    }

    if (config.lineHeight && (config.lineHeight < 1.0 || config.lineHeight > 2.5)) {
      throw new BadRequestException('Line height must be between 1.0 and 2.5');
    }
  }

  private isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;
    return hexColorRegex.test(color);
  }

  private calculateContrastRatio(color1: string, color2: string): number {
    // Simplified contrast ratio calculation
    // In production, use a proper color contrast library
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    const l1 = this.getLuminance(rgb1);
    const l2 = this.getLuminance(rgb2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  private getLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
}
