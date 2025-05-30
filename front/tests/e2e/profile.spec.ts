import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page';
import { ProfilePage } from './page-objects/profile-page';
import { DatabaseHelper } from './utils/database-helper';

test.describe('Profile Management', () => {
  let authPage: AuthPage;
  let profilePage: ProfilePage;
  let dbHelper: DatabaseHelper;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    profilePage = new ProfilePage(page);
    dbHelper = new DatabaseHelper();
    
    await dbHelper.connect();
    await dbHelper.cleanDatabase();
    await dbHelper.seedTestData();
    
    // Login before each test
    await authPage.navigateToLogin();
    await authPage.login({ 
      email: 'testuser@example.com', 
      password: 'TestPassword123!' 
    });
  });

  test.afterEach(async () => {
    await dbHelper.cleanDatabase();
    await dbHelper.disconnect();
  });

  test('should display user profile information', async () => {
    await profilePage.navigateToProfile();
    
    // Verify profile information is displayed
    await expect(profilePage.getPage().locator('[data-testid="username-display"]')).toBeVisible();
    await expect(profilePage.getPage().locator('[data-testid="email-display"]')).toBeVisible();
    await expect(profilePage.getPage().locator('[data-testid="join-date"]')).toBeVisible();
  });

  test('should update profile information', async () => {
    await profilePage.navigateToProfile();
    
    // Start editing profile
    await profilePage.getPage().locator('[data-testid="edit-profile-button"]').click();
    
    const newUsername = 'UpdatedTestUser';
    
    // Update profile
    await profilePage.updateProfile({
      username: newUsername
    });
    
    // Verify updates
    await expect(profilePage.getPage().locator('[data-testid="username-display"]')).toContainText(newUsername);
  });

  test('should handle avatar upload', async () => {
    await profilePage.navigateToProfile();
    
    // Upload avatar
    await profilePage.uploadAvatar('fake-avatar-path.jpg');
    
    // Verify avatar was uploaded
    await expect(profilePage.getPage().locator('[data-testid="avatar-preview"]')).toBeVisible();
  });
  test('should manage notification preferences', async () => {
    await profilePage.navigateToProfile();
    
    // Toggle notification preferences
    await profilePage.toggleNotifications(false);
    
    // Verify settings were saved
    await expect(profilePage.getPage().locator('[data-testid="profile-success"]')).toBeVisible();
  });

  test('should change password', async () => {
    await profilePage.navigateToProfile();
    
    // Change password
    await profilePage.changePassword(
      'TestPassword123!',
      'NewPassword123!',
      'NewPassword123!'
    );
    
    // Verify password change success
    await expect(profilePage.getPage().locator('[data-testid="profile-success"]')).toBeVisible();
  });

  test('should update theme settings', async () => {
    await profilePage.navigateToProfile();
    
    // Update theme settings
    await profilePage.updateSettings({
      theme: 'dark',
      notifications: false
    });
    
    // Verify settings were saved
    await expect(profilePage.getPage().locator('[data-testid="profile-success"]')).toBeVisible();
  });
});
