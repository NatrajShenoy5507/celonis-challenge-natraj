const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

const dataDirectory = path.resolve(__dirname, "../../data");

function readCsv(fileName) {
  const filePath = path.join(dataDirectory, fileName);
  const contents = fs.readFileSync(filePath, "utf8");

  return parse(contents, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function normalizeCustomerName(name) {
  return name.trim().toLowerCase();
}

const orders = readCsv("orders.csv");
const events = readCsv("analytics_event_log.csv");
const validationAsOf =
  process.env.VALIDATION_AS_OF === undefined
    ? new Date()
    : new Date(process.env.VALIDATION_AS_OF);

if (Number.isNaN(validationAsOf.getTime())) {
  throw new Error("VALIDATION_AS_OF must be a valid date and time.");
}

const findings = [];
const expectedFlowsByStatus = {
  Cart: [[]],
  Confirmed: [["Order Placed", "Order Confirmed"]],
  Shipped: [["Order Placed", "Order Confirmed", "Order Shipped"]],
  Delivered: [
    ["Order Placed", "Order Confirmed", "Order Shipped", "Order Delivered"],
  ],
  Cancelled: [["Order Placed", "Order Confirmed", "Order Cancelled"]],
  Returned: [
    ["Order Placed", "Order Confirmed", "Order Shipped", "Order Returned"],
    [
      "Order Placed",
      "Order Confirmed",
      "Order Shipped",
      "Order Delivered",
      "Order Returned",
    ],
  ],
};

for (const order of orders) {
  const matchingEvents = events.filter(
    (event) => event.CaseId === order.OrderId,
  );
  const deliveredEvents = matchingEvents.filter(
    (event) => event.Activity === "Order Delivered",
  );

  // Derived assumption: Order Delivered represents the OMS DeliveredDate event.
  if (
    order.Status === "Delivered" &&
    order.DeliveredDate &&
    deliveredEvents.length === 1 &&
    deliveredEvents[0].Timestamp !== order.DeliveredDate
  ) {
    findings.push({
      caseId: order.OrderId,
      rule: "DELIVERED_TIMESTAMP_MATCH",
      category: "TEMPORAL",
      severity: "HIGH",
      description:
        "Analytics Order Delivered timestamp does not match OMS DeliveredDate.",
      expected: order.DeliveredDate,
      actual: deliveredEvents[0].Timestamp,
    });
  }

  if (Number(order.OrderAmount) < 0) {
    findings.push({
      caseId: order.OrderId,
      rule: "ORDER_AMOUNT_NON_NEGATIVE",
      category: "SOURCE_DATA",
      severity: "MEDIUM",
      description: "OMS OrderAmount must not be negative.",
      expected: ">= 0",
      actual: order.OrderAmount,
    });
  }

  if (
    order.Status !== "Cart" &&
    !matchingEvents.some((event) => event.Activity === "Order Placed")
  ) {
    findings.push({
      caseId: order.OrderId,
      rule: "ORDER_PLACED_EXISTS",
      category: "COMPLETENESS",
      severity: "HIGH",
      description: "Non-Cart OMS order has no Order Placed Analytics event.",
      expected: "At least one Order Placed event",
      actual: "No Order Placed event found",
    });
  }

  for (const event of matchingEvents) {
    const timestamp = new Date(event.Timestamp);

    if (Number.isNaN(timestamp.getTime())) {
      findings.push({
        caseId: order.OrderId,
        rule: "TIMESTAMP_VALID",
        category: "TEMPORAL",
        severity: "HIGH",
        description: "Analytics timestamp is not a valid date.",
        expected: "A valid date and time",
        actual: event.Timestamp,
      });
    }

    if (!/(?:Z|\+00:00)$/.test(event.Timestamp)) {
      findings.push({
        caseId: order.OrderId,
        rule: "TIMESTAMP_UTC",
        category: "TEMPORAL",
        severity: "HIGH",
        description: "Analytics timestamp must represent UTC.",
        expected: "Timestamp ending in Z or +00:00",
        actual: event.Timestamp,
      });
    }

    if (
      !Number.isNaN(timestamp.getTime()) &&
      timestamp > validationAsOf
    ) {
      findings.push({
        caseId: order.OrderId,
        rule: "TIMESTAMP_NOT_IN_FUTURE",
        category: "TEMPORAL",
        severity: "HIGH",
        description: `Analytics timestamp is after the validation time for ${event.Activity}.`,
        activity: event.Activity,
        expected: `Timestamp less than or equal to ${validationAsOf.toISOString()}`,
        actual: event.Timestamp,
      });
    }

    if (Number(event.Amount) !== Number(order.OrderAmount)) {
      findings.push({
        caseId: order.OrderId,
        rule: "AMOUNT_MATCH",
        category: "ATTRIBUTE",
        severity: "HIGH",
        description: `Analytics amount does not match OMS for ${event.Activity}.`,
        activity: event.Activity,
        expected: order.OrderAmount,
        actual: event.Amount,
      });
    }

    if (event.Currency !== order.Currency) {
      findings.push({
        caseId: order.OrderId,
        rule: "CURRENCY_MATCH",
        category: "ATTRIBUTE",
        severity: "HIGH",
        description: `Analytics currency does not match OMS for ${event.Activity}.`,
        expected: order.Currency,
        actual: event.Currency,
      });
    }

    if (
      normalizeCustomerName(event.CustomerName) !==
      normalizeCustomerName(order.CustomerName)
    ) {
      findings.push({
        caseId: order.OrderId,
        rule: "CUSTOMER_NAME_MATCH",
        category: "ATTRIBUTE",
        severity: "MEDIUM",
        description: `Analytics customer name does not match OMS for ${event.Activity}.`,
        expected: order.CustomerName,
        actual: event.CustomerName,
      });
    }
  }

  const activityCounts = new Map();
  for (const event of matchingEvents) {
    activityCounts.set(
      event.Activity,
      (activityCounts.get(event.Activity) || 0) + 1,
    );
  }

  const sequenceFlow = (expectedFlowsByStatus[order.Status] || [])
    .filter(
      (flow) =>
        flow.length > 0 &&
        flow.every((activity) => activityCounts.get(activity) === 1),
    )
    .sort((first, second) => second.length - first.length)[0];

  if (sequenceFlow) {
    const sequenceEvents = sequenceFlow.map((activity) =>
      matchingEvents.find((event) => event.Activity === activity),
    );
    const sequenceTimestamps = sequenceEvents.map((event) =>
      new Date(event.Timestamp).getTime(),
    );
    const hasValidTimestamps = sequenceTimestamps.every(Number.isFinite);
    const timestampsDecrease = sequenceTimestamps.some(
      (timestamp, index) =>
        index > 0 && sequenceTimestamps[index - 1] > timestamp,
    );

    if (hasValidTimestamps && timestampsDecrease) {
      findings.push({
        caseId: order.OrderId,
        rule: "TIMESTAMP_SEQUENCE_NON_DECREASING",
        category: "TEMPORAL",
        severity: "HIGH",
        description: "Analytics timestamps decrease in business-process order.",
        expected: sequenceFlow,
        actual: sequenceEvents.map((event) => ({
          activity: event.Activity,
          timestamp: event.Timestamp,
        })),
      });
    }
  }

  for (const [activity, count] of activityCounts) {
    if (count > 1) {
      findings.push({
        caseId: order.OrderId,
        rule: "DUPLICATE_ACTIVITY",
        category: "PROCESS",
        severity: "MEDIUM",
        description: `Analytics activity occurs more than once: ${activity}.`,
        activity,
        expected: "1 occurrence",
        actual: count,
      });
    }
  }

  if (order.Status === "Cart" || matchingEvents.length > 0) {
    const observedFlow = [...matchingEvents]
      .sort(
        (first, second) =>
          new Date(first.Timestamp).getTime() -
          new Date(second.Timestamp).getTime(),
      )
      .map((event) => event.Activity);
    const validFlows = expectedFlowsByStatus[order.Status] || [];
    const flowMatches = validFlows.some(
      (flow) => JSON.stringify(flow) === JSON.stringify(observedFlow),
    );

    if (!flowMatches) {
      findings.push({
        caseId: order.OrderId,
        rule: "PROCESS_CONFORMANCE",
        category: "PROCESS",
        severity: "HIGH",
        description: `Analytics activity flow does not match the lifecycle for OMS status ${order.Status}.`,
        expected: validFlows,
        actual: observedFlow,
      });
    }
  }

}

const orderIds = new Set(orders.map((order) => order.OrderId));
const caseIds = new Set(events.map((event) => event.CaseId));

for (const caseId of caseIds) {
  if (!orderIds.has(caseId)) {
    findings.push({
      caseId,
      rule: "ANALYTICS_CASE_MUST_EXIST_IN_OMS",
      category: "REFERENTIAL_INTEGRITY",
      severity: "HIGH",
      description: "Analytics CaseId does not match an OMS OrderId.",
      expected: "A matching OMS order",
      actual: "No matching OMS order found",
    });
  }
}

findings.forEach((finding, index) => {
  finding.id = `DATA-${String(index + 1).padStart(3, "0")}`;
});

const outputFile = path.resolve(__dirname, "../output/defects.json");
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(findings, null, 2)}\n`);

const affectedCaseIds = new Set(findings.map((finding) => finding.caseId));
const projectRoot = path.resolve(__dirname, "../..");

console.log(`Total OMS orders: ${orders.length}`);
console.log(`Total Analytics events: ${events.length}`);
console.log(`Total findings: ${findings.length}`);
console.log(`Unique affected case IDs: ${affectedCaseIds.size}`);
console.log(`Output file: ${path.relative(projectRoot, outputFile)}`);
