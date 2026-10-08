# Celonis AI Engineer – Quality | Take-Home Challenge

This project demonstrates Quality Engineering for an Order-to-Cash integration between an Order Management System (OMS) and an Analytics Event Platform. OMS is the source of truth; Analytics stores order lifecycle events. The solution covers test strategy, representative UI/API automation, deterministic data reconciliation, a local k6 performance demonstration, and AI-assisted explanation of confirmed defects.

## Challenge Deliverables

| Part | Area | Implementation | Main deliverable |
|---|---|---|---|
| A | Test strategy | Risk-based scenarios across UI, API/integration, and data layers | [STRATEGY.md](./STRATEGY.md) |
| B | UI/API automation | TypeScript and Playwright Test against a representative demo shop and its documented API | [`playwright/`](./playwright/) |
| C | Data reconciliation | Deterministic Node.js checks over OMS and Analytics CSV exports | [DEFECT_REPORT.md](./DEFECT_REPORT.md) |
| D | Performance strategy | k6 profiles and a localhost-only mock API | [PERFORMANCE.md](./PERFORMANCE.md) |
| E | AI-first quality engineering | Gemini explanation of deterministic findings, with response validation | [AI work log](./AI_WORKLOG.md) |

## Solution Architecture

```text
Actual challenge data validation

data/orders.csv ─────────────┐
                             ├─> Deterministic reconciliation
data/analytics_event_log.csv ┘              │
                                            ├─> reconciliation/output/defects.json
                                            │        ├─> DEFECT_REPORT.md
                                            │        └─> Gemini explainer
                                            │                 │
                                            └─────────────────┴─> Validated ai/output/ai-analysis.json

Representative demo UI/API testing (separate from Celonis):
Playwright ──> QA Automation Labs shop and its documented read-only products API

Mocked performance demonstration (separate from Celonis):
k6 ──> local Node.js mock API at 127.0.0.1
```

The demo shop and local mock are not OMS or Celonis systems. The Playwright tests demonstrate a representative browser/API automation slice; Part C reconciles the supplied OMS and Analytics data.

## Part A — Test Strategy

[STRATEGY.md](./STRATEGY.md) contains **20 scenarios imported from the workbook**, with the workbook left unchanged. It prioritizes silent business-data corruption as P0 and includes UI, API/integration, and data layers; lifecycle branches; measurable oracles; and a one-hour risk-based focus. High-risk data checks include completeness, referential integrity, amount/currency correctness, timestamps, duplicates, and lifecycle conformance.

## Part B — Playwright UI/API Automation

The isolated [`playwright/`](./playwright/) project uses TypeScript, Playwright Test, Page Objects, a custom fixture, typed domain/environment models, and a JSON data provider/factory. Page Objects own application locators; test specifications express business behavior without defining application locators directly.

The framework tests authenticated shop access, filtering electronics to laptops, cart add/remove behavior, a typed framework-data provider, and the demo API's documented read-only `GET /products` response. Authentication uses Playwright `storageState`; local session reuse is configurable (12 hours by default) and freshness/shape are checked, while CI performs fresh authentication. Credentials are loaded from `playwright/.env`, not committed. Playwright MCP was used to inspect the demo site's behavior and locators.

Smoke and regression tags/scripts are available. Local runs use the HTML reporter; CI configuration additionally emits Allure results and retries. Failure screenshots and first-retry traces are enabled. Video is retained on failure in CI and disabled locally because the Windows policy blocks Playwright's bundled FFmpeg.

From the repository root, set up the isolated dependencies and browser:

```powershell
npm install --prefix playwright
npx --prefix playwright playwright install chromium
Copy-Item playwright\.env.example playwright\.env
```

