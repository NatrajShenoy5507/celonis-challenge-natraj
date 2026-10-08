# Copilot Build Instructions — Part D k6 Performance Framework

> **Purpose:** This is an implementation specification for GitHub Copilot Agent in VS Code. Read this entire file before changing code. Build the performance project **inside the existing Celonis AI Engineer – Quality challenge repository**; do not produce only a written plan. Do not claim a performance test passed unless it was actually executed.

## 1. Project context and objective

The challenge describes an **OMS (source of truth) → Analytics Event Platform** synchronization. Our Part C deterministic reconciler checks downstream correctness. We do **not** have an authorized real OMS/Analytics performance environment or a real synchronization API.

Implement a **small, executable, configurable k6 framework** against a **local Node.js mock synchronization API**. It should demonstrate:

1. **Pre-deployment baseline:** fixed iterations at low concurrency, with reproducible settings.
2. **Pre-deployment load:** controlled virtual users gradually ramp up, hold, then ramp down.
3. **Post-deployment baseline and load:** repeat the **same workload configuration** after a hypothetical deployment.
4. **Pre/post comparison:** compare latency, throughput and failures, and flag missing/mismatched run settings.
5. Document **stress and soak** workload designs and, if simple, implement optional runnable profiles without running them automatically.
6. Separate **API request acceptance** from **actual downstream synchronization completion**.

**Honesty constraint:** Local mock results demonstrate the framework only. They are **not** Celonis/OMS performance measurements, evidence of an actual deployment improvement, or production SLAs.

## 2. First inspect the repository

Before implementation:

- Read any existing `PROJECT_IDEA.md`, `PERFORMANCE.md`, root `README.md`, `.gitignore`, and `AI_WORKLOG.md`.
- Inspect existing folders and scripts. **Reuse working files if already present; do not create duplicate implementations**.
- Keep all performance-related source under `performance/`; place the Part D reviewer document at root `PERFORMANCE.md`.
- Do not alter or break Part A strategy, Part B Playwright, Part C reconciliation, or Part E Gemini functionality.
- Do not modify the user's real `.env` contents, commit secrets, or run stress/load tests against a public demo website.

## 3. Target architecture

