import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  loadConfig,
  loadEnvFile,
  performanceDirectory,
} from "../config/config.mjs";

const [profile, label, ...extraArgs] = process.argv.slice(2);
const validProfiles = new Set(["baseline", "load", "stress", "soak"]);
if (
  !validProfiles.has(profile) ||
  !["pre", "post"].includes(label) ||
  extraArgs.length > 0
) {
  console.error(
    "Usage: node scripts/run-k6.mjs <baseline|load|stress|soak> <pre|post>",
  );
  process.exit(2);
}

try {
  const fileEnv = loadEnvFile();
  const values = { ...fileEnv, ...process.env };
  const config = loadConfig(values);
  const version = spawnSync("k6", ["version"], {
    cwd: performanceDirectory,
    encoding: "utf8",
    windowsHide: true,
  });
  if (version.error?.code === "ENOENT") {
    throw new Error(
      "k6 CLI was not found. Install k6 separately, verify with `k6 version`, then retry.",
    );
  }
  if (version.status !== 0) {
    throw new Error(
      `Unable to verify k6 CLI version: ${(version.stderr || version.stdout || "").trim()}`,
    );
  }
  console.log((version.stdout || version.stderr).trim());

  const resultsDirectory = path.join(performanceDirectory, "results");
  mkdirSync(resultsDirectory, { recursive: true });
  const summaryPath = path.join(resultsDirectory, `${profile}-${label}.json`);
  const now = new Date().toISOString();
  rmSync(summaryPath, { force: true });
  const settings = {
    targetHost: config.targetHost,
    targetProtocol: new URL(config.targetUrl).protocol,
    thresholds: config.thresholds,
  };
  if (profile === "baseline") {
    Object.assign(settings, config.baseline);
  } else if (profile === "load") {
    Object.assign(settings, config.load);
  } else if (profile === "stress") {
    Object.assign(settings, config.stress);
  } else {
    Object.assign(settings, config.soak);
  }

  const metadata = {
    profile,
    label,
    runAtUtc: now,
    targetHost: config.targetHost,
    workload: settings,
    ...(config.appBuildId ? { appBuildId: config.appBuildId } : {}),
  };
  const scriptPath = path.join(performanceDirectory, "tests", "sync-load.js");
  const scriptEnv = {
    K6_PROFILE: profile,
    K6_TARGET_URL: config.targetUrl,
    K6_ACCEPT_P95_MS: String(config.thresholds.acceptanceP95Ms),
    K6_ACCEPT_ERROR_RATE: String(config.thresholds.errorRate),
    K6_COMPLETION_SAMPLE_RATE: String(config.completion.sampleRate),
    K6_COMPLETION_POLL_INTERVAL_MS: String(config.completion.pollIntervalMs),
    K6_COMPLETION_MAX_POLLS: String(config.completion.maxPolls),
    K6_RUN_METADATA: JSON.stringify(metadata),
    K6_SUMMARY_PATH: summaryPath,
  };
  if (profile === "baseline") {
    scriptEnv.K6_BASELINE_VUS = String(config.baseline.vus);
    scriptEnv.K6_BASELINE_ITERATIONS = String(config.baseline.iterations);
  } else if (profile === "load") {
    scriptEnv.K6_LOAD_START_VUS = String(config.load.startVus);
    scriptEnv.K6_LOAD_TARGET_VUS = String(config.load.targetVus);
    scriptEnv.K6_RAMP_UP = config.load.rampUp;
    scriptEnv.K6_HOLD = config.load.hold;
    scriptEnv.K6_RAMP_DOWN = config.load.rampDown;
  } else if (profile === "stress") {
    scriptEnv.K6_STRESS_TARGET_VUS = String(config.stress.targetVus);
    scriptEnv.K6_STRESS_RAMP_UP = config.stress.rampUp;
    scriptEnv.K6_STRESS_HOLD = config.stress.hold;
    scriptEnv.K6_STRESS_RAMP_DOWN = config.stress.rampDown;
  } else {
    scriptEnv.K6_SOAK_VUS = String(config.soak.vus);
    scriptEnv.K6_SOAK_DURATION = config.soak.duration;
  }

  const args = ["run"];
  for (const [key, value] of Object.entries(scriptEnv)) {
    args.push("--env", `${key}=${value}`);
  }
  if (config.apiToken) {
    args.push("--env", `K6_API_TOKEN=${config.apiToken}`);
  }
  args.push(scriptPath);

  console.log(
    `Starting ${profile} ${label} against ${config.targetHost}; summary: ${path.relative(performanceDirectory, summaryPath)}`,
  );
  const result = spawnSync("k6", args, {
    cwd: path.join(performanceDirectory, "tests"),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Unable to start k6: ${result.error.message}`);
  }

  let savedSummary;
  try {
    savedSummary = JSON.parse(readFileSync(summaryPath, "utf8"));
  } catch {
    throw new Error(
      `k6 did not write a readable summary to ${path.relative(performanceDirectory, summaryPath)}.`,
    );
  }
  if (
    savedSummary.formatVersion !== 1 ||
    savedSummary.metadata?.profile !== profile ||
    savedSummary.metadata?.label !== label ||
    savedSummary.metadata?.runAtUtc !== now ||
    !savedSummary.k6Summary?.metrics
  ) {
    throw new Error("k6 summary did not match the expected exported summary format.");
  }

  const executionStatus =
    result.status === 0
      ? "passed"
      : result.status === 99
        ? "thresholds_failed"
        : "execution_error";
  savedSummary.metadata.executionStatus = executionStatus;
  savedSummary.metadata.k6ExitCode = result.status;
  writeFileSync(summaryPath, `${JSON.stringify(savedSummary, null, 2)}\n`);
  console.log(`k6 execution status: ${executionStatus}`);
  console.log(`Saved actual k6 summary: ${summaryPath}`);
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
  }
} catch (error) {
  console.error(`Performance run failed: ${error.message}`);
  process.exitCode = 1;
}