Enter valid demo test-account values for `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `playwright/.env`; do not commit them. `EMAIL`/`PASSWORD` are accepted for existing local configurations. The example also documents `BASE_URL`, `API_BASE_URL`, `TEST_ENV`, and `AUTH_STATE_TTL_HOURS`.

| Action | Command from repository root |
|---|---|
| All Playwright tests | `npm test --prefix playwright` |
| UI tests | `npm run test:ui --prefix playwright` |
| API tests | `npm run test:api --prefix playwright` |
| Smoke tests | `npm run test:smoke --prefix playwright` |
| Regression tests | `npm run test:regression --prefix playwright` |
| TypeScript check | `npm run typecheck --prefix playwright` |
| Open HTML report | `npm run report:html --prefix playwright` |
| Generate Allure report from CI results | `npm run report:allure --prefix playwright` |

Allure report generation requires Java and a valid `JAVA_HOME`.

## Part C — OMS-to-Analytics Reconciliation

The deterministic Node.js reconciler reads `data/orders.csv` and `data/analytics_event_log.csv`. It checks non-Cart order/event completeness, Analytics CaseId referential integrity, amount and currency equality, CustomerName equality after trim/case normalization, timestamp validity/UTC/future values and sequence, DeliveredDate correspondence (a documented derived assumption), duplicate activities, lifecycle conformance including Cancelled/Returned paths, and non-negative OMS amounts.

The current generated output contains **17 raw findings across 11 affected cases**. [DEFECT_REPORT.md](./DEFECT_REPORT.md) groups these into **14 reviewer-facing defects**, retaining the raw finding IDs and supporting evidence. These are seeded data-quality findings, not evidence that all rules passed.

| Action | Command from repository root | Output |
|---|---|---|
| Reconcile CSVs | `npm run reconcile` | `reconciliation/output/defects.json` |
| Generate reviewer report | `npm run report` | `DEFECT_REPORT.md` |

Both generated outputs are currently present and tracked in the repository.

## Part D — Performance & Load Testing

[PERFORMANCE.md](./PERFORMANCE.md) describes the performance strategy; [`performance/README.md`](./performance/README.md) contains the runbook. k6 was selected for JavaScript-based, version-controlled workloads, fixed iterations and ramp-up scenarios, thresholds, CLI/CI execution, and machine-readable output.

The local Node.js mock supports the executable demonstration:

- **Baseline:** fixed iterations with low concurrency.
- **Load:** gradual `ramping-vus` stages; VUs model concurrency, not requests per second.
- **Stress:** optional short local-only ramp to observe mock saturation/recovery.
- **Soak:** optional short local-only sustained run; not an enterprise soak test.

The strategy considers real traffic volumes, bursty batch ingestion, retries, queue/backlog behavior, and a proposed 30% headroom scenario. It distinguishes client-side p50/p95/p99, throughput, and errors from server/infrastructure telemetry and downstream ingestion. Numerical thresholds are illustrative; the current `.env.example` p95 and error-rate values match those documented in `PERFORMANCE.md`. A full-scale performance run is **not required** for this challenge.

The k6 stub targets the local mock's fictional sync API. It is not a Celonis benchmark, and its results cannot establish enterprise capacity. Do not load-test public demo sites without authorization. Configure the ignored `performance/.env` from its safe example and keep its target on loopback:

```powershell
cd performance
Copy-Item .env.example .env
k6 version
npm run mock
```

In another terminal at `performance/`, use `npm run perf:baseline:pre`, `npm run perf:load:pre`, and, when suitable, their `:post` and `perf:compare:*` commands. Optional stress/soak commands are documented in the component runbook. k6 is a separate CLI installation; the complete command sequence and output locations are in [`performance/README.md`](./performance/README.md). No k6 run against an external service is represented here.

## Part E — AI-First Quality Engineering

The Gemini explainer reads the deterministic findings—not the source CSVs—and produces case-level explanation, business impact, constrained root-cause mechanisms, and investigation steps:

```text
Deterministic defects
        ↓
Gemini explanation
        ↓
Structural and semantic validation
        ↓
