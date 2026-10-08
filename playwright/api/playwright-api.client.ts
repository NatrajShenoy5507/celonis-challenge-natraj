import type {
  APIRequestContext,
  APIResponse,
} from "@playwright/test";
import type { ApiClient } from "../core/interfaces/api-client.interface";

export class PlaywrightApiClient implements ApiClient {
  constructor(private readonly context: APIRequestContext) {}

  request(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    data?: string | object,
  ): Promise<APIResponse> {
    return this.context.fetch(path, { method, data });
  }
}
