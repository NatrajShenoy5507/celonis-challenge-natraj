import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export interface LoginCredentials {
  email: string;
  password: string;
}

export class LoginPage extends BasePage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByTestId("login-password-input");
    this.loginButton = page.getByTestId("login-submit-btn");
  }

  async open(): Promise<void> {
    await this.goto("/index.php");
  }

  async login(credentials: LoginCredentials): Promise<void> {
    await this.emailInput.fill(credentials.email);
    await this.passwordInput.fill(credentials.password);
    await this.loginButton.click();
  }
}
