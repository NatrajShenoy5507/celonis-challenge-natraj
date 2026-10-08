import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";

export class CartPage extends BasePage {
  readonly rows: Locator;
  private readonly removeButtons: Locator;
  private readonly firstRowName: Locator;

  constructor(page: Page) {
    super(page);
    this.rows = page.locator('[data-testid^="cart-row-"]');
    this.removeButtons = page.locator('[data-testid^="cart-remove-"]');
    this.firstRowName = page.locator('[data-testid^="cart-item-name-"]').first();
  }

  async open(): Promise<void> {
    await this.goto("/cart.php");
  }

  async removeAllItems(): Promise<void> {
    while ((await this.removeButtons.count()) > 0) {
      const previousCount = await this.removeButtons.count();
      await this.removeButtons.first().click();
      await expect(this.removeButtons).toHaveCount(previousCount - 1);
    }
  }

  async firstItemIsNamed(expectedName: string): Promise<boolean> {
    return (await this.firstRowName.innerText()).trim() === expectedName;
  }

  async isEmpty(): Promise<boolean> {
    return (await this.rows.count()) === 0;
  }
}
