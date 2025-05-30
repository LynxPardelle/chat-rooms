import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

export interface ProfileUpdateData {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export interface ProfileSettings {
  theme?: string;
  language?: string;
  notifications?: boolean;
  messageColor?: string;
  avatarUrl?: string;
}

/**
 * Profile Page Object Model
 * Handles user profile management and settings
 */
export class ProfilePage extends BasePage {
  
  // Profile-specific selectors
  private readonly profileSelectors = {
    // Main profile container
    profileContainer: '[data-testid="profile-container"]',
    profileHeader: '[data-testid="profile-header"]',
    
    // Profile information
    usernameDisplay: '[data-testid="username-display"]',
    emailDisplay: '[data-testid="email-display"]',
    userAvatar: '[data-testid="user-avatar"]',
    joinDate: '[data-testid="join-date"]',
    
    // Edit profile form
    editProfileButton: '[data-testid="edit-profile-button"]',
    editProfileForm: '[data-testid="edit-profile-form"]',
    usernameInput: '[data-testid="profile-username-input"]',
    emailInput: '[data-testid="profile-email-input"]',
    saveProfileButton: '[data-testid="save-profile-button"]',
    cancelEditButton: '[data-testid="cancel-edit-button"]',
    
    // Password change
    changePasswordButton: '[data-testid="change-password-button"]',
    passwordChangeForm: '[data-testid="password-change-form"]',
    currentPasswordInput: '[data-testid="current-password-input"]',
    newPasswordInput: '[data-testid="new-password-input"]',
    confirmNewPasswordInput: '[data-testid="confirm-new-password-input"]',
    savePasswordButton: '[data-testid="save-password-button"]',
    
    // Avatar management
    avatarUploadButton: '[data-testid="avatar-upload-button"]',
    avatarInput: '[data-testid="avatar-input"]',
    avatarPreview: '[data-testid="avatar-preview"]',
    removeAvatarButton: '[data-testid="remove-avatar-button"]',
    
    // Settings section
    settingsContainer: '[data-testid="settings-container"]',
    themeSelector: '[data-testid="theme-selector"]',
    languageSelector: '[data-testid="language-selector"]',
    notificationToggle: '[data-testid="notification-toggle"]',
    messageColorPicker: '[data-testid="message-color-picker"]',
    
    // Preferences
    preferencesSection: '[data-testid="preferences-section"]',
    autoConnectToggle: '[data-testid="auto-connect-toggle"]',
    soundNotificationsToggle: '[data-testid="sound-notifications-toggle"]',
    desktopNotificationsToggle: '[data-testid="desktop-notifications-toggle"]',
    
    // Privacy settings
    privacySection: '[data-testid="privacy-section"]',
    onlineStatusToggle: '[data-testid="online-status-toggle"]',
    typingIndicatorToggle: '[data-testid="typing-indicator-toggle"]',
    
    // Form validation and messages
    validationError: '[data-testid="validation-error"]',
    profileSuccess: '[data-testid="profile-success"]',
    profileError: '[data-testid="profile-error"]',
    
    // Save buttons
    saveSettingsButton: '[data-testid="save-settings-button"]',
    resetSettingsButton: '[data-testid="reset-settings-button"]',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Get page instance for direct access
   */
  getPage(): Page {
    return this.page;
  }

  /**
   * Navigate to profile page
   */
  async navigateToProfile(): Promise<void> {
    await this.navigateTo('/profile');
    await this.waitForProfileToLoad();
  }

  /**
   * Wait for profile page to load
   */
  async waitForProfileToLoad(): Promise<void> {
    await this.waitForPageLoad();
    await this.page.waitForSelector(this.profileSelectors.profileContainer, { state: 'visible' });
  }

  /**
   * Get current profile information
   */
  async getProfileInfo(): Promise<{username: string, email: string}> {
    const username = await this.getTextContent(this.profileSelectors.usernameDisplay);
    const email = await this.getTextContent(this.profileSelectors.emailDisplay);
    
    return { username, email };
  }

  /**
   * Start editing profile
   */
  async startEditingProfile(): Promise<void> {
    await this.clickElement(this.profileSelectors.editProfileButton);
    await this.page.waitForSelector(this.profileSelectors.editProfileForm, { state: 'visible' });
  }

  /**
   * Update profile information
   */
  async updateProfile(data: ProfileUpdateData): Promise<void> {
    await this.startEditingProfile();
    
    if (data.username) {
      await this.fillInput(this.profileSelectors.usernameInput, data.username);
    }
    
    if (data.email) {
      await this.fillInput(this.profileSelectors.emailInput, data.email);
    }
    
    await this.clickElement(this.profileSelectors.saveProfileButton);
    await this.waitForProfileUpdateSuccess();
  }

  /**
   * Cancel profile editing
   */
  async cancelEditingProfile(): Promise<void> {
    await this.clickElement(this.profileSelectors.cancelEditButton);
    await this.page.waitForSelector(this.profileSelectors.editProfileForm, { state: 'hidden' });
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    await this.clickElement(this.profileSelectors.changePasswordButton);
    await this.page.waitForSelector(this.profileSelectors.passwordChangeForm, { state: 'visible' });
    
    await this.fillInput(this.profileSelectors.currentPasswordInput, currentPassword);
    await this.fillInput(this.profileSelectors.newPasswordInput, newPassword);
    await this.fillInput(this.profileSelectors.confirmNewPasswordInput, confirmPassword);
    
    await this.clickElement(this.profileSelectors.savePasswordButton);
    await this.waitForPasswordChangeSuccess();
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(filePath: string): Promise<void> {
    await this.clickElement(this.profileSelectors.avatarUploadButton);
    
    const fileInput = this.page.locator(this.profileSelectors.avatarInput);
    await fileInput.setInputFiles(filePath);
    
    // Wait for avatar to be uploaded and preview to update
    await this.waitForAvatarUpdate();
  }

  /**
   * Remove avatar
   */
  async removeAvatar(): Promise<void> {
    await this.clickElement(this.profileSelectors.removeAvatarButton);
    await this.clickElement(this.selectors.confirmButton);
    
    // Wait for avatar to be removed
    await this.waitForAvatarRemoval();
  }

  /**
   * Update settings
   */
  async updateSettings(settings: ProfileSettings): Promise<void> {
    if (settings.theme) {
      await this.selectOption(this.profileSelectors.themeSelector, settings.theme);
    }
    
    if (settings.language) {
      await this.selectOption(this.profileSelectors.languageSelector, settings.language);
    }
    
    if (settings.notifications !== undefined) {
      const toggle = this.page.locator(this.profileSelectors.notificationToggle);
      const isChecked = await toggle.isChecked();
      if (isChecked !== settings.notifications) {
        await toggle.click();
      }
    }
    
    if (settings.messageColor) {
      await this.setColorPicker(this.profileSelectors.messageColorPicker, settings.messageColor);
    }
    
    await this.clickElement(this.profileSelectors.saveSettingsButton);
    await this.waitForSettingsUpdateSuccess();
  }

  /**
   * Toggle notification setting
   */
  async toggleNotifications(enabled: boolean): Promise<void> {
    const toggle = this.page.locator(this.profileSelectors.notificationToggle);
    const isCurrentlyEnabled = await toggle.isChecked();
    
    if (isCurrentlyEnabled !== enabled) {
      await toggle.click();
    }
  }

  /**
   * Toggle auto-connect setting
   */
  async toggleAutoConnect(enabled: boolean): Promise<void> {
    const toggle = this.page.locator(this.profileSelectors.autoConnectToggle);
    const isCurrentlyEnabled = await toggle.isChecked();
    
    if (isCurrentlyEnabled !== enabled) {
      await toggle.click();
    }
  }

  /**
   * Toggle online status visibility
   */
  async toggleOnlineStatus(visible: boolean): Promise<void> {
    const toggle = this.page.locator(this.profileSelectors.onlineStatusToggle);
    const isCurrentlyVisible = await toggle.isChecked();
    
    if (isCurrentlyVisible !== visible) {
      await toggle.click();
    }
  }

  /**
   * Change theme
   */
  async changeTheme(theme: string): Promise<void> {
    await this.selectOption(this.profileSelectors.themeSelector, theme);
    await this.clickElement(this.profileSelectors.saveSettingsButton);
    
    // Wait for theme to be applied
    await this.waitForThemeChange(theme);
  }

  /**
   * Change language
   */
  async changeLanguage(language: string): Promise<void> {
    await this.selectOption(this.profileSelectors.languageSelector, language);
    await this.clickElement(this.profileSelectors.saveSettingsButton);
    
    // Wait for language to be applied
    await this.waitForLanguageChange();
  }

  /**
   * Reset settings to default
   */
  async resetSettings(): Promise<void> {
    await this.clickElement(this.profileSelectors.resetSettingsButton);
    await this.clickElement(this.selectors.confirmButton);
    
    await this.waitForSettingsReset();
  }

  /**
   * Verify profile information is displayed correctly
   */
  async verifyProfileInfo(expectedUsername: string, expectedEmail: string): Promise<void> {
    const displayedUsername = await this.getTextContent(this.profileSelectors.usernameDisplay);
    const displayedEmail = await this.getTextContent(this.profileSelectors.emailDisplay);
    
    expect(displayedUsername).toBe(expectedUsername);
    expect(displayedEmail).toBe(expectedEmail);
  }

  /**
   * Verify avatar is displayed
   */
  async verifyAvatarDisplayed(): Promise<void> {
    const avatar = this.page.locator(this.profileSelectors.userAvatar);
    await expect(avatar).toBeVisible();
    
    // Check that avatar has a valid src
    const src = await avatar.getAttribute('src');
    expect(src).toBeTruthy();
  }

  /**
   * Verify settings are applied
   */
  async verifySettings(expectedSettings: ProfileSettings): Promise<void> {
    if (expectedSettings.theme) {
      const themeSelector = this.page.locator(this.profileSelectors.themeSelector);
      const selectedTheme = await themeSelector.inputValue();
      expect(selectedTheme).toBe(expectedSettings.theme);
    }
    
    if (expectedSettings.notifications !== undefined) {
      const toggle = this.page.locator(this.profileSelectors.notificationToggle);
      const isChecked = await toggle.isChecked();
      expect(isChecked).toBe(expectedSettings.notifications);
    }
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<string> {
    const themeSelector = this.page.locator(this.profileSelectors.themeSelector);
    return await themeSelector.inputValue();
  }

  /**
   * Get current language
   */
  async getCurrentLanguage(): Promise<string> {
    const languageSelector = this.page.locator(this.profileSelectors.languageSelector);
    return await languageSelector.inputValue();
  }

  // Private helper methods

  private async waitForProfileUpdateSuccess(): Promise<void> {
    await this.waitForSuccessToast('Profile updated successfully');
  }

  private async waitForPasswordChangeSuccess(): Promise<void> {
    await this.waitForSuccessToast('Password changed successfully');
  }

  private async waitForAvatarUpdate(): Promise<void> {
    // Wait for avatar preview to update
    const preview = this.page.locator(this.profileSelectors.avatarPreview);
    await preview.waitFor({ state: 'visible' });
  }

  private async waitForAvatarRemoval(): Promise<void> {
    // Wait for default avatar to appear
    await this.waitForSuccessToast('Avatar removed');
  }

  private async waitForSettingsUpdateSuccess(): Promise<void> {
    await this.waitForSuccessToast('Settings updated successfully');
  }

  private async waitForThemeChange(theme: string): Promise<void> {
    // Wait for theme class to be applied to body
    await this.page.waitForFunction(
      (expectedTheme) => {
        const body = document.body;
        return body.classList.contains(`theme-${expectedTheme}`) || 
               body.getAttribute('data-theme') === expectedTheme;
      },
      theme,
      { timeout: 5000 }
    );
  }

  private async waitForLanguageChange(): Promise<void> {
    // Wait for language to be applied (this depends on your i18n implementation)
    await this.page.waitForTimeout(1000);
  }

  private async waitForSettingsReset(): Promise<void> {
    await this.waitForSuccessToast('Settings reset to default');
  }

  private async setColorPicker(selector: string, color: string): Promise<void> {
    const colorPicker = this.page.locator(selector);
    await colorPicker.fill(color);
  }

  /**
   * Verify form validation errors
   */
  async verifyValidationError(expectedMessage: string): Promise<void> {
    const errorElement = this.page.locator(this.profileSelectors.validationError);
    await errorElement.waitFor({ state: 'visible' });
    await expect(errorElement).toContainText(expectedMessage);
  }

  /**
   * Check if profile form is in edit mode
   */
  async isInEditMode(): Promise<boolean> {
    try {
      await this.page.waitForSelector(this.profileSelectors.editProfileForm, { state: 'visible', timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }
}
