---
name: k6-performance-review
description: Run the repository's predefined k6 baseline or ramped-load profile, preserve actual results, compare this run with the previous comparable run, and explain whether latency, throughput, and failures improved or regressed. Use for requested performance runs and pre/post performance reviews.
user-invocable: true
disable-model-invocation: true
---

# k6 performance run and comparison — GitHub Copilot Agent Skill

## Purpose and invocation

This is an **on-demand execution skill**, not a generic coding guideline. The user invokes it in **VS Code GitHub Copilot Chat, Agent mode**, for example:

- `/k6-performance-review` — run the predefined **load** profile and compare it with the previous load run.
- `/k6-performance-review baseline` — run the predefined fixed-iteration baseline and compare with the previous baseline.
- `/k6-performance-review load` — run the predefined ramp-up / hold / ramp-down load profile.
- `/k6-performance-review compare-only load` — do not run k6; compare the two latest recorded load runs, if comparable.

**Never run automatically just because performance files are mentioned.** Never run stress or soak unless the user explicitly requests that specific profile. Existing workload values are predefined in `performance/.env`; use them unchanged.

## Project context

The repo is an OMS → Analytics Event Platform quality-engineering take-home. Its `performance/` project exercises a **local Node.js mock** with k6. No authorized Celonis/OMS performance environment exists. Actual measurements from the mock demonstrate test execution and result comparison, **not Celonis capacity, production SLAs, or real deployment impact**.

Expected project files (verify actual paths; do not assume they all exist):

- `K6_FRAMEWORK_BUILD_INSTRUCTIONS.md` — framework construction requirements.
- `performance/README.md` — runbook.
- `performance/.env` and `.env.example` — configuration.
- `performance/package.json` — scripts.
- `performance/mock/server.mjs` — localhost-only mock.
- `performance/scripts/run-k6.mjs` — environment-aware runner.
- `performance/scripts/compare-results.mjs` — original pre/post comparison (if present).
- `performance/tests/sync-load.js` — actual k6 workload and `handleSummary()` output.
- `performance/results/` — generated summaries and comparisons, ignored by Git.
- `PERFORMANCE.md`, `AI_WORKLOG.md` — assignment documentation.

**Do not modify** the Playwright, reconciliation or Gemini projects. Preserve existing working k6 commands and their pre/post comparison feature.

## Required execution procedure

### 1. Inspect, determine requested profile, and check safety

1. Work from the repository root and read the existing performance README, package scripts, runner, k6 script, `.env.example`, and relevant architecture specification.
2. If the user did not specify a profile, choose `load`. For `baseline`, use its predefined **fixed total iterations**. For `load`, use its predefined **ramping virtual users**, including ramp-up, hold and ramp-down. Do not mistake VUs for RPS or make up a fixed iteration count for `ramping-vus`.
3. Check `node --version` and `k6 version`. If k6 is unavailable, stop and report the blocker; **never invent a completed test**.
4. Ensure `performance/.env` exists. If missing, explain how to create it from `.env.example` and stop. **Do not overwrite or print the `.env` file or its secrets.** Inspect only necessary non-secret keys through the existing config loader.
5. Derive the target URL using existing configuration logic. Local loopback is the safe default. **Never send load to a public demo, internet host, or remote service** without the user's explicit target-owner authorization, and the framework's explicit remote-safety opt-in. Never enable `K6_ALLOW_REMOTE` yourself.
6. Check the local mock's `/health`. If it is not running, start **only the existing local mock**, confirm it becomes healthy, and record whether this skill started it. If you started it, stop that process on completion; do not kill a service you did not start. If startup fails, stop without claiming a run.
7. Do not change VUs, iterations, stages, durations, thresholds, polling, think time, or mock processing delay to make results look better. If invalid, report the configuration issue instead.

### 2. Ensure durable historical results (one-time setup only)

**Important:** Older `perf:load:pre` and `perf:load:post` commands may write fixed filenames. That is not enough for a “current versus previous run” skill because a repeated execution can overwrite the previous evidence.

Before the first automated run, inspect how the actual runner and k6 `handleSummary()` save summaries. If the repo does not already provide immutable history and a single run-and-review command, **add the smallest compatible Node.js implementation**, preferably:

- `performance/scripts/run-and-review.mjs` — orchestrates one specified profile, archival, comparison and report.
- An npm script such as `perf:review`: `node scripts/run-and-review.mjs` (pass `-- load` / `-- baseline` if needed).

