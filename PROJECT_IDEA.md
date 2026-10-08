# Celonis AI Engineer – Quality Take-Home Challenge
## Overall Project Idea

## 1. Project Goal

This project demonstrates an end-to-end Quality Engineering approach for an **Order-to-Cash integration**.

The source system is an **Order Management System (OMS)** and the target system is an **Analytics Event Platform**.

The quality problem is simple:

> Orders and lifecycle events move from OMS to Analytics. The solution must prove that nothing is lost, invented, corrupted, duplicated, transformed incorrectly, or represented in the wrong process order.

The project is divided into five parts:

- **Part A – Test Strategy & Scenario Design**
- **Part B – Playwright Automation Framework**
- **Part C – Integration Data Reconciliation**
- **Part D – Performance & Load Test Design**
- **Part E – AI-First Quality Engineering**

---

## 2. Core Business Flow

The OMS is the **source of truth**.

Normal lifecycle:

```text
Cart
  ↓
Confirmed
  ↓
Shipped
  ↓
Delivered
```

Valid alternate terminal paths include:

```text
Confirmed → Cancelled
```

and:

```text
Shipped → Returned
```

or:

```text
Shipped → Delivered → Returned
```

The Analytics platform stores lifecycle activities such as:

```text
Order Placed
      ↓
Order Confirmed
      ↓
Order Shipped
      ↓
Order Delivered
```

The key relationship is:

```text
orders.csv: OrderId
        =
analytics_event_log.csv: CaseId
```

---

## 3. High-Level Architecture

```text
                         CHALLENGE PROJECT

                              Part A
                        Test Strategy / Scenarios
                                 │
                                 ▼
                       Defines what to test
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
       Part B                 Part C                 Part D
      Playwright            Reconciliation          Performance
      Framework               Engine                Strategy
                                 │
                                 ▼
                            defects.json
                                 │
                                 ▼
                              Part E
                         AI Anomaly Explainer
                                 │
                                 ▼
                         ai-analysis.json
```

---

# Part A – Test Strategy & Scenario Design

## Goal

Document **what should be tested, why it matters, how it will be validated, and what defines pass/fail**.

Part A covers:

- UI
- API
- Data

## Main Deliverable

```text
STRATEGY.md
```

## Example UI Areas

- Create a valid order
- Confirm an order
- Ship an order
- Deliver an order
- Cancel an order
- Return an order
- Reject invalid input such as a negative amount

## Example API Areas

- Valid sync request
- Missing/invalid authentication
- Missing mandatory fields
- Invalid schema
- Duplicate/retry handling
- Idempotency
- Error handling

## Example Data Areas

- Missing orders
- Orphan Analytics cases
- Amount mismatch
- Currency mismatch
- Customer-name normalization
- Invalid/future timestamps
- Duplicate events
- Invalid lifecycle sequence

## Risk Priority

Prioritize silent business-data corruption first:

1. Missing orders
2. Wrong amount
3. Wrong currency
4. Orphan cases
5. Invalid process lifecycle
6. Timestamp corruption
7. Duplicate events
8. Lower-risk UI issues

---

# Part B – Playwright Automation Framework

## Goal

Build a **small but modular Playwright framework** using a public demo application.

This part demonstrates automation architecture rather than testing the supplied CSV files.

## Technology

- Playwright
- JavaScript
- Node.js

## Suggested Structure

```text
playwright/
├── config/
├── fixtures/
├── pages/
├── api/
├── tests/
│   ├── ui/
│   └── api/
├── utils/
├── playwright.config.js
└── README.md
```

## Example UI Flow

```text
Login
  ↓
Select product
  ↓
Add to cart
  ↓
Checkout
  ↓
Verify confirmation
```

## Demonstrated Concepts

- Page Objects
- Custom fixtures
- Environment/config support
- API client abstraction
- Reusable utilities
- Meaningful assertions
- Reporting
- Clean test organization

---

# Part C – Integration Data Reconciliation

## Goal

