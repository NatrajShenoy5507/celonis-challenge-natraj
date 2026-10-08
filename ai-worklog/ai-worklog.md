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
- **AI contribution:** ChatGPT assisted with implementing the requested rules in the existing reconciliation script. No timestamp, duplicate, or process-flow validation was added.
- **Verification:** Ran `npm run reconcile` against the supplied CSVs. It reported an amount mismatch for `ORD-1007`, currency mismatches for the four `ORD-1008` events, and a negative OMS amount for `ORD-1014` (`-500.00`). The normalized `ORD-1015` customer name produced no mismatch. The Cart order was not flagged for missing Analytics events.