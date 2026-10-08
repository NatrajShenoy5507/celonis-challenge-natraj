import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const orderTemplate = JSON.parse(open("../data/order-template.json"));
const acceptanceLatency = new Trend("api_acceptance_latency", true);
const requestFailures = new Rate("sync_request_failures");
const requestCount = new Counter("sync_requests");
const completionSuccess = new Rate("completion_sample_success");
const completionObservation = new Trend("completion_observation_ms", true);

const profile = __ENV.K6_PROFILE;
const acceptP95 = Number(__ENV.K6_ACCEPT_P95_MS);
const errorRate = Number(__ENV.K6_ACCEPT_ERROR_RATE);
const baseOptions = {
  thresholds: {
    api_acceptance_latency: [`p(95)<${acceptP95}`],
    sync_request_failures: [`rate<=${errorRate}`],
  },
};

function profileOptions() {
  if (profile === "baseline") {
    return {
      ...baseOptions,
      scenarios: {
        baseline: {
          executor: "shared-iterations",
          vus: Number(__ENV.K6_BASELINE_VUS),
          iterations: Number(__ENV.K6_BASELINE_ITERATIONS),
        },
      },
    };
  }

  if (profile === "load" || profile === "stress") {
    const prefix = profile === "load" ? "K6_LOAD_" : "K6_STRESS_";
    const startVus = profile === "load" ? Number(__ENV.K6_LOAD_START_VUS) : 1;
    const targetVus = Number(__ENV[`${prefix}TARGET_VUS`]);
    const rampUp = __ENV[`${prefix}RAMP_UP`];
    const hold = __ENV[`${prefix}HOLD`];
    const rampDown = __ENV[`${prefix}RAMP_DOWN`];
    return {
      ...baseOptions,
      scenarios: {
        [profile]: {
          executor: "ramping-vus",
          startVUs,
          stages: [
            { target: targetVus, duration: rampUp },
            { target: targetVus, duration: hold },
            { target: 0, duration: rampDown },
          ],
        },
      },
    };
  }

  if (profile === "soak") {
    return {
      ...baseOptions,
      scenarios: {
        soak: {
          executor: "constant-vus",
          vus: Number(__ENV.K6_SOAK_VUS),
          duration: __ENV.K6_SOAK_DURATION,
        },
      },
    };
  }

  throw new Error(`Unsupported K6_PROFILE: ${profile}`);
}

export const options = profileOptions();

export default function () {
  const uniqueOrderId = `MOCK-${Date.now()}-${__VU}-${__ITER}`;
  const order = { ...orderTemplate, orderId: uniqueOrderId };
  const headers = { "Content-Type": "application/json" };
  if (__ENV.K6_API_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.K6_API_TOKEN}`;
  }

  const response = http.post(
    `${__ENV.K6_TARGET_URL}/api/orders/sync`,
    JSON.stringify(order),
    { headers, tags: { operation: "sync_acceptance" } },
  );
  requestCount.add(1);
  acceptanceLatency.add(response.timings.duration);

  let responseBody;
  try {
    responseBody = response.json();
  } catch {
    responseBody = null;
  }
  const accepted = check(response, {
    "mock sync returns HTTP 202": (res) => res.status === 202,
    "accepted response contains this orderId": () =>
      responseBody !== null && responseBody.orderId === uniqueOrderId,
    "accepted response has accepted status": () =>
      responseBody !== null && responseBody.status === "accepted",
  });
  requestFailures.add(!accepted);

  const sampleRate = Number(__ENV.K6_COMPLETION_SAMPLE_RATE);
  if (accepted && sampleRate > 0 && Math.random() < sampleRate) {
    const observationStarted = Date.now();
    let completed = false;
    for (
      let attempt = 0;
      attempt < Number(__ENV.K6_COMPLETION_MAX_POLLS);
      attempt += 1
    ) {
      const status = http.get(
        `${__ENV.K6_TARGET_URL}/api/orders/${encodeURIComponent(uniqueOrderId)}/status`,
        { headers, tags: { operation: "completion_sample" } },
      );
      let statusBody;
      try {
        statusBody = status.json();
      } catch {
        statusBody = null;
      }
      if (status.status === 200 && statusBody?.status === "processed") {
        completed = true;
        break;
      }
      if (attempt + 1 < Number(__ENV.K6_COMPLETION_MAX_POLLS)) {
        sleep(Number(__ENV.K6_COMPLETION_POLL_INTERVAL_MS) / 1000);
      }
    }
    completionSuccess.add(completed);
    if (completed) {
      completionObservation.add(Date.now() - observationStarted);
    }
  }
}

export function handleSummary(data) {
  const metadata = JSON.parse(__ENV.K6_RUN_METADATA || "{}");
  const outputPath = __ENV.K6_SUMMARY_PATH;
  return {
    [outputPath]: JSON.stringify(
      {
        formatVersion: 1,
        metadata,
        k6Summary: data,
      },
      null,
      2,
    ),
  };
}