Compare the OMS source data with Analytics target data and automatically detect violations of the business contract.

## Technology

- JavaScript
- Node.js

## Reconciliation Meaning

Reconciliation means:

> Compare source and target data and verify that the target correctly represents the source according to the defined business rules.

It is **not** simply checking whether both files are identical.

## Data Flow

```text
orders.csv
     │
     ▼
┌───────────────────────┐
│ Reconciliation Engine │
└───────────────────────┘
     ▲
     │
analytics_event_log.csv

     ↓
Apply business rules
     ↓
Findings / defects
     ↓
defects.json
     ↓
DEFECT_REPORT.md
```

## Validation Rules

### Completeness

- Cart orders must not sync.
- Every non-Cart order must have at least an `Order Placed` event.

### Referential Integrity

- Every Analytics `CaseId` must correspond to an OMS `OrderId`.

### Attribute Correctness

- Analytics Amount must match OMS OrderAmount.
- Analytics Currency must match OMS Currency.
- CustomerName must match after trim + case-insensitive normalization.

### Source Data Quality

- OrderAmount must not be negative.

### Temporal Correctness

- Timestamps must be UTC.
- Timestamps must not be in the future.
- Lifecycle timestamps must be non-decreasing.

### Process Conformance

Examples:

```text
Confirmed:
Order Placed → Order Confirmed
```

```text
Shipped:
Order Placed → Order Confirmed → Order Shipped
```

```text
Delivered:
Order Placed → Order Confirmed → Order Shipped → Order Delivered
```

```text
Cancelled:
Order Placed → Order Confirmed → Order Cancelled
```

Returned orders can follow one of the valid return paths.

### Duplicate Detection

Unexpected duplicate lifecycle activities should be reported.

## Suggested Final Structure

```text
reconciliation/
├── src/
│   ├── loaders/
│   │   └── csv-loader.js
│   ├── rules/
│   │   ├── completeness.rule.js
│   │   ├── referential-integrity.rule.js
│   │   ├── attribute.rule.js
│   │   ├── temporal.rule.js
│   │   └── process.rule.js
│   ├── utils/
│   │   └── normalization.js
│   └── reconcile.js
├── tests/
├── output/
│   └── defects.json
└── README.md
```

## Example Finding

```json
{
  "id": "DATA-001",
  "caseId": "ORD-1007",
  "category": "ATTRIBUTE",
  "rule": "AMOUNT_MATCH",
  "severity": "HIGH",
  "description": "Analytics amount does not match OMS.",
  "expected": "1234.56",
  "actual": "1234.60"
}
```

## False-Positive Principle

Do not flag valid normalization differences.

Example:

```text
OMS:       "VanArsdel  "
Analytics: "vanarsdel"
```

After trim + lowercase they match, so this is a PASS.

---

# Part D – Performance & Load Testing

## Goal

Design how the sync/ingest API should be validated under enterprise-scale traffic.

## Deliverables

```text
PERFORMANCE.md
```

Optional runnable stub:

```text
performance/sync-load.k6.js
```

## Preferred Tool

```text
k6
```

## Scenarios

- Baseline
- Load
- Stress
- Spike
- Soak

## Important Metrics

- p50 latency
- p95 latency
- p99 latency
- throughput
- error rate
- successful ingestion rate
- end-to-end ingestion delay
- backlog / queue depth
- backlog drain time
- duplicate rate
- dropped-record rate

A fast API response is not enough if downstream Analytics ingestion is significantly delayed.

---

# Part E – AI-First Quality Engineering

## Goal

Use an LLM to accelerate defect understanding and triage while keeping deterministic code responsible for pass/fail.

## Deliverables

```text
AI_WORKLOG.md
```

and one working AI quality artifact.

## Selected Artifact

### Data-Diff Anomaly Explainer

```text
Part C deterministic validation
            ↓
       defects.json
            ↓
      AI Explainer
            ↓
    ai-analysis.json
```

## Technology

- JavaScript
- Node.js
- Gemini API

## Example AI Input

