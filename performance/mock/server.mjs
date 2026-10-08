import { createServer } from "node:http";
import { loadConfig } from "../config/config.mjs";

const config = loadConfig();
const orders = new Map();
const counters = {
  accepted: 0,
  processed: 0,
  rejected: 0,
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request, maximumBytes = 8192) {
  return new Promise((resolve, reject) => {
    let body = "";
    let exceeded = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (Buffer.byteLength(body) + Buffer.byteLength(chunk) > maximumBytes) {
        exceeded = true;
        request.resume();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      if (exceeded) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function validateOrder(order) {
  if (order === null || typeof order !== "object" || Array.isArray(order)) {
    return "Request body must be a JSON object.";
  }
  if (
    typeof order.orderId !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(order.orderId)
  ) {
    return "orderId must be a non-empty identifier of at most 128 safe characters.";
  }
  if (typeof order.amount !== "number" || !Number.isFinite(order.amount) || order.amount < 0) {
    return "amount must be a finite, non-negative number.";
  }
  if (typeof order.currency !== "string" || !/^[A-Z]{3}$/.test(order.currency)) {
    return "currency must be a three-letter uppercase code.";
  }
  if (
    typeof order.customerName !== "string" ||
    order.customerName.trim().length === 0 ||
    order.customerName.length > 120
  ) {
    return "customerName must contain 1 to 120 characters.";
  }
  if (
    !["Cart", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"].includes(
      order.status,
    )
  ) {
    return "status must be a supported order lifecycle status.";
  }
  return null;
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok", service: "local-sync-mock" });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/metrics") {
    let pending = 0;
    for (const record of orders.values()) {
      if (record.status === "pending") {
        pending += 1;
      }
    }
    sendJson(response, 200, {
      accepted: counters.accepted,
      processed: counters.processed,
      rejected: counters.rejected,
      pending,
      storedOrders: orders.size,
      maxOrders: config.mock.maxOrders,
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/orders/sync") {
    let order;
    try {
      order = await readJsonBody(request);
    } catch (error) {
      counters.rejected += 1;
      sendJson(response, error.statusCode || 400, { error: error.message });
      return;
    }

    const validationError = validateOrder(order);
    if (validationError) {
      counters.rejected += 1;
      sendJson(response, 400, { error: validationError });
      return;
    }
    if (orders.has(order.orderId)) {
      counters.rejected += 1;
      sendJson(response, 409, { error: "orderId has already been accepted." });
      return;
    }
    if (orders.size >= config.mock.maxOrders) {
      counters.rejected += 1;
      sendJson(response, 503, { error: "Mock order capacity reached; restart the mock to clear state." });
      return;
    }

    const record = { status: "pending", acceptedAt: Date.now() };
    orders.set(order.orderId, record);
    counters.accepted += 1;
    setTimeout(() => {
      if (record.status === "pending") {
        record.status = "processed";
        record.processedAt = Date.now();
        counters.processed += 1;
      }
    }, config.mock.processingDelayMs).unref();

    sendJson(response, 202, {
      orderId: order.orderId,
      status: "accepted",
      message: "Order accepted by the local mock; processing is asynchronous.",
    });
    return;
  }

  const statusMatch = requestUrl.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (request.method === "GET" && statusMatch) {
    let orderId;
    try {
      orderId = decodeURIComponent(statusMatch[1]);
    } catch {
      sendJson(response, 400, { error: "orderId is not valid URL encoding." });
      return;
    }
    const record = orders.get(orderId);
    if (!record) {
      sendJson(response, 404, { orderId, status: "not_found" });
      return;
    }
    sendJson(response, 200, {
      orderId,
      status: record.status,
      acceptedAt: new Date(record.acceptedAt).toISOString(),
      ...(record.processedAt
        ? { processedAt: new Date(record.processedAt).toISOString() }
        : {}),
    });
    return;
  }

  sendJson(response, 404, { error: "Route not found." });
});

server.on("error", (error) => {
  console.error(`Mock server error: ${error.message}`);
  process.exitCode = 1;
});

server.listen(config.mock.port, "127.0.0.1", () => {
  console.log(`Local sync mock listening on http://127.0.0.1:${config.mock.port}`);
});
