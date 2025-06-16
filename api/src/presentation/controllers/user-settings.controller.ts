import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../infrastructure/security/guards/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/security/decorators/current-user.decorator';
import { UserSettingsService } from '../../infrastructure/user-settings/user-settings.service';
import { AvatarManagementService } from '../../infrastructure/user-settings/avatar-management.service';
import {
  UpdateUserSettingsDto,
  UserThemeDto,
  AccessibilityConfigDto,
  ImportSettingsDto,
  UserSettingsResponseDto,
} from '../../application/dtos/user-settings.dto';
import { User } from '../../domain/entities/index';

@Controller('api/user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  private readonly logger = new Logger(UserSettingsController.name);

  constructor(
    private readonly userSettingsService: UserSettingsService,
    private readonly avatarManagementService: AvatarManagementService,
  ) {}

  @Get('profile')
  async getUserSettings(@CurrentUser() user: User): Promise<UserSettingsResponseDto> {
    try {
      this.logger.log(`Getting settings for user ${user.id}`);
      const userSettings = await this.userSettingsService.getUserSettings(user.id);
      
      return {
        id: userSettings.id,
        username: userSettings.username,
        email: userSettings.email,
        textColor: userSettings.textColor,
        backgroundColor: userSettings.backgroundColor,
        avatarUrl: userSettings.avatarUrl,
        theme: userSettings.theme,
        accessibilityConfig: userSettings.accessibilityConfig,
        notificationSettings: userSettings.notificationSettings,
        language: userSettings.language,
        timezone: userSettings.timezone,
        createdAt: userSettings.createdAt,
        updatedAt: userSettings.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error getting settings for user ${user.id}:`, error);
      throw error;
    }
  }

  @Post('profile')
  async updateUserSettings(
    @CurrentUser() user: User,
    @Body() settings: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    try {
      this.logger.log(`Updating settings for user ${user.id}`);
      const updatedUser = await this.userSettingsService.updateUserSettings(user.id, settings);
      
      return {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        textColor: updatedUser.textColor,
        backgroundColor: updatedUser.backgroundColor,
        avatarUrl: updatedUser.avatarUrl,
        theme: updatedUser.theme,
        accessibilityConfig: updatedUser.accessibilityConfig,
        notificationSettings: updatedUser.notificationSettings,
        language: updatedUser.language,
        timezone: updatedUser.timezone,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error updating settings for user ${user.id}:`, error);
      throw error;
    }
  }

  @Post('theme')
  async updateTheme(
    @CurrentUser() user: User,
    @Body() theme: UserThemeDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Updating theme for user ${user.id}`);
      await this.userSettingsService.updateTheme(user.id, theme);
      
      return {
        success: true,
        message: 'Theme updated successfully',
      };
    } catch (error) {
      this.logger.error(`Error updating theme for user ${user.id}:`, error);
      throw error;
    }
  }

  @Get('themes')
  async getAvailableThemes(): Promise<{ themes: any[] }> {
    // Return predefined themes
    const themes = [
      {
        name: 'light',
        description: 'Light theme with bright colors',
        preview: {
          primaryColor: '#007bff',
          backgroundColor: '#ffffff',
          textColor: '#212529',
        },
      },
      {
        name: 'dark',
        description: 'Dark theme for low light environments',
        preview: {
          primaryColor: '#0d6efd',
          backgroundColor: '#212529',
          textColor: '#ffffff',
        },
      },
      {
        name: 'high-contrast',
        description: 'High contrast theme for accessibility',
        preview: {
          primaryColor: '#ffff00',
          backgroundColor: '#000000',
          textColor: '#ffffff',
        },
      },
      {
        name: 'sepia',
        description: 'Sepia theme for reduced eye strain',
        preview: {
          primaryColor: '#8b4513',
          backgroundColor: '#f4f3e7',
          textColor: '#5d4e37',
        },
      },
    ];

    return { themes };
  }

  @Post('accessibility')
  async updateAccessibilityConfig(
    @CurrentUser() user: User,
    @Body() config: AccessibilityConfigDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Updating accessibility config for user ${user.id}`);
      await this.userSettingsService.updateAccessibilityConfig(user.id, config);
      
      return {
        success: true,
        message: 'Accessibility configuration updated successfully',
      };
    } catch (error) {
      this.logger.error(`Error updating accessibility config for user ${user.id}:`, error);
      throw error;
    }
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; message: string; data: any }> {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      this.logger.log(`Uploading avatar for user ${user.id}`);
      const result = await this.avatarManagementService.uploadAvatar(user.id, file);
      
      return {
        success: true,
        message: 'Avatar uploaded successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error uploading avatar for user ${user.id}:`, error);
      throw error;
    }
  }

  @Delete('avatar')
  async deleteAvatar(@CurrentUser() user: User): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Deleting avatar for user ${user.id}`);
      await this.avatarManagementService.deleteAvatar(user.id);
      
      return {
        success: true,
        message: 'Avatar deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting avatar for user ${user.id}:`, error);
      throw error;
    }
  }

  @Post('avatar/generate/:type')
  async generateAvatar(
    @CurrentUser() user: User,
    @Param('type') type: 'identicon' | 'initials',
    @Body() options?: any,
  ): Promise<{ success: boolean; message: string; data: any }> {
    try {
      this.logger.log(`Generating ${type} avatar for user ${user.id}`);
      const result = await this.avatarManagementService.generateAvatar(user.id, type, options);
      
      return {
        success: true,
        message: `${type} avatar generated successfully`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error generating ${type} avatar for user ${user.id}:`, error);
      throw error;
    }
  }

  @Get('export')
  async exportUserSettings(@CurrentUser() user: User): Promise<any> {
    try {
      this.logger.log(`Exporting settings for user ${user.id}`);
      const settings = await this.userSettingsService.exportUserSettings(user.id);
      
      return settings;
    } catch (error) {
      this.logger.error(`Error exporting settings for user ${user.id}:`, error);
      throw error;
    }
  }

  @Post('import')
  async importUserSettings(
    @CurrentUser() user: User,
    @Body() settings: ImportSettingsDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Importing settings for user ${user.id}`);
      await this.userSettingsService.importUserSettings(user.id, settings);
      
      return {
        success: true,
        message: 'Settings imported successfully',
      };
    } catch (error) {
      this.logger.error(`Error importing settings for user ${user.id}:`, error);
      throw error;
    }
  }

  @Get('validate')
  async validateSettings(@CurrentUser() user: User): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      this.logger.log(`Validating settings for user ${user.id}`);
      const userSettings = await this.userSettingsService.getUserSettings(user.id);
      
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Validate contrast ratio
      if (userSettings.textColor && userSettings.backgroundColor) {
        const contrastRatio = this.calculateContrastRatio(
          userSettings.textColor,
          userSettings.backgroundColor,
        );
        
        if (contrastRatio < 4.5) {
          issues.push('Text and background colors do not meet WCAG AA accessibility standards');
          recommendations.push('Choose colors with higher contrast ratio (minimum 4.5:1)');
        } else if (contrastRatio < 7.0) {
          recommendations.push('Consider higher contrast for WCAG AAA compliance (7:1 ratio)');
        }
      }

      // Validate accessibility settings
      if (userSettings.accessibilityConfig) {
        const config = userSettings.accessibilityConfig;
        
        if (config.fontSize && config.fontSize < 1.0) {
          recommendations.push('Consider using larger font size for better readability');
        }
        
        if (!config.focusIndicator) {
          recommendations.push('Enable focus indicators for better keyboard navigation');
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Error validating settings for user ${user.id}:`, error);
      throw error;
    }
  }

  private calculateContrastRatio(color1: string, color2: string): number {
    // Simplified contrast ratio calculation
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
