# Part A — Test Strategy and Scenario Design

## 1. Objective

Validate the Order-to-Cash integration from the Order Management System (OMS) to the Analytics Event Platform. OMS is the source of truth; Analytics must represent its orders and lifecycle events accurately. An Analytics mismatch is not a reason to question or change a trusted OMS value. The highest priority is preventing silent corruption of financial, operational, and process-mining data.

## 2. Scope and Test Layers

### Frontend / UI

Validate important user-facing order-management flows, input validation, authorization, resistance to frontend tampering, and relevant security behavior such as safe handling of user-entered values. Use the UI for user-facing behavior, not as a substitute for testing every backend or data rule.

### Backend / API / Integration

Validate accepted and rejected sync/ingest requests, authentication and authorization, request/schema validation, retry and idempotency behavior, failure handling, and protection against unauthorized modification. For a successful request, verify the expected downstream Analytics event is actually produced. Endpoint URLs, headers, response codes, authentication schemes, and role names are not specified here.

### Data Validation

Reconcile OMS and Analytics for completeness, referential integrity, amounts, currencies, permitted CustomerName normalization, timestamps, duplicates, process conformance, Cancelled and Returned branches, and historical-data integrity.

## 3. Risk-Based Prioritization

- **P0:** Failures that can silently corrupt business data, financial reporting, lifecycle representation, or core synchronization. Examples include missing orders/events, amount or currency mismatches, orphan cases, invalid lifecycle or timestamps, duplicate events, and failed core sync.
- **P1:** Important validation, security, and negative-path scenarios outside the primary source-to-target business flow, such as malformed requests, authentication/authorization, UI security, and input validation.
All scenarios have an assigned P0 or P1 priority based on these risk definitions. OMS-01 through OMS-20 originate from the workbook; OMS-21 through OMS-23 are explicit additions to this Markdown strategy.

## 4. Test Techniques

The scenarios use risk-based prioritization, positive and negative testing, state-transition testing, source-to-target reconciliation, referential-integrity checks, temporal validation, contract/schema validation, security/authorization testing, idempotency/reliability testing, regression/data-integrity checks, and boundary-value analysis of the specified non-negative OrderAmount rule.

## 5. Test Oracle

A test oracle is the evidence or expected result used to determine whether a test passes or fails. For this integration, the oracle is the trusted OMS data together with the stated business contract. Each scenario below gives a measurable result; avoid accepting vague outcomes such as “works correctly.”

For example, a Delivered order passes the lifecycle check when Analytics contains exactly:

`Order Placed → Order Confirmed → Order Shipped → Order Delivered`

## 6. OMS Status to Analytics Mapping

| OMS Current Status | Expected Latest Analytics Activity |
|---|---|
| Cart | No Analytics events |
| Confirmed | Order Confirmed |
| Shipped | Order Shipped |
| Delivered | Order Delivered |
| Cancelled | Order Cancelled |
| Returned | Order Returned |

## 7. Prioritized Test Scenarios

OMS-01 through OMS-20 are transcribed from `data/Test cases.xlsx`; wording and layer labels are normalized for readability. OMS-21 through OMS-23 are reviewer-requested additions to this strategy only; the workbook is unchanged.

