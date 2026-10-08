# AI Work Log — Celonis Quality Challenge

## Work completed so far

- Reviewed the challenge requirements in the provided DOCX and used ChatGPT to help clarify the business requirements and expected outcomes.
- Added a Playwright MCP server configuration to the project for use in future browser automation and testing work.
- Created the project README based on my current understanding of the challenge and its work areas.
- Reviewed the AI-generated implementation plan based on the challenge DOCX, then used AI to create `PROJECT_IDEA.md` as project context for the IDE, covering the project goal, inputs, expected outputs, and requirements.

### AI contribution details

- **Tool used:** ChatGPT
- **Purpose:** Turn the reviewed challenge plan into a project document that gives the IDE context about what the project should do and what it should produce.
- **Prompt summary:** Create a project document from the challenge plan that explains the project, its inputs, outputs, and expectations. This is a summary, not the exact prompt.
- **AI output:** A project overview and implementation plan in `PROJECT_IDEA.md`.
- **Accepted:** The document's description of the Order Management System to Analytics integration, challenge parts, and expected deliverables.
- **Rejected or corrected:** No specific AI suggestions were rejected or corrected as part of this step.
- **Verification:** Reviewed the generated plan and project document against the challenge requirements in the provided DOCX.

## Reconciliation work completed so far

- Set up the Part C reconciliation program in plain JavaScript with Node.js and added `csv-parse` to load `data/orders.csv` and `data/analytics_event_log.csv` using the first row as headers.
- Added the `npm run reconcile` command and verified it reports 20 OMS orders and 67 Analytics events.
- Added a per-order summary matching Analytics `CaseId` to OMS `OrderId`, including each order's status and matching event count.
- Added the `ORDER_PLACED_EXISTS` completeness rule: every non-Cart OMS order must have at least one `Order Placed` event. Cart orders are excluded because they are not expected to sync.
- Added the `ANALYTICS_CASE_MUST_EXIST_IN_OMS` referential-integrity rule: each unique Analytics `CaseId` must match an OMS `OrderId`. Orphan IDs produce one structured finding each, even if multiple events use that ID.
- Kept findings in an in-memory array and printed them as JSON; no findings file or additional validation rules have been added.

### AI contribution details

- **Tool used:** ChatGPT
- **Purpose:** Assist with the initial JavaScript CSV-loading setup and incrementally implement the requested OMS-to-Analytics relationship summary and two reconciliation rules.
- **Prompt summary:** Load both provided CSVs, report counts and per-order event counts, then add completeness and referential-integrity checks with structured findings. This is a summary, not the exact prompts.
- **AI output:** Changes to the reconciliation script and npm setup, plus explanations of the matching and rule logic.
- **Accepted:** Simple Node.js code using `csv-parse`, `Array.filter`/`Array.some`, and `Set` for unique IDs; findings remain in memory as requested.
- **Rejected or corrected:** No additional validation rules or framework abstractions were introduced. Cart orders are explicitly excluded from the completeness check, and orphan findings are deduplicated by `CaseId`.
- **Verification:** Ran `npm run reconcile`. It reported 20 orders and 67 events, one completeness finding for `ORD-1006`, and one referential-integrity finding for `ORD-9999` despite multiple events for that case. The Cart order `ORD-1014` was not flagged.

### Attribute and source-data validation

- Added per-event attribute checks for OMS and Analytics amounts, currencies, and customer names. Customer names are compared after trimming and lowercasing only; amounts are compared numerically.
- Added the `ORDER_AMOUNT_NON_NEGATIVE` source-data rule, checking OMS `OrderAmount` directly and creating a finding for each negative value.
- **AI contribution:** ChatGPT assisted with implementing the requested attribute and source-data rules in the existing reconciliation script. Timestamp, duplicate, and process-flow validation were not part of this implementation step.
- **Verification:** Ran `npm run reconcile` against the supplied CSVs. It reported an amount mismatch for `ORD-1007`, currency mismatches for the four `ORD-1008` events, and a negative OMS amount for `ORD-1014` (`-500.00`). The normalized `ORD-1015` customer name produced no mismatch. The Cart order was not flagged for missing Analytics events.

### Temporal and process validation

