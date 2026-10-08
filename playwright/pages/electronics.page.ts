import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export type ProductType = "mobile" | "laptop" | "fridge" | "tv" | "monitor";

export class ElectronicsPage extends BasePage {
  readonly productCards: Locator;
  readonly productNames: Locator;
  readonly cartCount: Locator;
  private readonly laptopFilter: Locator;
  private readonly firstProductName: Locator;
  private readonly firstAddToCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.locator('[data-testid^="product-card-"]');
    this.productNames = page.locator('[data-testid^="product-name-"]');
    this.cartCount = page.getByTestId("header-cart-count");
    this.laptopFilter = page.getByTestId("filter-type-laptop");
    this.firstProductName = this.productCards
      .first()
      .locator('[data-testid^="product-name-"]');
    this.firstAddToCartButton = this.productCards
      .first()
      .locator('[data-testid^="add-to-cart-"]');
  }

  async open(): Promise<void> {
    await this.goto("/electronics.php");
  }

  async filterByType(type: ProductType): Promise<void> {
    if (type !== "laptop") {
      throw new Error(`Unsupported product filter "${type}".`);
    }
    await this.laptopFilter.check({ force: true });
  }

  async getFirstProductName(): Promise<string> {
    return (await this.firstProductName.innerText()).trim();
  }

  async addFirstProductToCart(): Promise<void> {
    await this.firstAddToCartButton.click();
  }

  async waitForCartCount(count: number): Promise<void> {
    await expect(this.cartCount).toHaveText(String(count));
  }

  async allProductNamesContain(type: ProductType): Promise<boolean> {
    const names = await this.productNames.allTextContents();
    return names.length > 0 && names.every((name) => name.toLowerCase().includes(type));
  }

  async isLoaded(): Promise<boolean> {
    return (await this.page.title()).includes("Electronics");
  }
}
