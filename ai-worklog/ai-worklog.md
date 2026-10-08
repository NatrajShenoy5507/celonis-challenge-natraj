# AI Work Log

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

## Journey so far

1. Reviewed the challenge brief and translated the OMS-to-Analytics business requirement into a project plan and IDE context document.
2. Built Part C incrementally: CSV loading, OMS-to-Analytics event summaries, completeness and referential-integrity checks, attribute and source-data validation, temporal and lifecycle checks, and deterministic finding IDs.
3. Persisted the deterministic results to `reconciliation/output/defects.json` and generated a reviewer-facing `DEFECT_REPORT.md` from those findings without changing the raw findings.
4. Started Part E with a findings-only summary, then connected Gemini to the deterministic output. Gemini receives findings and derived metadata—not the source CSVs—and is intended only to explain confirmed findings and offer clearly labeled hypotheses and investigation guidance.
5. Completed the Part E Gemini integration with structural and semantic guardrails so AI output cannot replace deterministic validation. A live response that described `ORD-1010` as “critical” despite there being no deterministic CRITICAL finding was rejected. The latest implementation uses case-category-specific root-cause mechanism enums and one corrective retry while preserving fail-closed validation; `ai/output/ai-analysis.json` is updated only when a complete response passes all checks.