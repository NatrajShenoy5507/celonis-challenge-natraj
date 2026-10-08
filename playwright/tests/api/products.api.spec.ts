import { expect, test } from "@playwright/test";
import { PlaywrightApiClient } from "../../api/playwright-api.client";
import type { ApiClient } from "../../core/interfaces/api-client.interface";
import { environment } from "../../config/environment";

interface ProductSummary {
  id: number;
  name: string;
  price: number;
  currency: string;
}

function isProductSummary(value: unknown): value is ProductSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    "name" in value &&
    typeof value.name === "string" &&
    "price" in value &&
    typeof value.price === "number" &&
    "currency" in value &&
    typeof value.currency === "string"
  );
}

test("GET products returns a valid product collection @api @smoke", async ({
  request,
}) => {
  const apiClient: ApiClient = new PlaywrightApiClient(request);
  const response = await apiClient.request(
    "GET",
    `${environment.apiBaseURL}/products`,
  );

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");

  const body: unknown = await response.json();
  const products =
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    Array.isArray(body.data)
      ? body.data
      : null;

  expect(products).not.toBeNull();
  if (products === null) {
    throw new Error("The products endpoint response must contain a data array.");
  }

  expect(products.length).toBeGreaterThan(0);
  expect(products.every(isProductSummary)).toBe(true);
});
