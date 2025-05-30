import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model
 * Provides common functionality for all page objects
 */
export class BasePage {
  protected page: Page;
  protected readonly baseUrl: string;

  // Common selectors
  protected readonly selectors = {
    loader: '[data-testid="loader"]',
    errorToast: '[data-testid="error-toast"]',
    successToast: '[data-testid="success-toast"]',
    modal: '[data-testid="modal"]',
    confirmButton: '[data-testid="confirm-button"]',
    cancelButton: '[data-testid="cancel-button"]',
    closeButton: '[data-testid="close-button"]',
  };

  constructor(page: Page) {
    this.page = page;
    this.baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8080';
  }

  /**
   * Navigate to a specific path
   */
  async navigateTo(path: string = ''): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to finish loading
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any loaders to disappear
    const loader = this.page.locator(this.selectors.loader);
    if (await loader.isVisible()) {
      await loader.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Get current page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      await element.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for and click an element
   */
  async clickElement(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await element.click();
  }

  /**
   * Fill input field
   */
  async fillInput(selector: string, value: string): Promise<void> {
    const input = this.page.locator(selector);
    await input.waitFor({ state: 'visible' });
    await input.fill(value);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    const select = this.page.locator(selector);
    await select.waitFor({ state: 'visible' });
    await select.selectOption(value);
  }

  /**
   * Wait for success toast message
   */
  async waitForSuccessToast(expectedMessage?: string): Promise<void> {
    const toast = this.page.locator(this.selectors.successToast);
    await toast.waitFor({ state: 'visible' });
    
    if (expectedMessage) {
      await expect(toast).toContainText(expectedMessage);
    }
  }

  /**
   * Wait for error toast message
   */
  async waitForErrorToast(expectedMessage?: string): Promise<void> {
    const toast = this.page.locator(this.selectors.errorToast);
    await toast.waitFor({ state: 'visible' });
    
    if (expectedMessage) {
      await expect(toast).toContainText(expectedMessage);
    }
  }

  /**
   * Close modal if open
   */
  async closeModal(): Promise<void> {
    const modal = this.page.locator(this.selectors.modal);
    if (await modal.isVisible()) {
      const closeButton = this.page.locator(this.selectors.closeButton);
      await closeButton.click();
      await modal.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Wait for specific text to appear
   */
  async waitForText(text: string, timeout: number = 5000): Promise<void> {
    await this.page.waitForFunction(
      (searchText) => document.body.innerText.includes(searchText),
      text,
      { timeout }
    );
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * Get element text content
   */
  async getTextContent(selector: string): Promise<string> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    return await element.textContent() || '';
  }

  /**
   * Get element count
   */
  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.scrollIntoViewIfNeeded();
  }

  /**
   * Wait for network requests to complete
   */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if current URL matches expected path
   */
  async expectUrl(expectedPath: string): Promise<void> {
    const currentUrl = this.page.url();
    expect(currentUrl).toContain(expectedPath);
  }

  /**
   * Refresh the page
   */
  async refresh(): Promise<void> {
    await this.page.reload();
    await this.waitForPageLoad();
  }

  /**
   * Execute JavaScript in the browser
   */
  async executeScript(script: string, ...args: any[]): Promise<any> {
    return await this.page.evaluate(script, ...args);
  }

  /**
   * Wait for element to be enabled
   */
  async waitForElementEnabled(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await expect(element).toBeEnabled();
  }

  /**
   * Wait for element to be disabled
   */
  async waitForElementDisabled(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await expect(element).toBeDisabled();
  }
}