- Added Analytics timestamp parsing, UTC representation checks, and future-timestamp detection. `VALIDATION_AS_OF` can be set to a fixed date/time for reproducible runs; otherwise the current time is used.
- Added duplicate activity detection per OMS order and exact lifecycle conformance checks for each OMS status, including both supported Returned paths.
- Skipped process-conformance validation for non-Cart orders with no Analytics events because the completeness rule already reports the missing data. Cart orders continue to be checked against an empty lifecycle flow.
- Added a temporal sequence check that compares activity timestamps in business-process order when the required activities occur exactly once and have valid timestamps.
- Added `DELIVERED_TIMESTAMP_MATCH` as a separate temporal rule. It compares the OMS `DeliveredDate` with the sole Analytics `Order Delivered` timestamp for Delivered orders. This is documented in code as a derived assumption; no CreatedDate comparison was added.
- **AI contribution:** ChatGPT assisted with the requested temporal and process rules and explained their behavior. No unrelated validation rules were introduced.
- **Verification:** Ran `npm run reconcile`. The supplied data produced the expected future-timestamp finding for `ORD-1018`, sequence and process findings for `ORD-1010`, duplicate activity for `ORD-1011`, and DeliveredDate mismatches for `ORD-1009` and `ORD-1010`. `ORD-1006` received the completeness finding without a redundant process-conformance finding, and the valid direct-return path for `ORD-1016` was accepted.
- **Commit:** `18578f0` — `Add lifecycle and temporal reconciliation checks`.

### Findings output

- Assigned each finding a unique sequential ID in `DATA-001` format after all validation rules complete.
- Added automatic creation of `reconciliation/output/` and wrote the complete findings array to `reconciliation/output/defects.json` as two-space-indented JSON.
- Replaced verbose console output with a summary of OMS order count, Analytics event count, total findings, unique affected CaseIds, and the output file path.
- **AI contribution:** ChatGPT assisted with implementing the reporting and output-file behavior without changing validation rules.
- **Verification:** Ran `npm run reconcile`. It reported 20 OMS orders, 67 Analytics events, 17 findings, and 11 unique affected CaseIds. Confirmed the generated JSON contains sequential IDs from `DATA-001` to `DATA-017`.

### Reviewer-facing defect report generation

- Added `reconciliation/src/generate-defect-report.js` and the `npm run report` command to generate the root-level `DEFECT_REPORT.md` from `reconciliation/output/defects.json`.
- Grouped raw findings only by the combination of `caseId` and `rule`, assigning sequential reviewer-facing `DEFECT-###` IDs while retaining the associated raw `DATA-###` IDs.
- Included expected and actual evidence, category, severity, business impact, detection method, expected-behavior notes, and the DeliveredDate semantic-equivalence assumption.
- Preserved `defects.json` as the source of truth; the generator reads it and does not modify it.
- **AI contribution:** ChatGPT assisted with the straightforward Node.js report generator, npm script, and concise human-readable report.
- **Verification:** Ran `npm run report`; it grouped 17 raw findings into 14 defects. Confirmed all raw finding IDs are present, the four `ORD-1008` currency findings are grouped, distinct rules for the same case remain separate, and both required report sections are generated.

## Part E — AI-assisted anomaly explanation

- Added `ai/anomaly-explainer.js` to read only `reconciliation/output/defects.json` and summarize finding totals, unique CaseIds, counts by category, and counts by severity. The deterministic reconciliation engine remains the source of truth; Gemini does not read the raw CSV files or make pass/fail decisions.
- Added Gemini integration using `GEMINI_API_KEY` from the environment. The prompt sends the deterministic findings and derived summary metadata, requesting explanations, root-cause hypotheses, business impacts, investigation steps, and an overall summary as structured JSON.
- Added response guardrails: require every deterministic finding exactly once; reject unknown finding IDs and CaseIds, mismatched finding-to-case references, missing or malformed fields, and investigation steps that are not arrays of strings. Root-cause entries must be labeled `Hypothesis:` and cannot alter deterministic severity or decisions.
- Added `.env.example` with the key name only, ensured `.env` is ignored by Git, and configured the script to load a project-root `.env` file when present. The key value is not logged.
- After response validation, save the analysis as indented JSON in `ai/output/ai-analysis.json`. Added the `npm run ai:explain` command and a short execution summary.
- **AI contribution:** ChatGPT assisted with building the Gemini request, structured response handling and validation, environment configuration, and analysis output.
- **Verification:** Mocked tests accepted a valid response and rejected unknown CaseIds, unknown finding IDs, missing required fields, non-array investigation steps, and unlabeled root-cause hypotheses. Then ran `npm run ai:explain` with the local environment configured; it wrote the response successfully. Verified the output includes all 17 deterministic finding IDs, has no unknown CaseIds, and labels all root-cause hypotheses. No API key value was recorded in this log.

