import path from "node:path";
import { test as baseTest, expect } from "@playwright/test";
import { environment } from "../config/environment";
import { SessionManager } from "../auth/session-manager";
import { LoginPage } from "../pages/login.page";
import { ShopPage } from "../pages/shop.page";

const sessionManager = new SessionManager(
  path.resolve(__dirname, "../auth/.auth"),
);

baseTest("prepare a valid authenticated storage state", async ({
  browser,
  page,
}) => {
  if (!process.env.CI && sessionManager.hasFreshState(environment.authStateTtlHours)) {
    const cachedContext = await browser.newContext({
      storageState: sessionManager.storageStatePath,
    });
    const cachedPage = await cachedContext.newPage();
    const shopPage = new ShopPage(cachedPage);
    await shopPage.open();
    const isAuthenticated = await shopPage.isAuthenticated();
    await cachedContext.close();

    if (isAuthenticated) {
      return;
    }
  }

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.login({
    email: environment.testUserEmail,
    password: environment.testUserPassword,
  });

  const shopPage = new ShopPage(page);
  await expect(page).toHaveURL(/\/shop\.php$/);
  await expect.poll(() => shopPage.isAuthenticated()).toBe(true);
  sessionManager.ensureAuthDirectory();
  await page.context().storageState({
    path: sessionManager.storageStatePath,
  });
  sessionManager.saveMetadata();
});
