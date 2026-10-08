import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const performanceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function loadEnvFile(envPath = path.join(performanceDirectory, ".env")) {
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const values = {};
  for (const [index, originalLine] of content.split(/\r?\n/).entries()) {
    const line = originalLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid .env syntax on line ${index + 1}.`);
    }

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[match[1]] = value;
  }

  return values;
}

function readInteger(values, key, fallback, { minimum = 0 } = {}) {
  const raw = values[key] ?? String(fallback);
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${key} must be a whole number.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${key} must be at least ${minimum}.`);
  }
  return value;
}

function readNumber(values, key, fallback, { minimum = 0, maximum = Infinity } = {}) {
  const raw = values[key] ?? String(fallback);
  if (raw.trim() === "") {
    throw new Error(`${key} must be a number.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(
      `${key} must be a finite number between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

function readDuration(values, key, fallback) {
  const raw = values[key] ?? fallback;
  if (!/^\d+(?:\.\d+)?(?:ms|s|m|h)$/.test(raw)) {
    throw new Error(`${key} must be a k6 duration such as 500ms, 20s, or 2m.`);
  }
  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  const scale = { ms: 0.001, s: 1, m: 60, h: 3600 }[match[2]];
  if (Number(match[1]) * scale <= 0) {
    throw new Error(`${key} must be greater than zero.`);
  }
  return raw;
}

export function loadConfig(values = { ...loadEnvFile(), ...process.env }) {
  const targetUrl = values.K6_TARGET_URL || "http://127.0.0.1:3000";
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    throw new Error("K6_TARGET_URL must be an absolute HTTP or HTTPS URL.");
  }
  if (!["http:", "https:"].includes(parsedTarget.protocol)) {
    throw new Error("K6_TARGET_URL must use HTTP or HTTPS.");
  }
  if (parsedTarget.username || parsedTarget.password) {
    throw new Error("K6_TARGET_URL must not contain embedded credentials.");
  }
  if (parsedTarget.pathname !== "/" || parsedTarget.search || parsedTarget.hash) {
    throw new Error("K6_TARGET_URL must be an origin without a path, query, or fragment.");
  }

  const allowRemote = (values.K6_ALLOW_REMOTE || "false").toLowerCase();
  if (!["true", "false"].includes(allowRemote)) {
    throw new Error("K6_ALLOW_REMOTE must be true or false.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const isLocal = localHosts.has(parsedTarget.hostname.toLowerCase());
  if (!isLocal && allowRemote !== "true") {
    throw new Error(
      "Remote K6_TARGET_URL is blocked. Set K6_ALLOW_REMOTE=true only for an explicitly authorized target.",
    );
  }

  const mockPort = readInteger(values, "MOCK_PORT", 3000, {
    minimum: 1,
  });
  if (mockPort > 65535) {
    throw new Error("MOCK_PORT must be between 1 and 65535.");
  }

  return {
    targetUrl: targetUrl.replace(/\/+$/, ""),
    targetHost: parsedTarget.host,
    targetHostname: parsedTarget.hostname,
    isLocalTarget: isLocal,
    allowRemote: allowRemote === "true",
    apiToken: values.K6_API_TOKEN || "",
    appBuildId: values.APP_BUILD_ID || "",
    baseline: {
      vus: readInteger(values, "K6_BASELINE_VUS", 1, { minimum: 1 }),
      iterations: readInteger(values, "K6_BASELINE_ITERATIONS", 30, {
        minimum: 1,
      }),
    },
    load: {
      startVus: readInteger(values, "K6_LOAD_START_VUS", 1, {
        minimum: 1,
      }),
      targetVus: readInteger(values, "K6_LOAD_TARGET_VUS", 10, {
        minimum: 1,
      }),
      rampUp: readDuration(values, "K6_RAMP_UP", "20s"),
      hold: readDuration(values, "K6_HOLD", "30s"),
      rampDown: readDuration(values, "K6_RAMP_DOWN", "10s"),
    },
    stress: {
      targetVus: readInteger(values, "K6_STRESS_TARGET_VUS", 20, {
        minimum: 1,
      }),
      rampUp: readDuration(values, "K6_STRESS_RAMP_UP", "20s"),
      hold: readDuration(values, "K6_STRESS_HOLD", "20s"),
      rampDown: readDuration(values, "K6_STRESS_RAMP_DOWN", "10s"),
    },
    soak: {
      vus: readInteger(values, "K6_SOAK_VUS", 5, { minimum: 1 }),
      duration: readDuration(values, "K6_SOAK_DURATION", "2m"),
    },
    thresholds: {
      acceptanceP95Ms: readNumber(values, "K6_ACCEPT_P95_MS", 500, {
        minimum: 0.001,
      }),
      errorRate: readNumber(values, "K6_ACCEPT_ERROR_RATE", 0.01, {
        minimum: 0,
        maximum: 1,
      }),
    },
    completion: {
      sampleRate: readNumber(values, "K6_COMPLETION_SAMPLE_RATE", 0, {
        minimum: 0,
        maximum: 1,
      }),
      pollIntervalMs: readInteger(
        values,
        "K6_COMPLETION_POLL_INTERVAL_MS",
        50,
        { minimum: 1 },
      ),
      maxPolls: readInteger(values, "K6_COMPLETION_MAX_POLLS", 4, {
        minimum: 1,
      }),
    },
    mock: {
      port: mockPort,
      processingDelayMs: readInteger(
        values,
        "MOCK_PROCESSING_DELAY_MS",
        100,
      ),
      maxOrders: readInteger(values, "MOCK_MAX_ORDERS", 10000, {
        minimum: 1,
      }),
    },
  };
}
