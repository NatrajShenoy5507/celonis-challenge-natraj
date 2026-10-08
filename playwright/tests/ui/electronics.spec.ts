import { test, expect } from "../../fixtures/app.fixture";

test("filters electronics by laptop type @smoke @regression", async ({
  electronicsPage,
}) => {
  await electronicsPage.open();
  await electronicsPage.filterByType("laptop");

  expect(await electronicsPage.isLoaded()).toBe(true);
  expect(await electronicsPage.allProductNamesContain("laptop")).toBe(true);
});
