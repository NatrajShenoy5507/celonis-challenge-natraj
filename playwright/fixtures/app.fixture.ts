import path from "node:path";
import { test as base } from "@playwright/test";
import { PlaywrightApiClient } from "../api/playwright-api.client";
import { CartPage } from "../pages/cart.page";
import { ElectronicsPage } from "../pages/electronics.page";
import { LoginPage } from "../pages/login.page";
import { ShopPage } from "../pages/shop.page";
import type { ApiClient } from "../core/interfaces/api-client.interface";
import type { FrameworkCheckData } from "../core/types/framework-check.types";
import { createTestDataProvider } from "../data/factory/test-data-provider.factory";

type AppFixtures = {
  apiClient: ApiClient;
  cartPage: CartPage;
  electronicsPage: ElectronicsPage;
  loginPage: LoginPage;
  shopPage: ShopPage;
  testData: FrameworkCheckData;
};

export const test = base.extend<AppFixtures>({
  apiClient: async ({ request }, use) => {
    await use(new PlaywrightApiClient(request));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  electronicsPage: async ({ page }, use) => {
    await use(new ElectronicsPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  shopPage: async ({ page }, use) => {
    await use(new ShopPage(page));
  },
  testData: async ({}, use) => {
    const dataPath = path.resolve(
      __dirname,
      "../data/valid/framework-check.json",
    );
    const provider = createTestDataProvider<FrameworkCheckData>(dataPath);
    await use(provider.getData());
  },
});

export { expect } from "@playwright/test";
