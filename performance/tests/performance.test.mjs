import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/config.mjs";
import {
  compareSummaries,
  renderReport,
} from "../scripts/compare-results.mjs";

const performanceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mockPath = path.join(performanceDirectory, "mock", "server.mjs");

async function findAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function createSummary({
  label,
  host = "127.0.0.1:3000",
  workload = { vus: 1, iterations: 10 },
  p50 = 10,
  p95 = 20,
  p99 = 30,
  iterationRate = 2,
  failureRate = 0,
}) {
  return {
    formatVersion: 1,
    metadata: {
      profile: "baseline",
      label,
      targetHost: host,
      workload,
      executionStatus: "passed",
    },
    k6Summary: {
      metrics: {
        api_acceptance_latency: {
          values: { med: p50, "p(95)": p95, "p(99)": p99 },
          thresholds: { "p(95)<500": { ok: true } },
        },
        sync_requests: { values: { count: 10 } },
        iterations: { values: { rate: iterationRate } },
        sync_request_failures: {
          values: { rate: failureRate },
          thresholds: { "rate<0.01": { ok: true } },
        },
      },
    },
  };
}

test("configuration defaults to loopback and blocks remote targets", () => {
  const config = loadConfig({});
  assert.equal(config.targetUrl, "http://127.0.0.1:3000");
  assert.equal(config.isLocalTarget, true);
  assert.throws(
    () => loadConfig({ K6_TARGET_URL: "https://example.com" }),
    /Remote K6_TARGET_URL is blocked/,
  );
  assert.throws(
    () => loadConfig({ K6_TARGET_URL: "http://127.0.0.1:3000", K6_BASELINE_VUS: "-1" }),
    /K6_BASELINE_VUS must be a whole number/,
  );
  assert.throws(
    () => loadConfig({ K6_TARGET_URL: "http://127.0.0.1:3000", K6_RAMP_UP: "0s" }),
    /K6_RAMP_UP must be greater than zero/,
  );
  assert.throws(
    () => loadConfig({ K6_TARGET_URL: "http://user:secret@127.0.0.1:3000" }),
    /must not contain embedded credentials/,
  );
  const authorizedRemote = loadConfig({
    K6_TARGET_URL: "https://authorized.example",
    K6_ALLOW_REMOTE: "true",
  });
  assert.equal(authorizedRemote.isLocalTarget, false);
});

test("comparison calculates metrics and identifies incompatible workloads", () => {
  const pre = createSummary({ label: "pre" });
  const post = createSummary({
    label: "post",
    p50: 8,
    p95: 18,
    p99: 27,
    iterationRate: 2.5,
    failureRate: 0.01,
  });
  const matched = compareSummaries(pre, post);
  assert.equal(matched.comparable, true);
  assert.equal(matched.rows[0].change, "-2.00");
  assert.equal(matched.rows[4].change, "+0.50");
  assert.equal(matched.rows[5].post, "1.00");
  assert.equal(matched.preThresholds, "Passed");
  const report = renderReport("baseline", pre, post, matched);
  assert.match(report, /descriptive comparison/);
  assert.match(report, /p95 API acceptance latency/);
  assert.match(report, /HTTP 202 means accepted/);

  const changedWorkload = compareSummaries(
    pre,
    createSummary({ label: "post", workload: { vus: 2, iterations: 10 } }),
  );
  assert.equal(changedWorkload.comparable, false);
  assert.match(changedWorkload.issues.join(" "), /Workload settings differ/);

  const zeroBaseline = compareSummaries(
    createSummary({ label: "pre", p50: 0 }),
    createSummary({ label: "post", p50: 1 }),
  );
  assert.equal(zeroBaseline.rows[0].relative, "N/A (pre value is zero)");

  const failedExecution = createSummary({ label: "post" });
  failedExecution.metadata.executionStatus = "execution_error";
  assert.equal(compareSummaries(pre, failedExecution).comparable, false);
});

test("local mock validates requests and exposes asynchronous state and counters", async (t) => {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [mockPath], {
    cwd: performanceDirectory,
    env: {
      ...process.env,
      MOCK_PORT: String(port),
      MOCK_PROCESSING_DELAY_MS: "40",
      MOCK_MAX_ORDERS: "2",
      K6_TARGET_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  t.after(async () => {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
      } else {
        child.once("exit", resolve);
      }
    });
  });

  let health;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      assert.fail(`Mock exited early: ${serverOutput}`);
    }
    try {
      health = await fetch(`${baseUrl}/health`);
      break;
    } catch {
      await delay(25);
    }
  }
  assert.ok(health, `Mock did not start: ${serverOutput}`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "local-sync-mock");

  const order = {
    orderId: "TEST-ORDER-1",
    amount: 123.45,
    currency: "USD",
    customerName: "Morgan Example",
    status: "Confirmed",
  };
  const accepted = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  assert.equal(accepted.status, 202);
  assert.equal((await accepted.json()).status, "accepted");

  const negativeAmount = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...order, orderId: "TEST-NEGATIVE", amount: -1 }),
  });
  assert.equal(negativeAmount.status, 400);

  const malformed = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);

  const duplicate = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  assert.equal(duplicate.status, 409);

  let status;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    status = await fetch(`${baseUrl}/api/orders/TEST-ORDER-1/status`);
    if ((await status.clone().json()).status === "processed") {
      break;
    }
    await delay(10);
  }
  assert.equal((await status.json()).status, "processed");

  const secondAccepted = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...order, orderId: "TEST-ORDER-2" }),
  });
  assert.equal(secondAccepted.status, 202);
  const capacity = await fetch(`${baseUrl}/api/orders/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...order, orderId: "TEST-ORDER-3" }),
  });
  assert.equal(capacity.status, 503);

  const unknownStatus = await fetch(`${baseUrl}/api/orders/NO-SUCH-ORDER/status`);
  assert.equal(unknownStatus.status, 404);
  const metricsResponse = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsResponse.status, 200);
  const metrics = await metricsResponse.json();
  assert.equal(metrics.accepted, 2);
  assert.equal(metrics.rejected, 4);
  assert.equal(metrics.storedOrders, 2);
  assert.equal(metrics.maxOrders, 2);
  assert.equal(typeof metrics.pending, "number");
});

test("runner rejects remote and invalid config before checking k6 availability", () => {
  const runnerPath = path.join(performanceDirectory, "scripts", "run-k6.mjs");
  const remote = spawnSync(
    process.execPath,
    [runnerPath, "baseline", "pre"],
    {
      cwd: performanceDirectory,
      env: {
        ...process.env,
        K6_TARGET_URL: "https://example.com",
        K6_ALLOW_REMOTE: "false",
      },
      encoding: "utf8",
    },
  );
  assert.notEqual(remote.status, 0);
  assert.match(remote.stderr, /Remote K6_TARGET_URL is blocked/);

  const invalid = spawnSync(process.execPath, [runnerPath, "baseline", "pre"], {
    cwd: performanceDirectory,
    env: {
      ...process.env,
      K6_TARGET_URL: "http://127.0.0.1:3000",
      K6_BASELINE_VUS: "0",
    },
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /K6_BASELINE_VUS must be at least 1/);
});
