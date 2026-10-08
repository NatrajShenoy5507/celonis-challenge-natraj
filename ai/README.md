# Part E — AI-First Quality Engineering

## 1. Overview

The Gemini-powered anomaly explainer takes findings produced by the deterministic OMS-to-Analytics reconciliation and generates case-level explanations, category-constrained potential root-cause mechanisms, business impacts, and investigation suggestions. These are AI-assisted hypotheses for human review, not confirmed causes.

## 2. Architecture

```text
OMS and Analytics CSV files
              ↓
Deterministic Reconciliation
              ↓
reconciliation/output/defects.json
              ↓
Gemini Anomaly Explainer
              ↓
Guardrail Validation
              ↓
ai/output/ai-analysis.json
```

The explainer reads `defects.json`; it does not read the raw CSV files. Deterministic reconciliation remains the source of truth and decides whether checks pass or fail. Gemini only explains already-detected findings.

## 3. Prerequisites and Setup

- **Node.js 20.12 or later** is required by the root scripts: the explainer uses Node's built-in `process.loadEnvFile()` to load the root `.env`.
- Install repository dependencies from the repository root:

  ```powershell
  npm install
  ```

- Create the root `.env` from the safe template if it does not already exist, then set `GEMINI_API_KEY` locally:

  ```powershell
  if (-not (Test-Path .env)) { Copy-Item .env.example .env }
  ```

  Never commit the key or include it in logs or reports.
- Generate deterministic findings before requesting AI analysis:

  ```powershell
  npm run reconcile
  ```

The explainer expects the findings JSON at `reconciliation/output/defects.json`. Do not use AI explanations in place of generating or reviewing these deterministic findings.

## 4. How to Run

Run these commands from the repository root:

```powershell
npm run reconcile
npm run ai:explain
```

The first command reads `data/orders.csv` and `data/analytics_event_log.csv` and writes `reconciliation/output/defects.json`. The second sends the findings and derived summary to Gemini, validates its response, and writes the validated result to [`output/ai-analysis.json`](./output/ai-analysis.json).

The exact commands are defined in [`package.json`](../package.json). A live AI run requires a valid key and network access; no successful execution is implied by these instructions.

## 5. AI Guardrails

- Deterministic reconciliation remains authoritative; Gemini cannot decide pass/fail, add or remove findings, or change deterministic severity.
- Every case analysis must map to an existing `caseId` and include exactly the deterministic finding IDs for that case. Unknown, missing, duplicated, or misassigned IDs are rejected.
- OMS expected values and supplied defect evidence are treated as trusted facts. Validation rejects unsupported claims that OMS/source data is wrong or needs correction, as well as unsupported business behavior and severity reinterpretation.
- Root causes are returned as `rootCauseMechanisms`, not free-text hypotheses. Allowed mechanisms are derived from finding categories for each case; unknown or disallowed values and duplicates are rejected. Cases containing only `SOURCE_DATA` findings have no allowed integration root-cause mechanisms. Mixed-category cases use the allowed mechanisms associated with their other finding categories.
- Structural and semantic validation rejects invalid output. The script allows at most two Gemini attempts (one corrective retry after a validation failure).
- The explainer writes `ai/output/ai-analysis.json` only after the complete response passes validation. A failed response is not saved as a new result.

## 6. Example Input and Output

The deterministic input is grouped by case and includes the supplied findings and that case's allowed mechanisms. A sanitized example shape:

```json
{
  "caseId": "CASE-EXAMPLE",
  "findings": [
    {
      "id": "DATA-001",
      "caseId": "CASE-EXAMPLE",
      "rule": "AMOUNT_MATCH",
      "category": "ATTRIBUTE",
      "severity": "HIGH",
      "description": "Analytics amount does not match OMS.",
      "expected": "100.00",
      "actual": "101.00"
    }
  ],
  "allowedRootCauseMechanisms": ["FIELD_MAPPING", "TRANSFORMATION"]
}
```

The response schema contains one top-level summary and case analyses. A sanitized example:

```json
{
  "overallSummary": "The supplied case contains an attribute mismatch for review.",
  "caseAnalyses": [
    {
      "caseId": "CASE-EXAMPLE",
      "findingIds": ["DATA-001"],
      "explanation": "The Analytics amount differs from the trusted OMS value.",
      "rootCauseMechanisms": ["FIELD_MAPPING"],
      "businessImpact": "The downstream order value may be represented inaccurately.",
      "investigationSteps": ["Review the downstream amount mapping."]
    }
  ]
}
```

Examples are schema illustrations only, not additional findings or verified root causes.

## 7. AI Limitations and Production Considerations

AI explanations and mechanisms are hypotheses, not confirmed root causes. Valid JSON does not guarantee a correct or evidence-supported explanation; language models can invent business behavior or plausible-sounding causes. The deterministic checks and human investigation remain necessary. Production use would additionally require appropriate data privacy controls, access management, observability, retention policies, and ongoing model-quality monitoring.

## 8. AI Work Log

The root [`AI_WORKLOG.md`](../AI_WORKLOG.md) documents AI prompts and contributions, generated output, observed mistakes, corrections, and verification history for this project.
