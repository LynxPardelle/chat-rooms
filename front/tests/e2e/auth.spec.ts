import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page';
import { ChatPage } from './page-objects/chat-page';

/**
 * Authentication Flow E2E Tests
 * 
 * Tests comprehensive authentication flows including:
 * - User registration with validation
 * - User login with JWT handling
 * - Session persistence and logout
 * - Error handling and validation
 */
test.describe('Authentication Flow', () => {
  let authPage: AuthPage;
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    chatPage = new ChatPage(page);
  });

  test.describe('User Registration', () => {
    test('should successfully register a new user', async ({ page }) => {
      // Navigate to registration page
      await authPage.navigateToRegister();

      // Register new user
      const userData = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      };

      await authPage.register(userData);

      // Verify successful registration
      await authPage.waitForRegistrationSuccess();
      
      // Should be automatically logged in and redirected to chat
      await chatPage.waitForChatToLoad();
      await chatPage.verifyChatUIElements();
    });

    test('should show validation errors for invalid registration data', async ({ page }) => {
      await authPage.navigateToRegister();

      // Test invalid email
      await authPage.attemptInvalidRegistration({
        username: 'testuser',
        email: 'invalid-email',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      });

      await authPage.verifyFieldError('email', 'Please enter a valid email address');

      // Clear form and test password mismatch
      await authPage.clearForm();
      await authPage.attemptInvalidRegistration({
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!',
        confirmPassword: 'DifferentPassword123!'
      });

      await authPage.verifyFieldError('confirmPassword', 'Passwords do not match');

      // Test weak password
      await authPage.clearForm();
      await authPage.attemptInvalidRegistration({
        username: 'testuser',
        email: 'test@example.com',
        password: '123',
        confirmPassword: '123'
      });

      await authPage.verifyFieldError('password', 'Password must be at least 8 characters');
    });

    test('should prevent registration with existing email', async ({ page }) => {
      await authPage.navigateToRegister();

      // Try to register with existing email
      await authPage.attemptInvalidRegistration({
        username: 'newuser',
        email: 'testuser1@example.com', // From global setup
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      });

      await authPage.verifyRegistrationError('Email already exists');
    });

    test('should validate password strength requirements', async ({ page }) => {
      await authPage.navigateToRegister();

      // Fill form partially to trigger password validation
      await authPage.fillInput('[data-testid="username-input"]', 'testuser');
      await authPage.fillInput('[data-testid="email-input"]', 'test@example.com');
      
      // Test weak password
      await authPage.fillInput('[data-testid="password-input"]', 'weak');
      await authPage.checkPasswordStrength('weak');

      // Test medium password
      await authPage.fillInput('[data-testid="password-input"]', 'MediumPass123');
      await authPage.checkPasswordStrength('medium');

      // Test strong password
      await authPage.fillInput('[data-testid="password-input"]', 'StrongPassword123!@#');
      await authPage.checkPasswordStrength('strong');
      await authPage.verifyPasswordRequirements();
    });
  });

  test.describe('User Login', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      await authPage.navigateToLogin();

      // Login with test user from global setup
      await authPage.login({
        email: 'testuser1@example.com',
        password: 'TestPassword123!'
      });

      // Verify successful login
      await authPage.waitForLoginSuccess();
      await chatPage.waitForChatToLoad();
      
      // Verify user is logged in
      const isLoggedIn = await authPage.isLoggedIn();
      expect(isLoggedIn).toBe(true);

      // Verify user info is displayed
      const currentUser = await authPage.getCurrentUser();
      expect(currentUser).toBeTruthy();
      expect(currentUser?.username).toBe('testuser1');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await authPage.navigateToLogin();

      // Try login with invalid credentials
      await authPage.attemptInvalidLogin('invalid@example.com', 'wrongpassword');
      await authPage.verifyLoginError('Invalid credentials');

      // Try login with valid email but wrong password
      await authPage.clearForm();
      await authPage.attemptInvalidLogin('testuser1@example.com', 'wrongpassword');
      await authPage.verifyLoginError('Invalid credentials');
    });

    test('should validate required fields', async ({ page }) => {
      await authPage.navigateToLogin();

      // Verify form validation
      await authPage.verifyFormValidation();

      // Try to submit empty form
      await authPage.clickElement('[data-testid="login-button"]');
      await authPage.verifyFieldError('email', 'Email is required');
      await authPage.verifyFieldError('password', 'Password is required');
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and fail the login request
      await page.route('**/auth/login', route => {
        route.abort('failed');
      });

      await authPage.navigateToLogin();
      await authPage.attemptInvalidLogin('testuser1@example.com', 'TestPassword123!');
      
      await authPage.verifyLoginError('Network error. Please try again.');
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async ({ page }) => {
      // Login first
      await authPage.navigateToLogin();
      await authPage.login({
        email: 'testuser1@example.com',
        password: 'TestPassword123!'
      });
      
      await authPage.waitForLoginSuccess();

      // Reload page
      await page.reload();
      
      // Verify still logged in
      const isLoggedIn = await authPage.isLoggedIn();
      expect(isLoggedIn).toBe(true);
    });

    test('should successfully logout', async ({ page }) => {
      // Login first
      await authPage.navigateToLogin();
      await authPage.login({
        email: 'testuser1@example.com',
        password: 'TestPassword123!'
      });
      
      await authPage.waitForLoginSuccess();

      // Logout
      await authPage.logout();
      await authPage.waitForLogoutSuccess();

      // Verify logged out
      const isLoggedIn = await authPage.isLoggedIn();
      expect(isLoggedIn).toBe(false);

      // Verify auth token is cleared
      const token = await authPage.getAuthToken();
      expect(token).toBeNull();
    });

    test('should redirect to login when accessing protected routes without authentication', async ({ page }) => {
      // Clear any existing auth data
      await authPage.clearAuthData();

      // Try to access chat page without login
      await page.goto('/');

      // Should be redirected to login
      await authPage.waitForLoginFormVisible();
      await authPage.expectUrl('/auth/login');
    });

    test('should handle expired tokens', async ({ page }) => {
      // Login first
      await authPage.navigateToLogin();
      await authPage.login({
        email: 'testuser1@example.com',
        password: 'TestPassword123!'
      });
      
      await authPage.waitForLoginSuccess();

      // Simulate expired token by modifying localStorage
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'expired.jwt.token');
      });

      // Try to access a protected resource
      await page.goto('/');

      // Should be redirected to login due to expired token
      await authPage.waitForLoginFormVisible();
    });
  });

  test.describe('Form Navigation', () => {
    test('should switch between login and register forms', async ({ page }) => {
      // Start at login page
      await authPage.navigateToLogin();
      await authPage.waitForLoginFormVisible();

      // Switch to register
      await authPage.switchToRegister();
      await authPage.waitForRegisterFormVisible();

      // Switch back to login
      await authPage.switchToLogin();
      await authPage.waitForLoginFormVisible();
    });

    test('should maintain form data when switching tabs', async ({ page }) => {
      await authPage.navigateToLogin();

      // Fill login form
      await authPage.fillInput('[data-testid="login-email-input"]', 'test@example.com');
      await authPage.fillInput('[data-testid="login-password-input"]', 'password');

      // Switch to register and back
      await authPage.switchToRegister();
      await authPage.switchToLogin();

      // Verify form data is preserved
      const email = await page.locator('[data-testid="login-email-input"]').inputValue();
      expect(email).toBe('test@example.com');
    });
  });

  test.describe('JWT Token Handling', () => {
    test('should store JWT token after successful login', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.login({
        email: 'testuser1@example.com',
        password: 'TestPassword123!'
      });
      
      await authPage.waitForLoginSuccess();

      // Verify token is stored
      const token = await authPage.getAuthToken();
      expect(token).toBeTruthy();
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+$/); // JWT format
    });

    test('should include JWT token in WebSocket authentication', async ({ page }) => {
      // Login first
      await authPage.navigateToLogin();
      await authPage.login({
        email: 'testuser1@example.com',
        password: 'TestPassword123!'
      });
      
      await authPage.waitForLoginSuccess();
      await chatPage.waitForChatToLoad();

      // Verify WebSocket connection is authenticated
      await chatPage.waitForWebSocketConnection();
      
      // Try to send a message (requires authentication)
      await chatPage.sendMessage({ content: 'Test authenticated message' });
      await chatPage.waitForMessageSent('Test authenticated message');
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await authPage.navigateToLogin();

      // Navigate through form using tab
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-email-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-password-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await authPage.navigateToLogin();

      // Check form has proper ARIA attributes
      const form = page.locator('[data-testid="login-form"]');
      await expect(form).toHaveAttribute('role', 'form');

      // Check inputs have proper labels
      const emailInput = page.locator('[data-testid="login-email-input"]');
      await expect(emailInput).toHaveAttribute('aria-label');
      
      const passwordInput = page.locator('[data-testid="login-password-input"]');
      await expect(passwordInput).toHaveAttribute('aria-label');
    });
  });
});