```json
{
  "caseId": "ORD-1007",
  "rule": "AMOUNT_MATCH",
  "expected": "1234.56",
  "actual": "1234.60",
  "severity": "HIGH"
}
```

## Example AI Output

```json
{
  "explanation": "The Analytics amount differs from the OMS source value.",
  "possibleRootCause": "Possible field mapping or transformation issue during synchronization.",
  "suggestedSeverity": "HIGH"
}
```

## Critical AI Guardrail

The LLM must **never decide or override pass/fail**.

```text
Business Rule
      ↓
Deterministic Code
      ↓
PASS / FAIL
      ↓
Locked result
      ↓
AI may explain / summarize / suggest
```

Root-cause suggestions are hypotheses, not proven facts.

## Additional Guardrails

- Never commit API keys.
- Use environment variables.
- Validate structured AI output.
- Restrict severity to known values.
- Prevent invented CaseIds.
- Log AI input/output.
- Require human review for root-cause conclusions.
- Never send credentials/secrets to the LLM.

---

# AI Work Log

`AI_WORKLOG.md` should record:

- Tool used
- Purpose
- Representative prompt
- AI output/suggestion
- What was accepted
- What was rejected/corrected
- How the result was independently verified

Example:

```text
AI suggestion:
Flag every OMS order missing from Analytics.

Verification:
The business contract states that Cart orders must not sync.

Correction:
The completeness rule was changed to apply only to non-Cart orders.
```

This demonstrates AI-assisted engineering with human verification.

---

# Proposed Repository Structure

```text
celonis-ai-quality-challenge/
│
├── README.md
├── PROJECT_IDEA.md
├── STRATEGY.md
├── DEFECT_REPORT.md
├── PERFORMANCE.md
├── AI_WORKLOG.md
├── .gitignore
│
├── data/
│   ├── orders.csv
│   └── analytics_event_log.csv
│
├── reconciliation/
│   ├── src/
│   ├── tests/
│   ├── output/
│   │   └── defects.json
│   └── README.md
│
├── playwright/
│   ├── pages/
│   ├── fixtures/
│   ├── api/
│   ├── tests/
│   ├── utils/
│   ├── playwright.config.js
│   └── README.md
│
├── performance/
│   └── sync-load.k6.js
│
├── ai/
│   ├── anomaly-explainer.js
│   ├── output/
│   │   └── ai-analysis.json
│   └── README.md
│
└── .github/
    └── optional AI/repository instructions
```

---

# Recommended Implementation Order

```text
1. Repository setup
       ↓
2. Understand data manually
       ↓
3. Part C basic reconciliation
       ↓
4. Verify detected defects manually
       ↓
5. Refactor Part C into modular rules
       ↓
6. Generate defects.json + DEFECT_REPORT.md
       ↓
7. Part E Gemini anomaly explainer
       ↓
8. Part B Playwright framework
       ↓
9. Part A strategy/scenarios
       ↓
10. Part D performance plan + k6 stub
       ↓
11. Final README
       ↓
12. Clean-run verification
       ↓
13. GitHub submission
```

---

# Final Project Story

The final solution should be explainable in one connected story:

> First, I defined a risk-based strategy for validating the Order-to-Cash integration across UI, API, and data.
>
> I then built a modular Playwright framework to demonstrate reusable UI and API automation.
>
> The core of the project is a deterministic reconciliation engine that compares OMS source data with Analytics event data and detects completeness, referential-integrity, attribute, temporal, and process-conformance defects.
>
> I also designed an enterprise-scale performance-testing strategy for the synchronization API.
>
> Finally, I built an AI-assisted anomaly explainer that consumes deterministic findings and helps engineers understand and triage them faster, while keeping all pass/fail decisions outside the LLM.

---

# Key Design Principle

```text
Correctness
   ↓
Explainability
   ↓
Maintainability
   ↓
AI Assistance
```

AI accelerates engineering judgement; it does not replace deterministic quality validation.

The solution should remain simple enough that every major design decision and important piece of code can be explained during the live review.
