import { User } from '../entities/index';
import { UpdateUserSettingsDto, UserThemeDto, AccessibilityConfigDto, ExportSettingsDto } from '../../application/dtos/user-settings.dto';

export interface IUserSettingsService {
  updateUserSettings(userId: string, settings: UpdateUserSettingsDto): Promise<User>;
  getUserSettings(userId: string): Promise<User>;
  updateTheme(userId: string, theme: UserThemeDto): Promise<User>;
  updateAccessibilityConfig(userId: string, config: AccessibilityConfigDto): Promise<User>;
  exportUserSettings(userId: string): Promise<ExportSettingsDto>;
  importUserSettings(userId: string, settings: any): Promise<User>;
}
