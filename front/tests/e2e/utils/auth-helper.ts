import { Page, Locator } from '@playwright/test';

export interface UserRegistrationData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UserLoginData {
  email: string;
  password: string;
}

/**
 * Authentication Helper for E2E Tests
 * Handles user registration, login, logout, and token management
 */
export class AuthHelper {
  private page: Page;

  // Selectors
  private readonly selectors = {
    // Registration form
    registerForm: '[data-testid="register-form"], form',
    usernameInput: '[data-testid="username-input"], #username',
    emailInput: '[data-testid="email-input"], #email',
    passwordInput: '[data-testid="password-input"], #password',
    confirmPasswordInput: '[data-testid="confirm-password-input"], #confirmPassword',
    registerButton: '[data-testid="register-button"], button[type="submit"]',
    
    // Login form
    loginForm: '[data-testid="login-form"], form',
    loginEmailInput: '[data-testid="login-email-input"], #email',
    loginPasswordInput: '[data-testid="login-password-input"], #password',
    loginButton: '[data-testid="login-button"], button[type="submit"]',
    
    // Navigation
    loginLink: '[data-testid="login-link"], a[href*="/login"]',
    registerLink: '[data-testid="register-link"], a[href*="/register"]',
    logoutButton: '[data-testid="logout-button"], button:has-text("Logout")',
    
    // User profile
    userMenu: '[data-testid="user-menu"]',
    userProfile: '[data-testid="user-profile"]',
    
    // Error messages
    errorMessage: '[data-testid="error-message"], .auth-form__error, .login-form__error',
    successMessage: '[data-testid="success-message"], .auth-form__success, .login-form__success',
    
    // Chat elements (to verify successful login)
    chatContainer: '[data-testid="chat-container"], .chat-container',
    messageInput: '[data-testid="message-input"], input[placeholder*="message"]'
  };

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Register a new user
   */
  async register(userData: UserRegistrationData): Promise<void> {
    // Navigate to registration if not already there
    try {
      await this.page.locator(this.selectors.registerLink).click();
    } catch {
      // Might already be on register page or need direct navigation
      await this.page.goto('/auth/register');
    }

    // Wait for registration form to be visible
    await this.page.waitForSelector(this.selectors.registerForm, { timeout: 10000 });

    // Fill registration form
    await this.page.locator(this.selectors.usernameInput).fill(userData.username);
    await this.page.locator(this.selectors.emailInput).fill(userData.email);
    await this.page.locator(this.selectors.passwordInput).fill(userData.password);
    await this.page.locator(this.selectors.confirmPasswordInput).fill(userData.confirmPassword);

    // Submit registration
    await this.page.locator(this.selectors.registerButton).click();

    // Wait for success or redirect to chat
    await Promise.race([
      this.page.waitForSelector(this.selectors.chatContainer, { timeout: 15000 }),
      this.page.waitForSelector(this.selectors.successMessage, { timeout: 15000 }),
      this.page.waitForURL('**/auth/login**', { timeout: 15000 }) // Registration redirects to login
    ]);
  }

  /**
   * Login with existing user credentials
   */
  async login(userData: UserLoginData): Promise<void> {
    // Navigate to login if not already there
    try {
      await this.page.locator(this.selectors.loginLink).click();
    } catch {
      // Might already be on login page or need direct navigation
      await this.page.goto('/auth/login');
    }

    // Wait for login form to be visible
    await this.page.waitForSelector(this.selectors.loginForm, { timeout: 10000 });

    // Fill login form
    await this.page.locator(this.selectors.loginEmailInput).fill(userData.email);
    await this.page.locator(this.selectors.loginPasswordInput).fill(userData.password);

    // Submit login
    await this.page.locator(this.selectors.loginButton).click();

    // Wait for redirect to chat
    await this.page.waitForSelector(this.selectors.chatContainer, { timeout: 15000 });
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    // Open user menu if exists
    try {
      await this.page.locator(this.selectors.userMenu).click();
    } catch {
      // User menu might not exist in current design
    }

    // Click logout button
    await this.page.locator(this.selectors.logoutButton).click();

    // Wait for redirect to login/registration page
    await Promise.race([
      this.page.waitForSelector(this.selectors.loginForm, { timeout: 10000 }),
      this.page.waitForSelector(this.selectors.registerForm, { timeout: 10000 }),
      this.page.waitForURL('**/auth/**', { timeout: 10000 })
    ]);
  }

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForSelector(this.selectors.chatContainer, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current user's authentication token from localStorage
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('authToken') || localStorage.getItem('accessToken');
    });
  }

  /**
   * Set authentication token in localStorage
   */
  async setAuthToken(token: string): Promise<void> {
    await this.page.evaluate((token) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('accessToken', token);
    }, token);
  }

  /**
   * Clear all authentication data
   */
  async clearAuthData(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    });
  }

  /**
   * Wait for authentication error message
   */
  async waitForAuthError(): Promise<string> {
    const errorElement = await this.page.waitForSelector(this.selectors.errorMessage, { timeout: 10000 });
    return await errorElement.textContent() || '';
  }

  /**
   * Get username input locator
   */
  getUsernameInput(): Locator {
    return this.page.locator(this.selectors.usernameInput);
  }

  /**
   * Get email input locator
   */
  getEmailInput(): Locator {
    return this.page.locator(this.selectors.emailInput);
  }

  /**
   * Get password input locator
   */
  getPasswordInput(): Locator {
    return this.page.locator(this.selectors.passwordInput);
  }

  /**
   * Get login button locator
   */
  getLoginButton(): Locator {
    return this.page.locator(this.selectors.loginButton);
  }

  /**
   * Get register button locator
   */
  getRegisterButton(): Locator {
    return this.page.locator(this.selectors.registerButton);
  }

  /**
   * Navigate directly to registration page
   */
  async navigateToRegister(): Promise<void> {
    await this.page.goto('/auth/register');
    await this.page.waitForSelector(this.selectors.registerForm, { timeout: 10000 });
  }

  /**
   * Navigate directly to login page
   */
  async navigateToLogin(): Promise<void> {
    await this.page.goto('/auth/login');
    await this.page.waitForSelector(this.selectors.loginForm, { timeout: 10000 });
  }
}