### Part E semantic review and case-level analysis

- **Review finding:** Reviewed the initial Gemini response and identified semantic problems beyond JSON shape: it analyzed findings individually rather than combining related findings by case, included unsupported business behavior, speculated about trusted OMS source data, and used severity-like language not grounded in deterministic severity.
- Updated the request to group source findings by `caseId` and ask for exactly one `caseAnalyses` object per unique affected case, listing that case's raw finding IDs. The deterministic findings remain the source of truth.
- Strengthened prompt guardrails to treat supplied status and expected/actual values as immutable, prohibit contradictory hypotheses and unsupported business concepts, limit hypotheses to three concise integration-mechanism possibilities, and avoid severity reinterpretation.
- Strengthened validation to require exact case coverage and exact finding-ID coverage per case, reject unknown or misassigned IDs, enforce one analysis per case, cap and label hypotheses, reject unsupported behavior and severity language, and restrict hypotheses to integration mechanisms rather than blaming OMS source data.
- **Verification:** Mocked valid case-grouped analysis was accepted. Mocked missing/unknown cases, unknown or misassigned finding IDs, excess or unlabeled hypotheses, unsupported business behavior, source-data blame, and unsupported severity language were rejected.
- **Live Gemini result:** Attempts to regenerate the analysis under the new semantic constraints were rejected because Gemini returned content that violated them. The response validator was not weakened. `ai/output/ai-analysis.json` still contains the earlier case-grouped response and has **not** been refreshed or validated against the latest semantic guardrails.
- **Latest observed live failure:** Gemini used “critical” to describe case `ORD-1010`, which has no deterministic CRITICAL finding. This confirmed that prompt instructions alone were insufficient; deterministic output validation must fail closed.
- Added an explicitly severity-neutral prompt: severity is immutable, the AI schema has no severity field, and generated prose must not use CRITICAL/HIGH/MEDIUM/LOW as qualitative defect labels or describe a defect as a “critical failure.” Impact should be described factually.
- Added a controlled retry with a maximum of two Gemini attempts. If `validateAiResponse()` fails, the script logs only the validation message, adds corrective feedback before the deterministic input, and retries once. Both responses use the same guardrails; only a validated response is saved. A second validation failure stops clearly and leaves the existing analysis file untouched. API keys are never logged.
- **Verification:** Mocked the first attempt failing validation followed by a valid second response; confirmed the retry prompt includes corrective feedback, the retry is validated, and output is written only after success. Also tested two failed attempts and confirmed there is no third request and no output write. No live Gemini request was made during this retry implementation.
- **Latest semantic issue:** A live Gemini response proposed that trusted OMS values might be incorrect for `ORD-1007` and `ORD-1008`. The prompt now explicitly prohibits describing OMS values as wrong, stale, changed, delayed, or needing correction, and validation rejects such claims across generated case text.
- Added category-specific root-cause mechanism allowlists to each case's deterministic input. The response now returns `rootCauseMechanisms` as an array of enum values instead of free-text hypotheses. Mixed-category cases receive the deduplicated union of their categories' mechanisms; SOURCE_DATA-only cases have no allowed mechanisms and must return an empty array.
- Kept the existing OMS source-of-truth, case/finding grounding, severity checks, and two-attempt fail-closed retry. Gemini's schema enum limits mechanism values globally, and validation checks each value against that case's allowlist. This avoids trying to validate speculative root-cause prose and prevents Gemini from suggesting OMS evidence needs correction.
- **Verification:** Mocked checks accepted a category-allowed mechanism, confirmed the mixed TEMPORAL/PROCESS mechanism union is deduplicated, rejected a mechanism disallowed for a TEMPORAL-only case, and rejected a non-empty mechanism array for a SOURCE_DATA-only case. Failure cases used exactly two attempts and did not write the output file. No live Gemini request was made for this change.
- **Completion status:** The Part E Gemini integration is implemented. It reads only deterministic `defects.json`, groups findings by case, returns case-level explanations plus category-constrained root-cause mechanism enums, validates output against deterministic case/finding IDs and immutable OMS evidence, and writes only a validated response. The maximum of two attempts and fail-closed behavior are retained.
- Constrained enums are more reliable than unrestricted root-cause prose because the validator can directly compare each mechanism with that case's allowed list, rather than trying to infer whether free text questions trusted OMS evidence.
- Regenerated `ai/output/ai-analysis.json` using the current mechanism-only response schema. Verified offline that all 17 deterministic findings across 11 cases are represented exactly once, all mechanisms are allowed for their case categories, and SOURCE_DATA-only cases have no mechanisms.

