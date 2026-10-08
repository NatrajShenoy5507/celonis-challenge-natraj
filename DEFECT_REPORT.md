# Reconciliation Defect Report

**Source:** `reconciliation/output/defects.json`
**Summary:** 17 raw findings grouped into 14 reviewer-facing defects. Findings are grouped only when both Case ID and rule match.

## Reported defects

### DEFECT-001 — OMS order is missing its Order Placed event

- **Raw finding IDs:** DATA-001
- **Case ID:** `ORD-1006`
- **Category / rule / severity:** COMPLETENESS / `ORDER_PLACED_EXISTS` / HIGH
- **Evidence / actual:** `No Order Placed event found`
- **Expected:** `At least one Order Placed event`
- **Business impact:** The Analytics lifecycle is missing its initial event for this OMS order.
- **Detection method:** Check each non-Cart OMS order for a matching Analytics Order Placed event.

### DEFECT-002 — Analytics amount does not match OMS

- **Raw finding IDs:** DATA-002
- **Case ID:** `ORD-1007`
- **Category / rule / severity:** ATTRIBUTE / `AMOUNT_MATCH` / HIGH
- **Evidence / actual:** Order Delivered: `1234.60`
- **Expected:** `1234.56`
- **Business impact:** Analytics may report an incorrect order value.
- **Detection method:** Compare each matching Analytics event amount numerically with OMS OrderAmount.

### DEFECT-003 — Analytics currency does not match OMS

- **Raw finding IDs:** DATA-003, DATA-004, DATA-005, DATA-006
- **Case ID:** `ORD-1008`
- **Category / rule / severity:** ATTRIBUTE / `CURRENCY_MATCH` / HIGH
- **Evidence / actual:** `USD` (4 raw findings)
- **Expected:** `EUR`
- **Business impact:** Analytics may classify or aggregate the order under the wrong currency.
- **Detection method:** Compare each matching Analytics event Currency exactly with OMS Currency.

### DEFECT-004 — Delivered timestamps differ between systems

- **Raw finding IDs:** DATA-007
- **Case ID:** `ORD-1009`
- **Category / rule / severity:** TEMPORAL / `DELIVERED_TIMESTAMP_MATCH` / HIGH
- **Evidence / actual:** `2026-08-26T11:30:00Z`
- **Expected:** `2026-08-26T06:00:00Z`
- **Business impact:** The systems report different delivery times for the same assumed event.
- **Detection method:** For Delivered orders with DeliveredDate and exactly one Order Delivered event, compare the timestamp values.

### DEFECT-005 — Delivered timestamps differ between systems

- **Raw finding IDs:** DATA-008
- **Case ID:** `ORD-1010`
- **Category / rule / severity:** TEMPORAL / `DELIVERED_TIMESTAMP_MATCH` / HIGH
- **Evidence / actual:** `2026-08-20T09:00:00Z`
- **Expected:** `2026-08-24T12:00:00Z`
- **Business impact:** The systems report different delivery times for the same assumed event.
- **Detection method:** For Delivered orders with DeliveredDate and exactly one Order Delivered event, compare the timestamp values.

### DEFECT-006 — Analytics timestamps decrease in business-process order

- **Raw finding IDs:** DATA-009
- **Case ID:** `ORD-1010`
- **Category / rule / severity:** TEMPORAL / `TIMESTAMP_SEQUENCE_NON_DECREASING` / HIGH
- **Evidence / actual:** `[{"activity":"Order Placed","timestamp":"2026-08-10T09:35:00Z"},{"activity":"Order Confirmed","timestamp":"2026-08-12T09:00:00Z"},{"activity":"Order Shipped","timestamp":"2026-08-24T12:00:00Z"},{"activity":"Order Delivered","timestamp":"2026-08-20T09:00:00Z"}]`
- **Expected:** `["Order Placed","Order Confirmed","Order Shipped","Order Delivered"]`
- **Business impact:** Event times contradict the expected business chronology.
- **Detection method:** Compare timestamps in expected activity order when required activities occur exactly once and have valid timestamps.

### DEFECT-007 — Analytics activity flow does not match OMS status

- **Raw finding IDs:** DATA-010
- **Case ID:** `ORD-1010`
- **Category / rule / severity:** PROCESS / `PROCESS_CONFORMANCE` / HIGH
- **Evidence / actual:** `["Order Placed","Order Confirmed","Order Delivered","Order Shipped"]`
- **Expected:** `[["Order Placed","Order Confirmed","Order Shipped","Order Delivered"]]`
- **Business impact:** The Analytics lifecycle does not represent the OMS order status correctly.
- **Detection method:** Compare the chronologically observed activity flow with the valid flow for the OMS status.

### DEFECT-008 — Analytics activity is duplicated