| ID | Layer | Scenario | Priority | Technique | Oracle / Expected Result |
|---|---|---|---|---|---|
| OMS-01 | Data | Verify each non-Cart OMS `OrderId` is represented by the corresponding Analytics `CaseId`. | P0 | Completeness / Referential integrity | Every non-Cart OMS `OrderId` has a matching Analytics `CaseId` with at least one `Order Placed` event. |
| OMS-02 | Data | Verify the current OMS order status is represented correctly in Analytics. | P0 | State transition / Reconciliation | The latest valid Analytics lifecycle activity corresponds to the OMS status using the mapping in Section 6; Cart orders have no Analytics events. |
| OMS-03 | Data | Verify OMS `OrderAmount` matches the amount on every corresponding Analytics event. | P0 | Data reconciliation | For every event where `CaseId = OrderId`, Analytics `Amount` equals the OMS `OrderAmount`. |
| OMS-04 | Data | Verify OMS currency matches the currency on every corresponding Analytics event. | P0 | Data reconciliation | For every event where `CaseId = OrderId`, Analytics `Currency` exactly matches OMS `Currency`. |
| OMS-05 | Data | Verify `CustomerName` matches after the allowed normalization. | P0 | Data reconciliation / Normalization | After trimming leading/trailing spaces and comparing case-insensitively, the names match exactly; spelling and word order are unchanged. |
| OMS-06 | Data | Verify Analytics lifecycle timestamps follow chronological order. | P0 | Temporal validation | Event timestamps are non-decreasing in lifecycle order; a later activity does not have an earlier timestamp than its predecessor. |
| OMS-07 | Data | Verify a Delivered OMS order has the complete Analytics lifecycle. | P0 | Process conformance / State transition | Analytics contains exactly `Order Placed → Order Confirmed → Order Shipped → Order Delivered`, with no missing or duplicate lifecycle steps. |
| OMS-08 | Data | Verify a Cart order is not synchronized to Analytics. | P0 | Negative / State transition / Reconciliation | While the OMS order remains Cart, no Analytics lifecycle events exist for its `OrderId`. |
| OMS-09 | Data | Verify every non-Cart order starts with `Order Placed` in Analytics. | P0 | Completeness / Sequence validation | The first Analytics lifecycle activity for each non-Cart OMS order is `Order Placed`. |
| OMS-10 | UI / API / Integration | Verify an unauthenticated user cannot access Analytics event logs. | P1 | Negative / Security testing | Access is denied and no event-log data is exposed; the exact response code depends on the actual system contract. |
| OMS-11 | Data | Verify a Cancelled OMS order is correctly tracked in Analytics. | P0 | Process conformance / State transition | Analytics contains `Order Placed → Order Confirmed → Order Cancelled`, with no later lifecycle activity. |
| OMS-12 | Data | Verify a Returned OMS order is correctly tracked in Analytics. | P0 | Process conformance / State transition | `Order Returned` follows a valid prior lifecycle, either `Placed → Confirmed → Shipped → Returned` or `Placed → Confirmed → Shipped → Delivered → Returned`. |
| OMS-13 | UI / API / Integration | Verify user-entered order and customer fields are protected against XSS. | P1 | Negative / Security testing | Script-like input is safely handled or escaped and does not execute when displayed. |
| OMS-14 | API / Integration | Verify frontend tampering cannot manipulate protected order data. | P0 | Negative / Security / Authorization | Client-side manipulation does not bypass backend validation or authorization; invalid or unauthorized changes are not persisted or synchronized to Analytics. |
| OMS-15 | Data / API / Integration | Verify retries do not create duplicate Analytics events. | P0 | Idempotency / Reliability | Retrying the same logical event results in only one valid lifecycle event in Analytics. |
| OMS-16 | Data / API / Integration | Verify a new order or sync does not alter previously synchronized, unrelated order data. | P0 | Regression / Data integrity | Existing OMS and Analytics records for unrelated orders remain unchanged after processing the new order or event. |
| OMS-17 | API / Integration | Verify a valid sync/ingest request is accepted. | P0 | Positive / Contract | The request is accepted according to the actual API contract and produces the expected downstream Analytics event. |
| OMS-18 | API / Integration | Verify a request missing a required field is rejected. | P1 | Negative / Schema validation | The invalid payload receives a contract-defined validation error and is not propagated. |
| OMS-19 | API / Integration | Verify transaction consistency when synchronization fails. | P1 | Failure / Consistency | A failed integration does not leave malformed or partially written target data. |
| OMS-20 | API / Integration | Verify an unauthorized user cannot modify an already-synchronized Analytics event. | P1 | Authorization / Data integrity | The unauthorized modification is rejected and the original Analytics event remains unchanged. |
| OMS-21 | Data / API / Integration | Verify the boundary conditions for OMS `OrderAmount`, including zero and negative values. | P1 | Boundary Value Analysis / Negative Testing / Data Validation | An `OrderAmount` of zero satisfies the specified non-negative amount rule. A negative `OrderAmount` violates the rule and is detected and reported as a source-data validation finding; no API rejection response is assumed unless explicitly defined by its contract. |
| OMS-22 | Data | Verify Analytics lifecycle event timestamps are not in the future. | P0 | Temporal Validation / Boundary Testing | Every Analytics event timestamp is valid UTC and is no later than the defined validation reference time. Any future-dated Analytics event is reported as a temporal data-quality defect. This checks against the reference time, not other event timestamps. |
| OMS-23 | Data | Verify every Analytics `CaseId` corresponds to an existing OMS `OrderId`. | P0 | Referential Integrity / Negative Data Validation | Every distinct Analytics `CaseId` matches an existing OMS `OrderId`; any unmatched `CaseId` is reported as an orphan record. Unlike OMS-01, this checks Analytics-to-OMS integrity. |

## 8. If I Had Only One Hour

I would first check:

1. Missing non-Cart orders or events.
2. Analytics `CaseId` values with no matching OMS `OrderId`.
3. Amount and currency mismatches.
4. Delivered lifecycle completeness and chronological order.
5. Duplicate or missing events.
6. Invalid or out-of-order timestamps, and timestamps later than the validation reference time.

These checks come first because synchronization can appear technically successful while silently producing inaccurate business reporting or process-mining data.

## 9. Assumptions and Limitations

- OMS is the source of truth, and `OrderId` is expected to correspond to Analytics `CaseId`.
- Cart orders do not synchronize to Analytics.
- The take-home does not provide access to the real OMS or Celonis systems.
- UI and API scenarios describe intended real-system validation; Part B demonstrates a representative automation slice.
- No undocumented endpoint URLs, headers, exact status codes, authentication schemes, or role names are assumed.
- CustomerName comparison permits only leading/trailing whitespace trimming and case-insensitive comparison; spelling and word order otherwise remain unchanged.
- Security scenarios assume relevant APIs and event-log interfaces are protected.
- Equality between OMS `DeliveredDate` and Analytics `Order Delivered.Timestamp` is a derived business assumption based on semantic equivalence, not an explicitly guaranteed contract.

## 10. Execution Notes

These scenarios define planned coverage; they do not imply that every test was executed against Celonis systems. Part C implements deterministic CSV reconciliation, Part B demonstrates Playwright UI/API automation, Part D covers performance testing, and Part E provides AI-assisted defect interpretation. Deterministic validation remains responsible for pass/fail.