## Part A — Test strategy and scenario documentation

- Created the correctly named root-level `STRATEGY.md` as the Part A deliverable specified by `PROJECT_IDEA.md`.
- Read `data/Test cases.xlsx` directly and preserved all 20 workbook scenarios in the six-column scenario table. All scenario IDs were already present and unique (`OMS-01` through `OMS-20`); no scenario was removed or merged.
- Added the requested objective, three test layers, risk prioritization, relevant techniques, measurable test-oracle guidance, a separate OMS status-to-Analytics mapping table, one-hour risk focus, assumptions/limitations, and execution notes.
- Cleaned spelling and grammar without materially changing scenario intent. Reclassified the workbook's Database-labeled missing-field and sync-failure cases as API / Integration based on what they test. Preserved assigned priorities; OMS-20 remains unassigned because its workbook priority is blank.
- Documented the derived assumption that OMS `DeliveredDate` matching Analytics `Order Delivered.Timestamp` is based on semantic equivalence, not an explicitly guaranteed contract.
- **AI contribution:** ChatGPT assisted with reading and organizing the workbook's scenarios into a concise, interview-defensible strategy aligned with the project context.
- **Verification:** Confirmed the Markdown scenario table has 20 rows, 20 unique IDs, and six columns. The Excel workbook was read only and not modified.

## Part B — Playwright framework foundation

- Created a separate root-level `playwright/` TypeScript project with its own `package.json`, lockfile, dependencies, Playwright configuration, TypeScript configuration, and `.env.example`. This keeps Playwright dependencies isolated from the root reconciliation and AI packages.
- Added the initial framework layers described in `PLAYWRIGHT_FRAMEWORK_SKELETON.md`: typed environment configuration, a JSON test-data provider and factory, a custom fixture, and a reusable Playwright API-client abstraction.
- Inspected the supplied `https://shop.qaautomationlabs.com/index.php` using Playwright MCP. The site exposes a demo-account autofill control and stable `data-testid` locators for sign-in, product filters/cards, cart actions, and navigation. Per the revised framework skeleton, the implementation uses valid credentials from typed `.env` configuration rather than relying on the autofill control.
- Added a login Page Object and setup project that reads valid credentials from typed configuration loaded from `playwright/.env`; no credentials are hard-coded. Added a `SessionManager` that validates cached state shape and reuses local storage state only when its metadata is younger than the configurable 12-hour default and a protected shop page confirms authentication. Missing, stale, invalid, or CI state is freshly authenticated. The generated `user.json` and `session-meta.json` remain ignored.
- Added authenticated custom fixtures and Page Objects for the shop, electronics, and cart. Normal UI test specs contain zero application locator definitions. UI tests cover authenticated shop access, filtering electronics to laptops, and adding/removing a product from the cart; the cart test removes its test data even if an assertion fails.
- The shop links to `https://api.qaautomationlabs.com/`, whose published OpenAPI JSON documents a products endpoint. Added a separate API project and read-only `GET /products` contract check for a successful JSON response containing products with typed core fields; no undocumented endpoint was assumed.
- Configured separate API and Chromium projects, local HTML reports, CI Allure results/retries, and smoke/regression tags. Ignored generated reports, test results, local environment files, authentication state, and Playwright MCP output.
- Configured video retention for CI. Disabled local video because the Windows application-control policy blocks Playwright's bundled FFmpeg executable and otherwise causes context teardown to fail. Failure screenshots and first-retry traces remain enabled.
- Updated the framework to match the revised locator, credential, and session policies: browser test specs contain no application locators, credentials are centrally validated with no fake defaults, and local auth reuse checks both TTL metadata and live authenticated access. Added the Allure report-generation command.
- **AI contribution:** ChatGPT assisted with setting up the isolated project and framework foundation from the supplied framework skeleton.
- **Verification:** Installed project-local dependencies and Chromium. `npm run typecheck --prefix playwright` passed; test discovery found six tests across setup/UI/API; `npm test --prefix playwright` passed all six tests, including the valid local cached-session path. Confirmed the UI test specs contain no locator definitions and that `.env` and both storage-state files are ignored. The Allure CLI is installed, but generating the report could not be validated because the host's `JAVA_HOME` points to a nonexistent directory. No credentials or session contents were printed.
- **Local test follow-up:** Followed `.github/instructions/playwright.instructions.md` by running the auth setup, each UI scenario, and the API test individually, then the smoke, regression, and complete suites. All passed. A final review found the fresh-auth path should ensure the ignored auth directory exists before Playwright writes its first storage state; added that directory preparation and reran the full suite successfully (6/6). Rechecked that UI specs contain no application locators. Playwright MCP was used to re-inspect the sign-in page; no application or locator mismatch was found.