- **Raw finding IDs:** DATA-011
- **Case ID:** `ORD-1011`
- **Category / rule / severity:** PROCESS / `DUPLICATE_ACTIVITY` / MEDIUM
- **Evidence / actual:** Order Shipped: `2`
- **Expected:** `1 occurrence`
- **Business impact:** Duplicate lifecycle events may inflate activity counts or downstream metrics.
- **Detection method:** Count each Analytics activity per OMS order and report activities with more than one occurrence.

### DEFECT-009 — Analytics activity flow does not match OMS status

- **Raw finding IDs:** DATA-012
- **Case ID:** `ORD-1011`
- **Category / rule / severity:** PROCESS / `PROCESS_CONFORMANCE` / HIGH
- **Evidence / actual:** `["Order Placed","Order Confirmed","Order Shipped","Order Shipped"]`
- **Expected:** `[["Order Placed","Order Confirmed","Order Shipped"]]`
- **Business impact:** The Analytics lifecycle does not represent the OMS order status correctly.
- **Detection method:** Compare the chronologically observed activity flow with the valid flow for the OMS status.

### DEFECT-010 — Analytics activity flow does not match OMS status

- **Raw finding IDs:** DATA-013
- **Case ID:** `ORD-1012`
- **Category / rule / severity:** PROCESS / `PROCESS_CONFORMANCE` / HIGH
- **Evidence / actual:** `["Order Placed","Order Shipped","Order Delivered"]`
- **Expected:** `[["Order Placed","Order Confirmed","Order Shipped","Order Delivered"]]`
- **Business impact:** The Analytics lifecycle does not represent the OMS order status correctly.
- **Detection method:** Compare the chronologically observed activity flow with the valid flow for the OMS status.

### DEFECT-011 — Analytics activity flow does not match OMS status

- **Raw finding IDs:** DATA-014
- **Case ID:** `ORD-1013`
- **Category / rule / severity:** PROCESS / `PROCESS_CONFORMANCE` / HIGH
- **Evidence / actual:** `["Order Placed","Order Confirmed","Order Shipped"]`
- **Expected:** `[["Order Placed","Order Confirmed","Order Shipped","Order Delivered"]]`
- **Business impact:** The Analytics lifecycle does not represent the OMS order status correctly.
- **Detection method:** Compare the chronologically observed activity flow with the valid flow for the OMS status.

### DEFECT-012 — OMS order amount is negative

- **Raw finding IDs:** DATA-015
- **Case ID:** `ORD-1014`
- **Category / rule / severity:** SOURCE_DATA / `ORDER_AMOUNT_NON_NEGATIVE` / MEDIUM
- **Evidence / actual:** `-500.00`
- **Expected:** `>= 0`
- **Business impact:** Invalid source data may affect order-value reporting and downstream processing.
- **Detection method:** Check each OMS OrderAmount directly for a value below zero.

### DEFECT-013 — Analytics timestamp is in the future

- **Raw finding IDs:** DATA-016
- **Case ID:** `ORD-1018`
- **Category / rule / severity:** TEMPORAL / `TIMESTAMP_NOT_IN_FUTURE` / HIGH
- **Evidence / actual:** Order Shipped: `2027-08-18T09:00:00Z`
- **Expected:** `Timestamp less than or equal to 2026-10-08T10:24:39.310Z`
- **Business impact:** A future event time can misrepresent when the business activity occurred.
- **Detection method:** Compare each parsed OMS-linked event timestamp with the configured validation time, or current time when none is configured.

### DEFECT-014 — Analytics case has no corresponding OMS order

- **Raw finding IDs:** DATA-017
- **Case ID:** `ORD-9999`
- **Category / rule / severity:** REFERENTIAL_INTEGRITY / `ANALYTICS_CASE_MUST_EXIST_IN_OMS` / HIGH
- **Evidence / actual:** `No matching OMS order found`
- **Expected:** `A matching OMS order`
- **Business impact:** The Analytics case cannot be traced to an OMS source record.
- **Detection method:** Compare each unique Analytics CaseId with OMS OrderIds and report orphan IDs.

## Expected behaviour / intentionally not reported

- **Cart orders not syncing:** This is expected, so a Cart order with no Analytics events does not produce a completeness defect. `ORD-1014` has a separate source-data finding for its negative OMS amount.
- **CustomerName normalization:** Differences that become equal after trimming whitespace and converting to lowercase are treated as matching. No customer-name finding is present in the JSON.
- **Valid Cancelled flow:** Order Placed → Order Confirmed → Order Cancelled is accepted. No process finding for the valid Cancelled flow is present in the JSON.
- **Valid Returned flow:** Both supported Returned paths are accepted, including direct return after shipment. No process finding for the valid Returned flow is present in the JSON.

## Assumptions

- Matching OMS `DeliveredDate` to Analytics `Order Delivered.Timestamp` is a derived business assumption based on the semantic equivalence of the event. `DELIVERED_TIMESTAMP_MATCH` findings depend on this assumption.
