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

console.log(`Total OMS orders: ${orders.length}`);
console.log(`Total Analytics events: ${events.length}`);

const findings = [];

for (const order of orders) {
  const matchingEvents = events.filter(
    (event) => event.CaseId === order.OrderId,
  );

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

  console.log(
    `${order.OrderId} | ${order.Status} | ${matchingEvents.length} analytics events`,
  );
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

console.log("\nFindings:");
console.log(JSON.stringify(findings, null, 2));
