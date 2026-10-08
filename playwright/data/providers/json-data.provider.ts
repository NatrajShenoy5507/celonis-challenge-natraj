import { readFileSync } from "node:fs";
import type { TestDataProvider } from "../../core/interfaces/test-data-provider.interface";

export class JsonDataProvider<T> implements TestDataProvider<T> {
  constructor(private readonly filePath: string) {}

  getData(): T {
    return JSON.parse(readFileSync(this.filePath, "utf8")) as T;
  }
}
