import "dotenv/config";
import type {
  EnvironmentConfig,
  EnvironmentName,
} from "../core/types/environment.types";

const environmentNames: EnvironmentName[] = ["demo", "qa", "staging"];
const configuredName = process.env.TEST_ENV || "demo";

function isEnvironmentName(value: string): value is EnvironmentName {
  return environmentNames.some((name) => name === value);
}

if (!isEnvironmentName(configuredName)) {
  throw new Error(
    `Unsupported TEST_ENV "${configuredName}". Choose demo, qa, or staging.`,
  );
}

const testUserEmail = (
  process.env.TEST_USER_EMAIL ||
  process.env.EMAIL ||
  ""
).trim();
const testUserPassword =
  process.env.TEST_USER_PASSWORD || process.env.PASSWORD;
if (!testUserEmail || !testUserPassword) {
  throw new Error(
    "Set TEST_USER_EMAIL and TEST_USER_PASSWORD in playwright/.env before running the browser tests. EMAIL and PASSWORD are also accepted for existing local configuration.",
  );
}

const authStateTtlHours = Number(process.env.AUTH_STATE_TTL_HOURS || "12");
if (!Number.isFinite(authStateTtlHours) || authStateTtlHours <= 0) {
  throw new Error("AUTH_STATE_TTL_HOURS must be a positive number.");
}

export const environment: EnvironmentConfig = {
  name: configuredName,
  baseURL: process.env.BASE_URL || "https://shop.qaautomationlabs.com",
  apiBaseURL:
    process.env.API_BASE_URL || "https://api.qaautomationlabs.com/v1",
  testUserEmail,
  testUserPassword,
  authStateTtlHours,
};