## Journey so far

1. Reviewed the challenge brief and translated the OMS-to-Analytics business requirement into a project plan and IDE context document.
2. Built Part C incrementally: CSV loading, OMS-to-Analytics event summaries, completeness and referential-integrity checks, attribute and source-data validation, temporal and lifecycle checks, and deterministic finding IDs.
3. Persisted the deterministic results to `reconciliation/output/defects.json` and generated a reviewer-facing `DEFECT_REPORT.md` from those findings without changing the raw findings.
4. Started Part E with a findings-only summary, then connected Gemini to the deterministic output. Gemini receives findings and derived metadata—not the source CSVs—and is intended only to explain confirmed findings and offer clearly labeled hypotheses and investigation guidance.
5. Completed the Part E Gemini integration with structural and semantic guardrails so AI output cannot replace deterministic validation. A live response that described `ORD-1010` as “critical” despite there being no deterministic CRITICAL finding was rejected. The latest implementation uses case-category-specific root-cause mechanism enums and one corrective retry while preserving fail-closed validation; `ai/output/ai-analysis.json` is updated only when a complete response passes all checks.
6. Created `STRATEGY.md` from all 20 workbook scenarios as the Part A test strategy, aligned with `PROJECT_IDEA.md`; preserved the manually assigned priorities and left the Excel source unchanged.
7. Set up an isolated TypeScript Playwright framework under `playwright/`, inspected the supplied shop and its linked documented API, and aligned it with the revised skeleton: typed `.env` credentials, validated 12-hour local session cache, authenticated fixtures, locator-free UI specs, separate API coverage, and Allure reporting. The six-test suite and TypeScript check pass; CI captures failure video, while local video is disabled because policy blocks FFmpeg.

## Part D — Local k6 performance framework

- **AI contribution:** Copilot assisted with translating `K6_FRAMEWORK_BUILD_INSTRUCTIONS.md` into an isolated `performance/` project: a localhost-only mock sync API, validated `.env` configuration, baseline/load and optional stress/soak k6 profiles, a safe runner, pre/post comparison, tests, and the Part D runbooks.
- **Accepted:** OMS-to-Analytics performance can only be measured against an authorized real environment; this repository has none. The executable mock therefore binds to loopback, bounds its in-memory order store, validates fictional payloads, returns HTTP 202 for acceptance, and exposes asynchronous processing separately. The runner blocks remote targets unless explicitly authorized and never includes tokens in saved metadata.
- **Corrected or constrained:** The initial verification pass caught a JavaScript template-literal syntax error in the comparison report; it was fixed before continuing. The performance documentation distinguishes `ramping-vus` concurrency from request arrival rate and treats 202 acceptance separately from completed ingestion. Thresholds are labeled illustrative, not official SLIs/SLOs. No result fixtures are saved or presented as measurements.
- **Verification:** Ran `npm test` in `performance/`; all 4 Node tests passed, covering mock health/accept/reject/duplicate/capacity/status/metrics behavior, invalid configuration, remote-target blocking, and comparison calculations with in-memory test fixtures. `node --check` passed for the Node scripts and k6 script syntax. Confirmed `npm run perf:baseline:pre` fails clearly because the k6 CLI is not installed. No k6 workload, remote target, public website, real OMS, or Celonis endpoint was tested. Actual k6 summaries and pre/post comparisons remain unverified until k6 is installed and runs are performed against the local mock.

## Repository skills for Playwright and k6

