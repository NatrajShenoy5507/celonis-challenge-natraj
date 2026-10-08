# Local k6 performance framework

This isolated Part D project exercises a fictional OMS sync request against a Node.js mock bound to `127.0.0.1`. It is not an OMS/Celonis integration, and its results do not predict enterprise performance. The mock accepts valid orders with HTTP 202 and marks them processed asynchronously; acceptance and completion are measured separately.

## Prerequisites

- Node.js 20 or later.
- The k6 CLI installed separately from npm; verify it with `k6 version`.

No public site is used or load-tested.

## PowerShell runbook

Open two terminals at the repository root. In Terminal 1:

```powershell
cd performance
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run mock
```

The mock listens only on `http://127.0.0.1:3000`. In Terminal 2:

```powershell
cd performance
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
k6 version

npm run perf:baseline:pre
npm run perf:load:pre

# A real deployment would occur here; the local mock has no deploy step.
npm run perf:baseline:post
npm run perf:load:post

npm run perf:compare:baseline
npm run perf:compare:load
```

Optional, short local-only profiles are available as `npm run perf:stress:pre` and `npm run perf:soak:pre`. They do not run automatically after another profile. Stress uses `ramping-vus`; soak uses `constant-vus`. These small demonstrations are not production stress/soak certification.

`pre` and `post` against an unchanged local mock are two demonstration measurements, not a genuine deployment comparison. For an authorized environment, the owner must explicitly approve the target; set its origin in `.env` and set `K6_ALLOW_REMOTE=true` only after approval. The runner blocks remote targets by default. Do not run against public demo sites.

## Mock contract

The mock accepts this fictional JSON shape at `POST /api/orders/sync`:

```json
{
  "orderId": "MOCK-unique-per-iteration",
  "amount": 149.95,
  "currency": "USD",
  "customerName": "Taylor Example",
  "status": "Confirmed"
}
```

- `GET /health` reports local service health.
- `POST /api/orders/sync` validates the payload and returns `202 Accepted`; processing happens asynchronously.
- `GET /api/orders/{orderId}/status` reports `pending`, `processed`, or `not_found`.
- `GET /metrics` reports accepted, processed, rejected, pending, stored, and maximum order counts.

Negative/non-finite amounts, malformed JSON, duplicate identifiers, unsupported statuses, and invalid required fields are rejected. The in-memory store is capped by `MOCK_MAX_ORDERS`; restart the mock to clear it. This illustrative contract is not an actual Celonis API specification.

## Workload and configuration

Copy `.env.example` to `.env`; keep that local file untracked. Every setting is validated by the runner. Key settings:

| Setting | Purpose |
|---|---|
| `K6_TARGET_URL` | HTTP(S) origin; defaults to loopback |
| `K6_ALLOW_REMOTE` | Remote-target opt-in; default `false` |
| `K6_BASELINE_VUS`, `K6_BASELINE_ITERATIONS` | Fixed-iteration baseline |
| `K6_LOAD_START_VUS`, `K6_LOAD_TARGET_VUS` | Starting and target concurrency |
| `K6_RAMP_UP`, `K6_HOLD`, `K6_RAMP_DOWN` | Load profile stages |
| `K6_STRESS_TARGET_VUS`, `K6_STRESS_RAMP_UP`, `K6_STRESS_HOLD`, `K6_STRESS_RAMP_DOWN` | Optional stress demonstration |
| `K6_SOAK_VUS`, `K6_SOAK_DURATION` | Optional short soak demonstration |
| `K6_ACCEPT_P95_MS`, `K6_ACCEPT_ERROR_RATE` | Illustrative k6 thresholds, not official SLIs/SLOs |
| `K6_COMPLETION_SAMPLE_RATE` | Fraction of accepted requests to poll; default `0` |
| `K6_COMPLETION_POLL_INTERVAL_MS`, `K6_COMPLETION_MAX_POLLS` | Bounded sampled completion observation |
| `MOCK_PORT`, `MOCK_PROCESSING_DELAY_MS`, `MOCK_MAX_ORDERS` | Local mock settings |
| `K6_API_TOKEN` | Optional authorized-target bearer token; excluded from logs and summary metadata |
| `APP_BUILD_ID` | Optional non-secret build identifier included in summary metadata |

The `load` and `stress` executors use `ramping-vus`: they control concurrent VUs, not fixed iteration totals or exact request arrival rate. Completed iterations/second is reported as such, not called requests/second. A `ramping-arrival-rate` profile could be considered if a real workload is defined by arrival rate.

## Results and interpretation

Each successful k6 invocation exports the actual k6 `handleSummary()` structure with safe run metadata to:

- `results/{profile}-{pre|post}.json`
- `results/{profile}-comparison.md` after comparison

The runner checks `k6 version`; if k6 is absent or a run does not emit a valid summary, it fails rather than creating success-shaped results. `thresholds_failed` means the test ran but at least one configured threshold failed. `execution_error` indicates the run did not complete normally. The comparator checks profile, target host, and workload settings before treating runs as comparable. Zero pre-values and missing metrics are shown as unavailable for relative change rather than dividing by zero.

Acceptance latency measures the HTTP response. HTTP 202 is acceptance only. If completion sampling is enabled, its success rate and observation time are separate metrics: bounded polling adds observation delay and does not measure exact backend processing lag.

For real systems, load testing must also verify queue depth, ingestion lag, backlog drain time, duplicate/drop rates, and deterministic OMS-to-Analytics correctness using reconciliation. The local mock cannot provide realistic evidence for these.

## Verification

Run the Node-side tests with `npm test`. They exercise the mock, validation, runner safety, and comparison calculations using explicitly constructed test fixtures; fixture values are not recorded performance results. The k6 profiles themselves require an installed k6 CLI and must be run only against an authorized target.
