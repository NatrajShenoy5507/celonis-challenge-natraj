import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  performanceDirectory,
} from "../config/config.mjs";

const profile = process.argv[2];
const allowedProfiles = new Set(["baseline", "load", "stress", "soak"]);

function readSummary(filePath, expectedProfile, expectedLabel) {
  const summary = JSON.parse(readFileSync(filePath, "utf8"));
  if (
    summary.formatVersion !== 1 ||
    summary.metadata?.profile !== expectedProfile ||
    summary.metadata?.label !== expectedLabel ||
    !summary.k6Summary?.metrics
  ) {
    throw new Error(
      `${path.basename(filePath)} is not a valid ${expectedLabel} ${expectedProfile} k6 summary.`,
    );
  }
  return summary;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function metricValue(summary, metricName, key) {
  const value = summary.k6Summary.metrics[metricName]?.values?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function thresholdState(summary) {
  const metrics = summary.k6Summary.metrics;
  const relevant = [
    metrics.api_acceptance_latency?.thresholds,
    metrics.sync_request_failures?.thresholds,
  ].filter(Boolean);
  if (relevant.length === 0) {
    return "Not reported";
  }
  const outcomes = relevant.flatMap((thresholds) =>
    Object.values(thresholds).map((result) =>
      typeof result === "boolean" ? result : result?.ok,
    ),
  );
  if (outcomes.length === 0 || outcomes.some((result) => typeof result !== "boolean")) {
    return "Not reported";
  }
  return outcomes.every(Boolean) ? "Passed" : "Failed";
}

function formatValue(value, digits = 2) {
  return value === null ? "Not available" : value.toFixed(digits);
}

function createMetricRows(pre, post, comparable) {
  const metrics = [
    {
      name: "p50 API acceptance latency (ms)",
      metric: "api_acceptance_latency",
      key: "med",
      lowerIsBetter: true,
    },
    {
      name: "p95 API acceptance latency (ms)",
      metric: "api_acceptance_latency",
      key: "p(95)",
      lowerIsBetter: true,
    },
    {
      name: "p99 API acceptance latency (ms)",
      metric: "api_acceptance_latency",
      key: "p(99)",
      lowerIsBetter: true,
    },
    {
      name: "Sync requests",
      metric: "sync_requests",
      key: "count",
      lowerIsBetter: false,
      digits: 0,
    },
    {
      name: "Completed iterations/sec",
      metric: "iterations",
      key: "rate",
      lowerIsBetter: false,
    },
    {
      name: "Sync request failure rate (%)",
      metric: "sync_request_failures",
      key: "rate",
      lowerIsBetter: true,
      percentage: true,
    },
    {
      name: "Sampled completion observation p95 (ms)",
      metric: "completion_observation_ms",
      key: "p(95)",
      lowerIsBetter: true,
    },
    {
      name: "Sampled completion success rate (%)",
      metric: "completion_sample_success",
      key: "rate",
      lowerIsBetter: false,
      percentage: true,
    },
  ];

  return metrics.map((definition) => {
    let preValue = metricValue(pre, definition.metric, definition.key);
    let postValue = metricValue(post, definition.metric, definition.key);
    if (definition.percentage) {
      preValue = preValue === null ? null : preValue * 100;
      postValue = postValue === null ? null : postValue * 100;
    }
    let change = null;
    let relative = "N/A";
    let interpretation = "Insufficient metric data.";
    if (preValue !== null && postValue !== null) {
      change = postValue - preValue;
      relative =
        preValue === 0 ? "N/A (pre value is zero)" : `${((change / Math.abs(preValue)) * 100).toFixed(2)}%`;
      if (!comparable) {
        interpretation = "Workload/target mismatch; do not infer a change.";
      } else {
        const improved =
          definition.lowerIsBetter ? change < 0 : change > 0;
        interpretation =
          change === 0
            ? "No measured change."
            : improved
              ? "Direction is generally favorable."
              : "Direction merits investigation.";
      }
    }
    const digits = definition.digits ?? 2;
    return {
      name: definition.name,
      pre: formatValue(preValue, digits),
      post: formatValue(postValue, digits),
      change: change === null ? "Not available" : `${change > 0 ? "+" : ""}${change.toFixed(digits)}`,
      relative,
      interpretation,
    };
  });
}

export function compareSummaries(pre, post) {
  const issues = [];
  if (pre.metadata.profile !== post.metadata.profile) {
    issues.push("Profile differs.");
  }
  if (pre.metadata.targetHost !== post.metadata.targetHost) {
    issues.push("Target host differs.");
  }
  if (stableJson(pre.metadata.workload) !== stableJson(post.metadata.workload)) {
    issues.push("Workload settings differ.");
  }
  if (
    pre.metadata.executionStatus === "execution_error" ||
    post.metadata.executionStatus === "execution_error"
  ) {
    issues.push("At least one run ended with an execution error.");
  }
  const comparable = issues.length === 0;
  return {
    comparable,
    issues,
    rows: createMetricRows(pre, post, comparable),
    preThresholds: thresholdState(pre),
    postThresholds: thresholdState(post),
    preStatus: pre.metadata.executionStatus || "Not recorded",
    postStatus: post.metadata.executionStatus || "Not recorded",
  };
}

export function renderReport(profileName, pre, post, comparison) {
  const rows = comparison.rows
    .map(
      (row) =>
        `| ${row.name} | ${row.pre} | ${row.post} | ${row.change} | ${row.relative} | ${row.interpretation} |`,
    )
    .join("\n");
  const issueText = comparison.comparable
    ? "Workload and target settings match."
    : `**Not directly comparable:** ${comparison.issues.join(" ")}`;
  const workload = JSON.stringify(pre.metadata.workload, null, 2);
  return `# ${profileName} pre/post performance comparison

This is a descriptive comparison of two recorded runs, not proof of a deployment effect or statistical significance. Any figures below are taken from the saved k6 summaries.

## Run details

| Label | Run time (UTC) | Target host | Build | Execution | Thresholds |
|---|---|---|---|---|---|
| Pre | ${pre.metadata.runAtUtc || "Not recorded"} | ${pre.metadata.targetHost} | ${pre.metadata.appBuildId || "Not supplied"} | ${comparison.preStatus} | ${comparison.preThresholds} |
| Post | ${post.metadata.runAtUtc || "Not recorded"} | ${post.metadata.targetHost} | ${post.metadata.appBuildId || "Not supplied"} | ${comparison.postStatus} | ${comparison.postThresholds} |

## Workload

\`\`\`json
${workload}
\`\`\`

${issueText}

## Results

| Metric | Pre | Post | Absolute change | Relative change | Interpretation |
|---|---:|---:|---:|---:|---|
${rows}

Threshold failure is distinct from a test-execution error. The status "thresholds_failed" means k6 completed and a configured threshold failed; "execution_error" means the run itself did not complete normally. A missing threshold result is reported as unavailable, not as a pass.

Acceptance latency measures the mock's HTTP response. HTTP 202 means accepted, not that a downstream Analytics event was ingested. Completion polling, when enabled, is reported separately and is an observation bounded by the polling interval and attempt limit.
`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (!allowedProfiles.has(profile) || process.argv.length > 3) {
    console.error(
      "Usage: node scripts/compare-results.mjs <baseline|load|stress|soak>",
    );
    process.exit(2);
  } else {
    try {
      const prePath = path.join(
        performanceDirectory,
        "results",
        `${profile}-pre.json`,
      );
      const postPath = path.join(
        performanceDirectory,
        "results",
        `${profile}-post.json`,
      );
      const pre = readSummary(prePath, profile, "pre");
      const post = readSummary(postPath, profile, "post");
      const comparison = compareSummaries(pre, post);
      const report = renderReport(profile, pre, post, comparison);
      const outputPath = path.join(
        performanceDirectory,
        "results",
        `${profile}-comparison.md`,
      );
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, report);
      console.log(
        `${profile} comparison: ${comparison.comparable ? "comparable" : comparison.issues.join(" ")}`,
      );
      console.log(`Pre execution: ${comparison.preStatus}; thresholds: ${comparison.preThresholds}`);
      console.log(`Post execution: ${comparison.postStatus}; thresholds: ${comparison.postThresholds}`);
      console.log(`Report saved to ${path.relative(performanceDirectory, outputPath)}`);
      if (!comparison.comparable) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(`Comparison failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
