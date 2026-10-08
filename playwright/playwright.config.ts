import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { environment } from "./config/environment";
import path from "node:path";

const isCI = Boolean(process.env.CI);
const storageStatePath = path.resolve(__dirname, "auth/.auth/user.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [["html", { open: "never" }], ["allure-playwright"]]
    : [["html", { open: "never" }]],
  use: {
    baseURL: environment.baseURL || undefined,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: isCI ? "retain-on-failure" : "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/*.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: ["tests/ui/**/*.spec.ts", "tests/framework/**/*.spec.ts"],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageStatePath,
      },
    },
    {
      name: "api",
      testMatch: "tests/api/**/*.spec.ts",
    },
  ],
});