Use a compact structure roughly like this (adapt to existing files, and don't create empty/unnecessary layers):

```text
project-root/
├── PERFORMANCE.md                    # Part D submission narrative
├── AI_WORKLOG.md                      # Log AI usage and real validation
└── performance/
    ├── .env.example                  # Safe, documented defaults only
    ├── .gitignore                    # Ignore .env, results, transient files
    ├── package.json                  # Convenience npm scripts
    ├── README.md                     # How to install/run/interpret
    ├── config/
    │   └── ...                       # Minimal Node-side env validation/config
    ├── data/
    │   └── order-template.json       # Non-secret valid mock order fields
    ├── mock/
    │   └── server.mjs                # Local-only HTTP API simulator
    ├── scripts/
    │   ├── run-k6.mjs                # Loads .env, validates target, invokes k6
    │   └── compare-results.mjs       # Pre/post metrics comparison
    ├── tests/
    │   └── sync-load.js              # k6-native script and profiles
    └── results/                      # Generated run summaries; Git-ignored
```

**Runtime boundaries:** `performance/mock/` and `performance/scripts/` run with Node.js. `performance/tests/sync-load.js` runs with the **k6 runtime**, not Node.js. **Never import `dotenv`, `fs`, `process`, `child_process`, or other Node-only modules inside the k6 script.** k6 uses `__ENV`, k6 HTTP APIs, and its own metric modules. k6 is a separately installed CLI, **not** the npm `k6` package.

## 4. Configuration from `performance/.env`

Create `performance/.env.example` and make all operational settings configurable. Users copy it to `.env` and change settings without editing load scripts.

Suggested keys (adjust names only if matching existing files requires it, but document every key):

```dotenv
# Safe local target by default
K6_TARGET_URL=http://127.0.0.1:3000
K6_ALLOW_REMOTE=false

# Fixed-iteration baseline
K6_BASELINE_VUS=1
K6_BASELINE_ITERATIONS=30

# Gradual-load profile
K6_LOAD_START_VUS=1
K6_LOAD_TARGET_VUS=10
K6_RAMP_UP=20s
K6_HOLD=30s
K6_RAMP_DOWN=10s

# Illustrative thresholds only, NOT real Celonis SLAs
K6_ACCEPT_P95_MS=500
K6_ACCEPT_ERROR_RATE=0.01

# Optional mock behavior; not a real integration
MOCK_PORT=3000
MOCK_PROCESSING_DELAY_MS=100

# Optional bearer token for a future authorized endpoint; never log it
K6_API_TOKEN=
```

Requirements:

- Parse and validate numeric values and durations with clear errors. Reject nonsensical values (negative iterations, VUs < 1, etc.).
- `.env` loading must happen in the **Node runner/mock configuration**. Pass the required values into k6's `__ENV` via the child-process environment.
- Do not hard-code a real API URL, credentials, or tokens in code or JSON.
- `.env` and `results/` must be ignored by Git. Commit only `.env.example`.
- Default target is localhost/127.0.0.1. If the target is **not local**, block execution unless `K6_ALLOW_REMOTE=true` is explicitly set. Document that the user must also have owner authorization; never enable remote load by default.
- Existing `playwright/.env` and root Gemini `.env` must remain independent of `performance/.env`.

## 5. Local Node.js mock API

Create a minimal HTTP server using Node's built-in modules (prefer zero runtime dependencies unless a small existing dependency is already in use). Bind to `127.0.0.1` by default.

**Illustrative mock-only endpoints** (the real Celonis API contract is unknown):

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/health` | Returns a small health JSON response |
| `POST` | `/api/orders/sync` | Validates a minimal order payload and returns `202 Accepted` with order/request identifier |
| `GET` | `/api/orders/{orderId}/status` | Returns `pending`, `processed`, or `not found` for locally submitted orders |
| `GET` | `/metrics` | Returns accepted/processed/rejected counts, current pending count, and other available mock-only counters |

Mock behavior:

- Accept realistic **fictional** orders with a unique ID, non-negative amount, currency, customer and lifecycle status. Make the request schema explicit in README; don't claim it comes from an actual Celonis API.
- Simulate asynchronous processing using a configurable short delay; distinguish HTTP acceptance from completed processing.
- Respond with a validation error for malformed payloads and negative amounts.
- Keep only bounded in-memory state or introduce a clear cap so a test cannot consume unlimited memory. It is fine if server restart clears state.
- Keep the server deterministic and small. **No real database, Kafka, Celonis account, or public demo site integration.**
- Never present mock throughput, queue behavior, or simulated ingestion time as a prediction of actual enterprise performance.

## 6. k6 script and workload design

Implement k6's **native JavaScript** API test using a JSON order template from `performance/data/order-template.json`, with a **unique ID per iteration/VU**. Do not reuse the source CSV order IDs for write/load operations.

A single iteration should:

1. Construct a valid fictional order payload with dynamic identifier.
2. Send `POST /api/orders/sync` to the configured target.
3. Check that the response is the expected **mock** accepted status and parseable JSON; mark any failure.
4. Record response latency and error/success metrics.
5. **Optionally** sample downstream completion through a status endpoint as a **separately labeled measurement**, with bounded polling and a configurable sample rate. Do not confuse polling-adjusted observation time with precise backend processing lag; do not force polling for every request under heavy load.

Profiles:

| Profile | k6 executor | Requirement |
|---|---|---|
| `baseline` | `shared-iterations` | Fixed total iteration count (`K6_BASELINE_ITERATIONS`) across configured VUs |
| `load` | `ramping-vus` | Gradual ramp-up → hold → ramp-down, durations/VUs from `.env` |
| `stress` | `ramping-vus` | Optional above-normal local-only run to observe saturation/recovery |
| `soak` | `constant-vus` | Optional **short demo** sustained run; explicitly not a real enterprise soak test |

**Important semantics:** A `ramping-vus` load test controls concurrent virtual users, **not a fixed number of iterations or exact arrival rate**. k6 reports completed iterations; don't call VUs “requests per second.” Mention `ramping-arrival-rate` as a possible future upgrade for throughput-driven workloads, but do not add that complexity unless needed.

Metrics to report, when supported:

- API acceptance latency: **p50, p95, p99**.
- Total requests, completed iterations, and iterations/second or requests/second (state which).
- HTTP and business-check failure rate.
- The selected threshold values and whether they passed.
- If implemented: sampled completion rate/lag and mock backlog; label limitations.
- For a **real** system, document queue depth, ingestion lag, backlog drain time, duplicates/drops and Part C reconciliation as observability/correctness checks — **do not pretend the local mock measures them realistically**.

Thresholds from `.env` are **illustrative**. Compare against agreed SLIs/SLOs only when real requirements and telemetry exist.

## 7. npm CLI and pre/post output handling

Add convenient commands to `performance/package.json` (users execute from the `performance` directory):

```json
{
  "scripts": {
    "mock": "node mock/server.mjs",
    "perf:baseline:pre": "node scripts/run-k6.mjs baseline pre",
    "perf:baseline:post": "node scripts/run-k6.mjs baseline post",
    "perf:load:pre": "node scripts/run-k6.mjs load pre",
    "perf:load:post": "node scripts/run-k6.mjs load post",
    "perf:compare:baseline": "node scripts/compare-results.mjs baseline",
    "perf:compare:load": "node scripts/compare-results.mjs load"
  }
}
```

Optional stress/soak commands can be added if those profiles are implemented.

Runner requirements:

- Load `performance/.env` and pass its values to the k6 subprocess.
- Fail clearly if the k6 executable is missing (`k6 version` is a prerequisite). Do **not** report a successful run when k6 was not available.
- Run only the requested profile; never auto-run stress/soak after baseline.
- Save separate, real machine-readable summary files under `performance/results/`, such as `baseline-pre.json`, `baseline-post.json`, `load-pre.json`, and `load-post.json` (or documented equivalents).
- Capture safe metadata alongside metrics: profile, `pre`/`post` label, UTC run time, target host, VUs/iterations/stages/durations, and suggested application build/version identifier if supplied. **Never record authorization tokens or `.env` secrets.**
- Make sure Node config and k6 `handleSummary()`/summary exporting agree on output path and data format. Use the actual k6 summary shape, not invented metric names.

## 8. Pre/post comparison logic

Build `scripts/compare-results.mjs` to read two actual saved summaries and generate a Markdown table such as:

| Metric | Pre | Post | Change | Interpretation |
|---|---:|---:|---:|---|
| p50 acceptance latency (ms) | measured | measured | computed | Lower is generally better |
| p95 acceptance latency (ms) | measured | measured | computed | Tail latency |
| p99 acceptance latency (ms) | measured | measured | computed | Tail latency |
| Completed iterations/sec | measured | measured | computed | Higher under comparable load is generally better |
| Failure rate (%) | measured | measured | computed | Lower is better |

Rules:

- Compute differences and relative changes correctly; handle zero/missing values without dividing by zero.
- **Refuse or clearly warn on** different workload profiles, VU counts, iteration counts, stage durations, or target hosts. The same offered workload/configuration is essential for a meaningful comparison.
- Display run timestamps and config summary. Describe the output as a **comparison**, not proof of a deployment effect or statistical significance.
- Distinguish threshold failure from a test-execution error; document both.
- Write the resulting Markdown report to `performance/results/`, and optionally print a concise terminal summary.
- Do **not** fabricate pre/post measurements or ship synthetic numbers as real observed results.

## 9. Required `PERFORMANCE.md` content

Write or update the existing root `PERFORMANCE.md` using our chosen approach. Include:

1. **Objective and scope:** performance of OMS → Analytics synchronization in principle; runnable local mock only.
2. **Pre-deployment baseline → deploy → post-deployment baseline:** same workload, repeat when possible, compare results and investigate differences.
3. **Load approach:** fixed iterations for baseline, gradual ramp-up and sustained hold for load. Explain `ramping-vus` versus iterations/arrival rate accurately.
4. **Stress and soak:** what they would reveal, even if only small demonstration runs are included.
5. **Measurements/oracles:** p50/p95/p99, throughput, failures, and the distinction between HTTP 202 acceptance and true event ingestion.
6. **Proposed thresholds:** clearly marked *illustrative*, not official Celonis SLA/SLO.
7. **Data correctness under load:** in a real system, check missing/duplicate/orphan events, amount/currency correctness, timestamp ordering and lifecycle using Part C-style deterministic reconciliation after generating load.
8. **Environment/configuration:** how `.env` controls parameters and how to run and compare profiles.
9. **Limitations and safety:** no authorized OMS performance environment, no real Celonis endpoints, mock-only performance, no public demo-site load tests.
10. **AI-first workflow:** AI/Copilot assists implementation; human reviews the workload model, metrics, real execution and limitations.

Keep the strategy concise and aligned to a short take-home assignment rather than a lengthy production performance plan.

## 10. Runbook to document in `performance/README.md`

Include PowerShell-friendly steps for Windows/VS Code:

```powershell
# Prerequisite: install k6 CLI separately, then verify:
k6 version

# Terminal 1: mock service
cd performance
Copy-Item .env.example .env
npm run mock

# Terminal 2: same performance folder
cd performance
npm run perf:baseline:pre
npm run perf:load:pre

# In real work, deploy the application here. The local mock has no real deployment.
npm run perf:baseline:post
npm run perf:load:post

npm run perf:compare:baseline
npm run perf:compare:load
```

Explain that `pre` and `post` labels on the unmodified local mock are **two demonstration measurements, not a genuine deployment comparison**. Users can edit workload settings in `.env` for their authorized environment. Document exact output locations and how to interpret failed checks/thresholds.

## 11. Verification and acceptance criteria

**Do not stop at creating files. Validate what can be validated in the current machine.**

- [ ] Project tree follows the intended architecture without unnecessary layers.
- [ ] `.env.example` contains all required keys; `.env` and generated results are Git-ignored.
- [ ] `npm run mock` starts a localhost-only server.
- [ ] `GET /health` works and a valid mock sync request returns the documented accepted response.
- [ ] Invalid/negative amount is rejected; status and metrics endpoints work.
- [ ] The runner rejects invalid configuration and remote targets by default.
- [ ] If k6 is installed, baseline pre/post and ramped load pre/post run successfully and save **actual** summaries.
- [ ] If k6 is installed, comparison scripts read the real summaries and produce an understandable pre/post table.
- [ ] If k6 is absent, report that limitation clearly; **do not claim k6 tests passed**. Still test the mock and summary comparison logic with explicitly marked fixture data if needed.
- [ ] No actual Celonis/API demo site is load-tested.
- [ ] `PERFORMANCE.md` and `performance/README.md` correctly distinguish strategy, proposed thresholds, mock measurements and real production measurements.
- [ ] `AI_WORKLOG.md` is updated with the actual AI contribution, what was corrected/rejected, and what was truly executed/verified.

## 12. Implementation workflow: work in small steps

1. **Inspect** existing project files and explain briefly what will be reused/created.
2. Build and test the **local mock** first (small server and health/accepted/invalid requests).
3. Add `.env.example`, config validation and **safe runner**.
4. Add the **baseline** k6 profile; run if CLI available.
5. Add **ramped load** (and optional stress/soak) profiles; run only safe local tests.
6. Add actual JSON summary output and the **pre/post comparison**.
7. Update `PERFORMANCE.md`, `performance/README.md` and `AI_WORKLOG.md`.
8. Finish by listing files created/changed, exact commands run, observed results, any blockers, and remaining limitations.

**Keep it lean:** avoid Docker, Kubernetes, databases, dashboards, synthetic result screenshots, CI pipelines or elaborate abstraction layers unless explicitly requested. This is Part D of a time-boxed QE take-home.

---

### Message to Copilot when adding this file

> Read `K6_FRAMEWORK_BUILD_INSTRUCTIONS.md` completely and implement Part D step by step in this existing repository. Inspect current files before editing; preserve Parts A/B/C/E. Start with the local mock, then `.env` configuration, k6 baseline/load profiles, pre/post result comparison, README and PERFORMANCE.md. Execute the checks you can actually run, distinguish mock/demo results from real deployment results, and summarize the verification. Do not run load against public or remote targets.
