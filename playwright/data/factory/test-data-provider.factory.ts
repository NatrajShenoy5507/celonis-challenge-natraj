import type { TestDataProvider } from "../../core/interfaces/test-data-provider.interface";
import { JsonDataProvider } from "../providers/json-data.provider";

export function createTestDataProvider<T>(
  filePath: string,
): TestDataProvider<T> {
  return new JsonDataProvider<T>(filePath);
}
