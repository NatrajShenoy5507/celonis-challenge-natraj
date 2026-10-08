import { expect, test } from "../../fixtures/app.fixture";

test("loads typed JSON through the test-data fixture", async ({ testData }) => {
  expect(testData.message).toBe("Playwright test-data provider is ready");
});