- Added repository-scoped Copilot Agent Skills under `.github/skills/` to make recurring Playwright and k6 workflows available through explicit, on-demand commands rather than relying only on ad hoc chat prompts.
- `playwright-test-generation` covers targeted Playwright test creation, debugging, execution, and review. It directs Copilot to inspect the existing TypeScript framework, use Playwright MCP when inspecting browser behavior, preserve locator ownership and authentication/data rules, run relevant verification, and record material work in this log. It explicitly does not rebuild the framework or run automatically when Playwright files are merely mentioned.
- `k6-performance-review` covers user-triggered baseline/load performance runs and comparisons. It uses the existing configured workload and runner, preserves actual run evidence, prevents unapproved remote/public-site tests, does not run stress/soak implicitly, distinguishes mock acceptance from real Analytics ingestion, and records actual commands, results, and limitations here.
- **AI contribution:** Copilot helped organize the project's repeatable Playwright and k6 workflows as repository skills so future work can follow consistent safety, implementation, verification, and audit-trail steps.
- **Verification and repository-state note:** Reviewed both skill definitions and the current worktree; no tests were run for this documentation-only update. The root-level `K6_FRAMEWORK_BUILD_INSTRUCTIONS.md` and `PLAYWRIGHT_FRAMEWORK_SKELETON.md` are still present in the inspected worktree, and the skill definitions still refer to legacy framework material. Therefore, the migration is represented as the new skills-based workflow, but physical removal or full consolidation of those older documents was not confirmed in this update.

### Part D strategy refinement

- Updated the existing root `PERFORMANCE.md` with the human-provided practical approach: evidence-based endpoint/workload selection, baseline-to-peak ramp-up with an explicitly proposed (not universal) 30% headroom scenario, recovery observation, client-side versus infrastructure monitoring, evidence-led error investigation, and end-to-end OMS-to-Analytics reconciliation.
- Preserved the local mock scope, existing baseline/load/stress/soak profile descriptions, pre/post comparison guidance, configuration and illustrative thresholds, limitations, and AI-first approach. No configured workload values, thresholds, executable code, or performance measurements were changed or added.
- **Verification:** Reviewed the existing performance runbook and `.env.example` to confirm the documentation continues to describe the current commands/settings and does not imply arrival-rate execution, infrastructure telemetry, or real downstream ingestion is implemented. This documentation-only change does not require tests.

## Main README project overview and setup

- Updated the root `README.md` from the repository's actual implementation to provide an interviewer-facing overview of the OMS-to-Analytics challenge and Parts A-E. Added an architecture diagram that distinguishes CSV reconciliation from representative demo-site Playwright testing and the localhost-only k6 mock.
- Documented the existing Part A scenario count, Part B Playwright capabilities and commands, Part C rules and observed generated finding/defect counts, Part D profiles/configuration/limitations, Part E Gemini guardrails and invocation, AI-assisted workflow, generated artifact locations, assumptions, and realistic future improvements.
- Expanded prerequisites and setup with the actual root, Playwright, and performance package scripts; browser, demo credentials, k6 CLI, Gemini key, and optional Java requirements; and safe PowerShell `.env` creation that does not overwrite existing local files. No secret values were included.
- **Verification:** Inspected the referenced package scripts, configs, source files, documented outputs, and generated reconciliation/AI JSON. Confirmed all 24 relative Markdown links resolve and all 18 documented npm script names exist in the relevant package manifests; scanned the README for secret-like values and found none. `git diff --check` passed. No tests were run because this was documentation-only.

## Work-log location update

- Moved this log from `ai-worklog/ai-worklog.md` to the repository root as `AI_WORKLOG.md`, matching the project documentation and skill references. Updated the README links and artifact listing to the new path.
- **Verification:** Confirmed the old file path no longer exists, the root file exists, and all README relative links resolve. No active references to the former location remain; it is mentioned here only to record the move.

## Part E artifact documentation and TypeScript configuration

- Created `ai/README.md` from the implemented Gemini explainer, reconciliation findings, root package scripts, environment template, existing AI output schema, and project work log. It documents the deterministic-to-AI flow, guarded output, safe setup and exact run commands, the current response shape, and human-review/production limitations.
- Clarified that SOURCE_DATA-only cases have no allowed integration root-cause mechanisms, while mixed-category cases can use mechanisms allowed by their other finding categories. Added a direct Part E documentation link in the root `README.md`.
- Corrected the Playwright TypeScript configuration from deprecated `moduleResolution: "Node"` to matching `Node16` module and resolution modes in response to the TypeScript deprecation warning.
- **Verification:** Confirmed all relative Markdown links in the root and Part E READMEs resolve; reviewed the docs against actual guardrail code, package scripts, environment template, and JSON artifact. Playwright typecheck passed with the updated config, and VS Code reported no problems. No Gemini request or test suite was run for these documentation/configuration updates.