Keep the existing `run-k6.mjs` and pre/post commands working. Reuse their `.env` parsing, target guard and actual k6 summary. Do not install a Node `k6` dependency, and do not put Node-only imports into the k6 runtime script.

Requirements for the one-time implementation:

- Each run receives a **unique** run ID and output path; do not overwrite existing raw summaries. If a fixed output path is unavoidable, copy/archive its previous content **before** running again and verify the new file was freshly written.
- Store each measured run under an ignored history directory such as `performance/results/history/<profile>/<UTC-run-id>/` with `summary.json` and `metadata.json`.
- `metadata.json` includes only non-secret fields: timestamp (UTC), profile, safe target identifier, configured VUs/iterations/stages, durations, optional application-build label, k6 exit status, and hashes of workload script and non-secret test-data template. **Do not store tokens, passwords, cookies, full `.env` contents or request headers.**
- Maintain a reproducible command for future invocations. Do not require a fresh code rewrite for every run.
- If there is no existing automation, create and test it in small steps before using it; explicitly distinguish implementation verification from an actual k6 load execution.

### 3. Execute the selected workload

1. Unless `compare-only` was requested, run **exactly one** predefined profile through the project runner. Example from `performance/`: `npm run perf:review -- load`, after that script has been implemented. Otherwise use the repository's equivalent safe command.
2. Wait for completion and capture the real process exit code and real output file path. Do not guess an execution time or metric.
3. Validate that the newly written JSON is parseable, nonempty, contains actual k6 `metrics`, and belongs to this invocation. An older/stale summary must never be presented as the current run.
4. Distinguish:
   - **Success:** k6 executed and thresholds passed.
   - **Threshold failure:** k6 executed and wrote valid measurements, but a configured threshold failed; it is **not** a passed test.
   - **Execution failure:** no trustworthy completed summary; do not compute a normal result comparison.
5. Archive results even when a real k6 threshold failed and a valid metrics summary exists, while prominently recording its failed status.
6. Inspect and report **all available error evidence even when the run failed**: non-zero process/runner exit status, threshold failures, failed k6 checks, HTTP/business-check failure rates and counts, request errors, malformed or incomplete summaries, and any errors/warnings emitted by the runner or k6. Do not stop evaluation at the first error or let valid latency metrics obscure failures. Preserve concise, relevant error messages without exposing `.env` values, bearer tokens, request headers, or other secrets.
7. If the run failed before producing trustworthy metrics, report the failure evidence and mark metric comparisons **not evaluable**. Do not substitute zeroes, stale values, or a previous run's values for the missing current run.

### 4. Retrieve the previous run safely

1. Retrieve the **immediately preceding completed run of the same profile** from historical results, excluding the just-finished run. For `compare-only`, use the two latest completed runs of that profile.
2. Before calling it comparable, check that both runs have the same requested profile, target, workload VUs/iterations, stage durations, think time, request mix/polling settings, script/data definitions and relevant environment settings. Record application version if supplied; a different version is allowed for intentional pre/post analysis.
3. If the previous run exists but its workload differs, **do not claim an improvement or regression**; explain the exact mismatches and say the comparison is not like-for-like. Do not silently pick an older run without telling the user.
4. If no earlier result exists, report **“First run recorded — no previous run available”** and identify its archived path. Do not fabricate a previous baseline.
5. The labels `pre` and `post` only indicate a true deployment comparison when the user confirms a deployment and its build/version. Otherwise label it **“previous run vs current run”** (a mock demonstration, not a deployment effect).
6. Check both runs for error evidence, including failed thresholds/checks and recorded execution status. A prior failure does not excuse a current failure, and a lower latency must not be described as an improvement if error rate, failed checks, or execution status regressed.

### 5. Compare measured metrics

Read the **actual k6 summary JSON**. Find metrics by inspecting the k6 script and the stored output; **do not invent fields**. Prefer these fields when available:

- Inspect the actual metric names in the stored k6 summary and `performance/tests/sync-load.js`; use the repo's real custom names (currently `api_acceptance_latency` and `sync_request_failures`) rather than assuming names from examples.
- Acceptance latency p50/median, p95, and p99 from the actual acceptance metric; if only `http_req_duration` is present, clearly label the change in meaning.
- The actual request/business failure-rate metric and available failed counts/check results. If the custom metric is absent, `http_req_failed` can be a fallback only with that different scope clearly labeled.
- `iterations`: `count`, `rate` (completed workflow iterations/second). Each iteration is approximately one POST in the provided demo; **do not claim that polling-inclusive `http_reqs.rate` equals order-sync throughput**.
- Sampled completion observation and success metrics, **only if actually measured**; observed polling time is not precise backend processing time.
- configured threshold status, and completed request/iteration counts if available.
- k6 failed-check/error counts, threshold outcomes, execution status/exit code, and concise runner/k6 error text where recorded or captured. Say **“not available”** when the artifact does not contain the information; do not infer that no errors occurred.