Persist only validated ai-analysis.json
```

Gemini does not determine pass/fail or override OMS evidence. Validation grounds CaseIds and finding IDs, preserves deterministic severity, rejects unsupported or OMS-blaming text, and restricts root-cause mechanisms to category-allowed enums (SOURCE_DATA-only cases have none). Invalid output receives at most one corrective retry; only validated output is saved.

Set `GEMINI_API_KEY` in the repository-root `.env` using [.env.example](./.env.example) as a template, then run:

```powershell
npm run ai:explain
```

The current validated result is in `ai/output/ai-analysis.json`. It is generated output, not a substitute for the deterministic findings. See the [AI work log](./AI_WORKLOG.md) for decisions and verification history.

For AI artifact setup, execution, guardrails, and limitations, see [AI Artifact Documentation](./ai/README.md).

## AI-Assisted Development Workflow

GitHub Copilot assisted with implementation and documentation. Playwright MCP supported inspection of the demo application. The repository includes on-demand Copilot Agent Skills for targeted [Playwright test generation](./.github/skills/playwright-test-generation/SKILL.md) and [k6 performance review](./.github/skills/k6-performance-review/SKILL.md). Gemini is used only to explain deterministic defects; its responses are guarded before persistence. Human review and execution-based checks remain necessary, and the [AI work log](./AI_WORKLOG.md) records key decisions, mistakes, corrections, and actual verification.

## Prerequisites

| Requirement | Needed for | Notes |
|---|---|---|
| Node.js 20.12+ and npm | Root scripts, Playwright, and local performance mock | Gemini loading uses Node's `process.loadEnvFile`; use a current supported Node.js LTS release. |
| Internet access | Playwright demo tests and live Gemini calls | Needed to reach the configured demo shop/API or Gemini service; not needed for CSV reconciliation. |
| Chromium browser | Playwright UI tests | Install the project-managed browser using the command below. |
| Valid demo-shop test credentials | Authenticated Playwright UI tests | Supply locally; never commit credentials or generated authentication state. |
| k6 CLI | Running Part D load profiles | Separate CLI installation; not an npm dependency. Node-side mock/tests do not require k6. |
| `GEMINI_API_KEY` | Live Part E explanation | Required only when calling Gemini; keep it in the root `.env`. |
| Java and valid `JAVA_HOME` | Generating an Allure report | Optional; ordinary Playwright execution and HTML reporting do not require Allure generation. |

Parts are isolated: root `.env` is for Gemini, `playwright/.env` is for demo credentials/configuration, and `performance/.env` is for the local mock target and workload. Create only the files needed for the part being run. All `.env` files, credentials, session state, and generated Playwright/performance results must remain local and are Git-ignored.

## Setup and Execution

Run these from the repository root. Install root dependencies for reconciliation and AI; install Playwright dependencies and Chromium only if running Part B:

```powershell
npm install
npm install --prefix playwright
npx --prefix playwright playwright install chromium
```

Create a local environment file only when needed, without overwriting an existing one:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path playwright\.env)) { Copy-Item playwright\.env.example playwright\.env }
if (-not (Test-Path performance\.env)) { Copy-Item performance\.env.example performance\.env }
```

