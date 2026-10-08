import { expect, test } from "../../fixtures/app.fixture";

test("adds a product to the cart and removes it @smoke @regression", async ({
  electronicsPage,
  cartPage,
}) => {
  try {
    await electronicsPage.open();

    const productName = await electronicsPage.getFirstProductName();
    await electronicsPage.addFirstProductToCart();
    await electronicsPage.waitForCartCount(1);

    await cartPage.open();
    expect(await cartPage.firstItemIsNamed(productName)).toBe(true);

    await cartPage.removeAllItems();
    expect(await cartPage.isEmpty()).toBe(true);
  } finally {
    await cartPage.open();
    await cartPage.removeAllItems();
  }
});