Calculate:

- Absolute difference = `current - previous`.
- Relative difference (%) = `(current - previous) / previous × 100`, **only if previous is nonzero**.
- Failure-rate difference must also be shown in **percentage points**, not confused with relative percent.
- Display missing data as `n/a`, never `0`.

Interpretation:

- **Latency p50/p95/p99:** lower is generally better at the same workload.
- **Error rate:** lower is better; zero new failures is particularly important.
- **Completed iterations per second:** higher is generally better for a comparable closed-model workload, but check changes in failure rate and think time.
- **Errors and failed checks:** report their observed counts/rates and threshold outcomes for both runs. An increase is a regression signal even when latency or throughput improves. If counts/rates are missing, classify the error comparison as **not evaluable**, not “no regression.”
- If latency improves but failures increase or throughput drops, state **mixed trade-offs**, not a blanket improvement.
- Small single-run fluctuations are **directional only**. Do not imply statistical significance or assert a deployment caused changes. Recommend repeat runs for confidence.
- In a real OMS integration, HTTP `202 Accepted` measures acceptance only; actual ingestion lag, backlog and correctness need separate observability and reconciliation.

### 6. Write and explain the result

Create a **human-readable Markdown report** under `performance/results/` and keep historical results. Suggested files:

- `performance/results/history/<profile>/<current-run-id>/comparison.md` — review attached to a particular execution.
- `performance/results/latest-<profile>-review.md` — easy-to-find latest report, allowed to update.

Report structure:

1. Title and UTC timestamps for previous and current runs.
2. Profile, environment, target type (**LOCAL MOCK**), matching workload configuration, build/version labels if known.
3. Execution status and threshold results for each run.
4. A Markdown comparison table with at least these columns: **Metric | Previous | Current | Absolute change | Relative change | Evaluation | Regression?**. Use explicit `Yes`, `No regression detected`, `Not evaluable`, or `Not comparable` in the last column. "No regression detected" is a directional finding for measured metrics, not proof that no regression exists.
5. A separate **Errors and failed checks** table with **Evidence | Previous | Current | Evaluation**. Include execution status/exit code, threshold failures, failed checks, request/business error rates and counts, and captured runner/k6 errors where available. Use `None observed` only when the artifact/logs were actually checked and show none; otherwise use `Not available`. If there are any errors, name them and state their effect on the result.
6. Short findings explicitly list **what regressed**, **what did not show a regression**, and **what could not be evaluated**. Do not omit a regression because another metric improved.
7. Overall conclusion: **appears better / appears worse / mixed / inconclusive / cannot compare** — and why. If any error/threshold failure invalidates or limits the comparison, state that prominently.
8. Limitations: mock-only, sampling, run-to-run variance, no real deployment assertion, and no measured real Analytics ingestion.
9. Paths to both raw JSON artifacts and this review.

In Copilot Chat, provide a concise summary grounded in the saved measurements. Do not say “all checks passed” unless the actual return status and thresholds justify it.

### 7. Update the AI work log

Append a compact entry to `AI_WORKLOG.md` describing: skill/tool used, user-triggered command, workload configuration source, real commands executed, run IDs/paths, observed result, any implementation corrections, verification, and limitations. Do not record secrets or dump massive logs.

## Hard rules

- **No remote/public-site performance tests** without explicit target-owner authorization and safety controls.
- **No invented metrics or fake pre/post results.** No comparison if data is absent, stale, mismatched or untrustworthy.
- **Do not overwrite past raw test evidence.** Historical preservation is mandatory.
- **Do not secretly edit `.env` or predefined VUs, iterations, ramps, stages, thresholds or test data.**
- **Do not auto-run stress or soak.** Only run them when named explicitly by the user.
- **Do not mistake a mock run for Celonis performance or a real deployment comparison.**
- **Do not modify unrelated challenge parts.**
- If executing commands needs terminal permission, ask for it; a skill definition alone cannot bypass Copilot execution approvals.

## Done criteria

A successful invocation runs (or explicitly `compare-only` reviews) an actual configured k6 profile, writes an immutable summary with metadata, finds and validates the previous run, generates the metric comparison when possible, explains directional performance changes and limitations, and records real work in `AI_WORKLOG.md`.