Then fill in only the required local values: `GEMINI_API_KEY` in root `.env` for Part E, and valid `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `playwright/.env` for authenticated Part B UI tests. Part D defaults to the localhost mock and requires no secret. Do not enable remote performance targets for public demo websites.

| Part | Run from repository root unless noted | Prerequisite/configuration |
|---|---|---|
| A | Review [`STRATEGY.md`](./STRATEGY.md) | No runtime setup |
| B | Use the Playwright commands in the section above | Playwright dependencies, Chromium, and demo credentials for authenticated UI tests |
| C | `npm run reconcile`, then `npm run report` | Root `npm install`; input CSV files in `data/` |
| D | In `performance/`: `npm run mock`; in a second terminal run `k6 version` and `npm run perf:baseline:pre` or `npm run perf:load:pre` | Node dependencies are not separate; k6 CLI required for load runs |
| E | `npm run ai:explain` | Root dependencies, existing/generated reconciliation findings, and `GEMINI_API_KEY` |

For Part C, run reconciliation before report generation. For Part E, ensure reconciliation has generated findings first. For Part D, start the mock in one terminal and run k6 commands from `performance/` in another. Exact component setup and run instructions are in [`playwright/README.md`](./playwright/README.md) and [`performance/README.md`](./performance/README.md).

## GitHub Actions

Three independent workflows are available under the **Actions** tab:

| Workflow | Triggers | What it runs and stores |
|---|---|---|
| **Playwright tests** | Push, pull request, or manual dispatch | TypeScript checks and read-only API tests run without secrets. Authenticated UI tests run only on pushes and manual dispatches when both `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` repository secrets are configured; they are explicitly skipped on all pull requests and when either secret is missing. HTML reports and screenshot failure evidence are uploaded as run artifacts; authentication state and trace archives are not uploaded. |
| **Reconciliation tests** | Push, pull request, or manual dispatch | Runs `npm run reconcile` and `npm run report`, then validates the generated finding IDs and report consistency. The seeded findings are expected. `defects.json` and `DEFECT_REPORT.md` are uploaded as run artifacts. |
| **AI quality analysis** | Manual dispatch only | Regenerates deterministic findings. Optionally enable **Run live Gemini analysis**; this requires the `GEMINI_API_KEY` repository secret. Validated AI output is not uploaded because it contains case-level evidence. |

To configure secrets, add the Playwright credentials and, if using live AI analysis, `GEMINI_API_KEY` in the repository's **Settings → Secrets and variables → Actions**. To run a workflow manually, open **Actions**, select its workflow, choose **Run workflow**, and confirm the branch; for AI analysis, leave the live option disabled unless the Gemini secret is configured. Download available reports from the run's **Artifacts** section. Workflows use read-only repository permissions, and a successful skipped UI job does not mean authenticated UI tests ran.

## Results and Reports

| Artifact | Location / availability |
|---|---|
| Test strategy | [`STRATEGY.md`](./STRATEGY.md), tracked |
| Reviewer defect report | [`DEFECT_REPORT.md`](./DEFECT_REPORT.md), tracked |
| Deterministic JSON findings | `reconciliation/output/defects.json`, tracked |
| Validated Gemini analysis | `ai/output/ai-analysis.json`, tracked |
| Playwright HTML report | Generated at `playwright/playwright-report/`; Git-ignored, regenerate with Playwright tests |
| Allure results/report | CI Allure results are under `playwright/allure-results/`; generated outputs are Git-ignored and require Java to build a report |
| k6 summaries/comparisons | `performance/results/`; Git-ignored and created only after actual k6 runs |
| AI usage and verification history | [AI_WORKLOG.md](./AI_WORKLOG.md), root-level project log |

Do not treat absent or ignored result artifacts as execution evidence; rerun the relevant command to generate local reports.

## Assumptions and Limitations

- No actual Celonis OMS/Analytics environment or authorized integration API is available.
- Playwright uses a representative third-party demo shop and a separately documented, read-only demo products API; it is not exercising Celonis.
- k6 targets a bounded localhost mock. Its acceptance/completion simulation is not real Analytics ingestion or enterprise capacity.
- Performance SLO proposals are illustrative and require business agreement and real telemetry.
- Deterministic reconciliation is the pass/fail authority; Gemini explanations do not replace it.
- CustomerName normalization and DeliveredDate/event timestamp correspondence include the assumptions documented in [STRATEGY.md](./STRATEGY.md) and [DEFECT_REPORT.md](./DEFECT_REPORT.md).
- Allure generation depends on a working Java installation; local video is disabled due to the host's FFmpeg application-control restriction.

## Future Improvements

- Add coverage from risk-prioritized scenarios and authorized integration contracts when available.
- For an authorized performance environment, add measured ingestion lag, server/resource telemetry, and batch reconciliation.
- Extend CI report publishing and authorized integration coverage as repository hosting and credentials permit.
