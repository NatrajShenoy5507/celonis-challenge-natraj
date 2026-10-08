const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const findingsPath = path.join(
  projectRoot,
  "reconciliation",
  "output",
  "defects.json",
);
const reportPath = path.join(projectRoot, "DEFECT_REPORT.md");
const findings = JSON.parse(fs.readFileSync(findingsPath, "utf8"));

const businessImpacts = {
  ORDER_PLACED_EXISTS:
    "The Analytics lifecycle is missing its initial event for this OMS order.",
  AMOUNT_MATCH: "Analytics may report an incorrect order value.",
  CURRENCY_MATCH:
    "Analytics may classify or aggregate the order under the wrong currency.",
  DELIVERED_TIMESTAMP_MATCH:
    "The systems report different delivery times for the same assumed event.",
  TIMESTAMP_SEQUENCE_NON_DECREASING:
    "Event times contradict the expected business chronology.",
  PROCESS_CONFORMANCE:
    "The Analytics lifecycle does not represent the OMS order status correctly.",
  DUPLICATE_ACTIVITY:
    "Duplicate lifecycle events may inflate activity counts or downstream metrics.",
  ORDER_AMOUNT_NON_NEGATIVE:
    "Invalid source data may affect order-value reporting and downstream processing.",
  TIMESTAMP_NOT_IN_FUTURE:
    "A future event time can misrepresent when the business activity occurred.",
  ANALYTICS_CASE_MUST_EXIST_IN_OMS:
    "The Analytics case cannot be traced to an OMS source record.",
};

const detectionMethods = {
  ORDER_PLACED_EXISTS:
    "Check each non-Cart OMS order for a matching Analytics Order Placed event.",
  AMOUNT_MATCH:
    "Compare each matching Analytics event amount numerically with OMS OrderAmount.",
  CURRENCY_MATCH:
    "Compare each matching Analytics event Currency exactly with OMS Currency.",
  DELIVERED_TIMESTAMP_MATCH:
    "For Delivered orders with DeliveredDate and exactly one Order Delivered event, compare the timestamp values.",
  TIMESTAMP_SEQUENCE_NON_DECREASING:
    "Compare timestamps in expected activity order when required activities occur exactly once and have valid timestamps.",
  PROCESS_CONFORMANCE:
    "Compare the chronologically observed activity flow with the valid flow for the OMS status.",
  DUPLICATE_ACTIVITY:
    "Count each Analytics activity per OMS order and report activities with more than one occurrence.",
  ORDER_AMOUNT_NON_NEGATIVE:
    "Check each OMS OrderAmount directly for a value below zero.",
  TIMESTAMP_NOT_IN_FUTURE:
    "Compare each parsed OMS-linked event timestamp with the configured validation time, or current time when none is configured.",
  ANALYTICS_CASE_MUST_EXIST_IN_OMS:
    "Compare each unique Analytics CaseId with OMS OrderIds and report orphan IDs.",
};

const defectTitles = {
  ORDER_PLACED_EXISTS: "OMS order is missing its Order Placed event",
  AMOUNT_MATCH: "Analytics amount does not match OMS",
  CURRENCY_MATCH: "Analytics currency does not match OMS",
  DELIVERED_TIMESTAMP_MATCH: "Delivered timestamps differ between systems",
  TIMESTAMP_SEQUENCE_NON_DECREASING:
    "Analytics timestamps decrease in business-process order",
  PROCESS_CONFORMANCE: "Analytics activity flow does not match OMS status",
  DUPLICATE_ACTIVITY: "Analytics activity is duplicated",
  ORDER_AMOUNT_NON_NEGATIVE: "OMS order amount is negative",
  TIMESTAMP_NOT_IN_FUTURE: "Analytics timestamp is in the future",
  ANALYTICS_CASE_MUST_EXIST_IN_OMS:
    "Analytics case has no corresponding OMS order",
};

function formatValue(value) {
  if (Array.isArray(value) || (value !== null && typeof value === "object")) {
    return `\`${JSON.stringify(value)}\``;
  }
  return `\`${String(value)}\``;
}

const groupedFindings = new Map();
for (const finding of findings) {
  const key = `${finding.caseId}\u0000${finding.rule}`;
  if (!groupedFindings.has(key)) {
    groupedFindings.set(key, []);
  }
  groupedFindings.get(key).push(finding);
}

const report = [
  "# Reconciliation Defect Report",
  "",
  `**Source:** \`reconciliation/output/defects.json\``,
  `**Summary:** ${findings.length} raw findings grouped into ${groupedFindings.size} reviewer-facing defects. Findings are grouped only when both Case ID and rule match.`,
  "",
  "## Reported defects",
  "",
];

let defectNumber = 1;
for (const group of groupedFindings.values()) {
  const first = group[0];
  const defectId = `DEFECT-${String(defectNumber).padStart(3, "0")}`;
  const rawIds = group.map((finding) => finding.id).join(", ");
  const evidenceItems = new Map();
  for (const finding of group) {
    const evidence = finding.activity
      ? `${finding.activity}: ${formatValue(finding.actual)}`
      : formatValue(finding.actual);
    evidenceItems.set(evidence, (evidenceItems.get(evidence) || 0) + 1);
  }
  const evidence = [...evidenceItems]
    .map(([value, count]) =>
      count > 1 ? `${value} (${count} raw findings)` : value,
    )
    .join("; ");

  report.push(
    `### ${defectId} — ${defectTitles[first.rule] || first.description}`,
    "",
    `- **Raw finding IDs:** ${rawIds}`,
    `- **Case ID:** \`${first.caseId}\``,
    `- **Category / rule / severity:** ${first.category} / \`${first.rule}\` / ${first.severity}`,
    `- **Evidence / actual:** ${evidence}`,
    `- **Expected:** ${formatValue(first.expected)}`,
    `- **Business impact:** ${businessImpacts[first.rule] || "This data discrepancy may affect the accuracy or interpretation of Analytics results."}`,
    `- **Detection method:** ${detectionMethods[first.rule] || "Apply the stated reconciliation rule to matching OMS and Analytics data."}`,
    "",
  );
  defectNumber += 1;
}

report.push(
  "## Expected behaviour / intentionally not reported",
  "",
  "- **Cart orders not syncing:** This is expected, so a Cart order with no Analytics events does not produce a completeness defect. `ORD-1014` has a separate source-data finding for its negative OMS amount.",
  "- **CustomerName normalization:** Differences that become equal after trimming whitespace and converting to lowercase are treated as matching. No customer-name finding is present in the JSON.",
  "- **Valid Cancelled flow:** Order Placed → Order Confirmed → Order Cancelled is accepted. No process finding for the valid Cancelled flow is present in the JSON.",
  "- **Valid Returned flow:** Both supported Returned paths are accepted, including direct return after shipment. No process finding for the valid Returned flow is present in the JSON.",
  "",
  "## Assumptions",
  "",
  "- Matching OMS `DeliveredDate` to Analytics `Order Delivered.Timestamp` is a derived business assumption based on the semantic equivalence of the event. `DELIVERED_TIMESTAMP_MATCH` findings depend on this assumption.",
  "",
);

fs.writeFileSync(reportPath, report.join("\n"));
console.log(`Generated ${path.relative(projectRoot, reportPath)}`);
console.log(
  `Grouped ${findings.length} raw findings into ${groupedFindings.size} defects.`,
);
