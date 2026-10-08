import { expect, test } from "../../fixtures/app.fixture";

test("authenticated session opens the shop @smoke", async ({ shopPage }) => {
  await shopPage.open();
  expect(await shopPage.isAuthenticated()).toBe(true);
});