## Modular GitHub Actions CI workflows

- Added independent Playwright, reconciliation, and AI-quality workflows under `.github/workflows/`, using least-privilege read-only repository permissions and Node.js 22.
- The Playwright workflow typechecks and runs read-only API tests without credentials. Authenticated UI tests are gated away from pull requests and require both `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` secrets on pushes or manual runs. CI keeps the configured retry, trace, screenshot, and video behavior; artifacts exclude authentication state and trace archives.
- The reconciliation workflow runs the existing `npm run reconcile` and `npm run report` commands, validates the generated finding IDs and report grouping, and uploads the deterministic JSON findings and Markdown report. Seeded defects are treated as expected test data.
- The manually dispatched AI workflow regenerates deterministic findings first. Live Gemini execution requires an explicit input and `GEMINI_API_KEY`; validated AI output is not uploaded because it contains case-level evidence. The repository has no existing runnable offline/mock AI guardrail-test command, so none was invented.
- Added a concise GitHub Actions section to the root README describing triggers, secrets, skipped authenticated UI behavior, artifacts, and manual dispatch.
- **Verification:** Parsed each workflow as YAML and checked event triggers, secret gating, and declared permissions. Confirmed workflow `npm run` commands exist in the relevant package manifests and README relative links resolve. Playwright TypeScript checking passed. Ran reconciliation and report generation, then checked all 17 sequential finding IDs, required fields, report inclusion, and the 14 grouped-defect summary; restored generated output afterward so only the intended documentation and workflow files remain changed. `git diff --check` passed. No GitHub Actions run, authenticated UI run, or live Gemini request was performed.

## Gemini validation failure and reliability improvements

- **Observed failure:** The live [AI quality workflow run](https://github.com/NatrajShenoy5507/celonis-challenge-natraj/actions/runs/37841580348) returned an OMS-blaming explanation for `ORD-1008` on attempt 1, then a root-cause mechanism disallowed for `ORD-1012` on the single corrective attempt. The production guardrails rejected both responses, the process failed after its two-attempt limit, and no new AI analysis was saved. Deterministic findings, severities, reconciliation rules, and defect evidence were not changed.
- Strengthened system and user prompt instructions to preserve OMS expected evidence verbatim, describe observed downstream Analytics mismatches rather than assert unobserved causes, avoid invented business behavior, and preserve exact case and finding IDs.
- Replaced the model-facing global mechanism enum with a schema keyed by exact case IDs. Each case has its own finding-ID enum and, where options exist, a root-cause-mechanism enum derived from its findings. Since JSON Schema enums cannot be empty, cases without allowed mechanisms receive an explicit schema description and prompt requiring an empty array; server-side validation rejects any mechanism for those cases. The API response is normalized to the existing persisted `caseAnalyses` array shape, so consumers of `ai-analysis.json` retain the same format. The maximum of two Gemini attempts and fail-closed behavior are unchanged.
- Added isolated Node built-in tests that execute the real explainer in a temporary directory with mocked Gemini responses and block all non-Gemini network requests. The tests cover a corrected retry after OMS-blaming text, per-case schema restrictions and exact IDs, rejection of unsupported business behavior, final invalid-mechanism rejection with no output persisted after exactly two attempts, and empty mechanisms for a `SOURCE_DATA`-only case.
- Updated the AI-quality workflow so deterministic reconciliation and offline mocked-response tests run on pushes, pull requests, and manual dispatches without secrets. Live Gemini analysis remains an explicit manual opt-in and runs only after offline validation. Updated the root and Part E READMEs with workflow behavior and the offline test command.
- **Verification:** `node --test ai/test/anomaly-explainer.test.js` passed all 4 tests. `node --check` passed for the explainer and both test files. Parsed the workflow YAML and verified push/PR/manual offline triggers, explicit manual-only live gating, least-privilege `contents: read`, and no Gemini secret in the offline job. `git diff --check` passed. No live Gemini request was made during this fix.