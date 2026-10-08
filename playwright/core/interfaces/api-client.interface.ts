import type { APIResponse } from "@playwright/test";

export interface ApiClient {
  request(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    data?: string | object,
  ): Promise<APIResponse>;
}
