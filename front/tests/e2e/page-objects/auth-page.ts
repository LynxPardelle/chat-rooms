import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { UserRegistrationData, UserLoginData } from '../utils/auth-helper';

/**
 * Authentication Page Object Model
 * Handles login, registration, and authentication flows
 */
export class AuthPage extends BasePage {
  
  // Authentication-specific selectors
  private readonly authSelectors = {
    // Login form
    loginForm: '[data-testid="login-form"]',
    loginEmailInput: '[data-testid="login-email-input"]',
    loginPasswordInput: '[data-testid="login-password-input"]',
    loginButton: '[data-testid="login-button"]',
    loginError: '[data-testid="login-error"]',
    
    // Registration form
    registerForm: '[data-testid="register-form"]',
    usernameInput: '[data-testid="username-input"]',
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    confirmPasswordInput: '[data-testid="confirm-password-input"]',
    registerButton: '[data-testid="register-button"]',
    registerError: '[data-testid="register-error"]',
    
    // Navigation
    loginLink: '[data-testid="login-link"]',
    registerLink: '[data-testid="register-link"]',
    forgotPasswordLink: '[data-testid="forgot-password-link"]',
    
    // User session
    userMenu: '[data-testid="user-menu"]',
    userProfile: '[data-testid="user-profile"]',
    logoutButton: '[data-testid="logout-button"]',
    userAvatar: '[data-testid="user-avatar"]',
    welcomeMessage: '[data-testid="welcome-message"]',
    
    // Password validation
    passwordStrength: '[data-testid="password-strength"]',
    passwordRequirements: '[data-testid="password-requirements"]',
    
    // Form validation
    fieldError: '[data-testid="field-error"]',
    successMessage: '[data-testid="auth-success-message"]',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin(): Promise<void> {
    await this.navigateTo('/auth/login');
    await this.waitForLoginFormVisible();
  }

  /**
   * Navigate to registration page
   */
  async navigateToRegister(): Promise<void> {
    await this.navigateTo('/auth/register');
    await this.waitForRegisterFormVisible();
  }

  /**
   * Wait for login form to be visible
   */
  async waitForLoginFormVisible(): Promise<void> {
    await this.page.waitForSelector(this.authSelectors.loginForm, { state: 'visible' });
  }

  /**
   * Wait for register form to be visible
   */
  async waitForRegisterFormVisible(): Promise<void> {
    await this.page.waitForSelector(this.authSelectors.registerForm, { state: 'visible' });
  }

  /**
   * Perform user login
   */
  async login(credentials: UserLoginData): Promise<void> {
    await this.fillInput(this.authSelectors.loginEmailInput, credentials.email);
    await this.fillInput(this.authSelectors.loginPasswordInput, credentials.password);
    await this.clickElement(this.authSelectors.loginButton);
    
    // Wait for login to complete
    await this.waitForLoginSuccess();
  }

  /**
   * Perform user registration
   */
  async register(userData: UserRegistrationData): Promise<void> {
    await this.fillInput(this.authSelectors.usernameInput, userData.username);
    await this.fillInput(this.authSelectors.emailInput, userData.email);
    await this.fillInput(this.authSelectors.passwordInput, userData.password);
    await this.fillInput(this.authSelectors.confirmPasswordInput, userData.confirmPassword);
    await this.clickElement(this.authSelectors.registerButton);
    
    // Wait for registration to complete
    await this.waitForRegistrationSuccess();
  }

  /**
   * Wait for successful login
   */
  async waitForLoginSuccess(): Promise<void> {
    // Wait for either redirect to chat or user menu to appear
    await Promise.race([
      this.page.waitForURL('**/chat', { timeout: 10000 }),
      this.page.waitForSelector(this.authSelectors.userMenu, { state: 'visible', timeout: 10000 })
    ]);
  }

  /**
   * Wait for successful registration
   */
  async waitForRegistrationSuccess(): Promise<void> {
    // Wait for success message or automatic login
    try {
      await this.waitForSuccessToast();
    } catch {
      // If no toast, check if auto-logged in
      await this.waitForLoginSuccess();
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    // Click user menu first
    await this.clickElement(this.authSelectors.userMenu);
    
    // Click logout button
    await this.clickElement(this.authSelectors.logoutButton);
    
    // Wait for logout to complete
    await this.waitForLogoutSuccess();
  }

  /**
   * Wait for successful logout
   */
  async waitForLogoutSuccess(): Promise<void> {
    // Wait for redirect to login page or login form to appear
    await Promise.race([
      this.page.waitForURL('**/auth/login', { timeout: 10000 }),
      this.page.waitForSelector(this.authSelectors.loginForm, { state: 'visible', timeout: 10000 })
    ]);
  }

  /**
   * Switch from login to register form
   */
  async switchToRegister(): Promise<void> {
    await this.clickElement(this.authSelectors.registerLink);
    await this.waitForRegisterFormVisible();
  }

  /**
   * Switch from register to login form
   */
  async switchToLogin(): Promise<void> {
    await this.clickElement(this.authSelectors.loginLink);
    await this.waitForLoginFormVisible();
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForSelector(this.authSelectors.userMenu, { state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{username: string, email?: string} | null> {
    if (!(await this.isLoggedIn())) {
      return null;
    }

    try {
      // Open user menu to get user info
      await this.clickElement(this.authSelectors.userMenu);
      
      const userProfile = this.page.locator(this.authSelectors.userProfile);
      await userProfile.waitFor({ state: 'visible' });
      
      const userText = await userProfile.textContent();
      const username = userText?.trim() || 'Unknown';
      
      // Close menu
      await this.page.keyboard.press('Escape');
      
      return { username };
    } catch {
      return null;
    }
  }

  /**
   * Verify login error message
   */
  async verifyLoginError(expectedMessage?: string): Promise<void> {
    const errorElement = this.page.locator(this.authSelectors.loginError);
    await errorElement.waitFor({ state: 'visible', timeout: 5000 });
    
    if (expectedMessage) {
      await expect(errorElement).toContainText(expectedMessage);
    }
  }

  /**
   * Verify registration error message
   */
  async verifyRegistrationError(expectedMessage?: string): Promise<void> {
    const errorElement = this.page.locator(this.authSelectors.registerError);
    await errorElement.waitFor({ state: 'visible', timeout: 5000 });
    
    if (expectedMessage) {
      await expect(errorElement).toContainText(expectedMessage);
    }
  }

  /**
   * Verify field validation error
   */
  async verifyFieldError(fieldName: string, expectedMessage?: string): Promise<void> {
    const fieldError = this.page.locator(`[data-field="${fieldName}"] ${this.authSelectors.fieldError}`);
    await fieldError.waitFor({ state: 'visible', timeout: 5000 });
    
    if (expectedMessage) {
      await expect(fieldError).toContainText(expectedMessage);
    }
  }

  /**
   * Check password strength indicator
   */
  async checkPasswordStrength(expectedStrength: 'weak' | 'medium' | 'strong'): Promise<void> {
    const strengthElement = this.page.locator(this.authSelectors.passwordStrength);
    await expect(strengthElement).toContainText(expectedStrength, { ignoreCase: true });
  }

  /**
   * Verify password requirements are met
   */
  async verifyPasswordRequirements(): Promise<void> {
    const requirements = this.page.locator(this.authSelectors.passwordRequirements);
    await expect(requirements).toBeVisible();
    
    // Check that all requirements are marked as met
    const metRequirements = requirements.locator('.requirement-met');
    const totalRequirements = await requirements.locator('.requirement').count();
    const metCount = await metRequirements.count();
    
    expect(metCount).toBe(totalRequirements);
  }

  /**
   * Test login with invalid credentials
   */
  async attemptInvalidLogin(email: string, password: string): Promise<void> {
    await this.fillInput(this.authSelectors.loginEmailInput, email);
    await this.fillInput(this.authSelectors.loginPasswordInput, password);
    await this.clickElement(this.authSelectors.loginButton);
    
    // Wait for error to appear
    await this.verifyLoginError();
  }

  /**
   * Test registration with invalid data
   */
  async attemptInvalidRegistration(userData: Partial<UserRegistrationData>): Promise<void> {
    if (userData.username) {
      await this.fillInput(this.authSelectors.usernameInput, userData.username);
    }
    if (userData.email) {
      await this.fillInput(this.authSelectors.emailInput, userData.email);
    }
    if (userData.password) {
      await this.fillInput(this.authSelectors.passwordInput, userData.password);
    }
    if (userData.confirmPassword) {
      await this.fillInput(this.authSelectors.confirmPasswordInput, userData.confirmPassword);
    }
    
    await this.clickElement(this.authSelectors.registerButton);
    
    // Wait for error to appear
    await this.verifyRegistrationError();
  }

  /**
   * Clear all form fields
   */
  async clearForm(): Promise<void> {
    const inputs = [
      this.authSelectors.usernameInput,
      this.authSelectors.emailInput,
      this.authSelectors.passwordInput,
      this.authSelectors.confirmPasswordInput,
      this.authSelectors.loginEmailInput,
      this.authSelectors.loginPasswordInput
    ];

    for (const input of inputs) {
      try {
        const element = this.page.locator(input);
        if (await element.isVisible()) {
          await element.clear();
        }
      } catch {
        // Ignore if element doesn't exist
      }
    }
  }

  /**
   * Get stored authentication token
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    });
  }

  /**
   * Clear stored authentication
   */
  async clearAuthData(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userData');
      sessionStorage.clear();
    });
  }

  /**
   * Check if forms have proper validation
   */
  async verifyFormValidation(): Promise<void> {
    // Check that login button is disabled with empty fields
    const loginButton = this.page.locator(this.authSelectors.loginButton);
    if (await loginButton.isVisible()) {
      await expect(loginButton).toBeDisabled();
    }

    // Check that register button is disabled with empty fields
    const registerButton = this.page.locator(this.authSelectors.registerButton);
    if (await registerButton.isVisible()) {
      await expect(registerButton).toBeDisabled();
    }
  }
}
