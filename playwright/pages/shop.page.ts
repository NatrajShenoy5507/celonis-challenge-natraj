import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ShopPage extends BasePage {
  private readonly logoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.logoutButton = page.getByTestId("header-logout-btn");
  }

  async open(): Promise<void> {
    await this.goto("/shop.php");
  }

  async isAuthenticated(): Promise<boolean> {
    return this.logoutButton.isVisible();
  }
}
