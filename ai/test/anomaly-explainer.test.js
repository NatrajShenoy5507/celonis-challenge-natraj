const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const findingsPath = path.join(
  projectRoot,
  "reconciliation",
  "output",
  "defects.json",
);
const findings = JSON.parse(fs.readFileSync(findingsPath, "utf8"));
const mockFetchPath = path.join(__dirname, "mock-gemini-fetch.cjs");

function createModelResponse(sourceFindings = findings) {
  const caseGroups = new Map();
  for (const finding of sourceFindings) {
    if (!caseGroups.has(finding.caseId)) {
      caseGroups.set(finding.caseId, []);
    }
    caseGroups.get(finding.caseId).push(finding);
  }

  return JSON.stringify({
    overallSummary: "The findings show downstream Analytics mismatches for review.",
    caseAnalyses: Object.fromEntries(
      [...caseGroups].map(([caseId, caseFindings]) => [
        caseId,
        {
          caseId,
          findingIds: caseFindings.map((finding) => finding.id),
          explanation:
            "The observed Analytics values differ from the trusted OMS evidence.",
          rootCauseMechanisms: [],
          businessImpact:
            "Downstream analytics may represent the order inaccurately.",
          investigationSteps: [
            "Compare the downstream representation with the reconciled values.",
          ],
        },
      ]),
    ),
  });
}

function runExplainer(responses, sourceFindings = findings) {
  const sandbox = fs.mkdtempSync(
    path.join(os.tmpdir(), "celonis-ai-guardrail-test-"),
  );
  const aiDirectory = path.join(sandbox, "ai");
  const outputDirectory = path.join(aiDirectory, "output");
  const reconciliationDirectory = path.join(
    sandbox,
    "reconciliation",
    "output",
  );
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(reconciliationDirectory, { recursive: true });

  const scriptPath = path.join(aiDirectory, "anomaly-explainer.js");
  const responsesPath = path.join(sandbox, "mock-responses.json");
  const requestsPath = path.join(sandbox, "mock-requests.json");
  fs.copyFileSync(
    path.join(projectRoot, "ai", "anomaly-explainer.js"),
    scriptPath,
  );
  fs.writeFileSync(
    path.join(reconciliationDirectory, "defects.json"),
    `${JSON.stringify(sourceFindings, null, 2)}\n`,
  );
  fs.writeFileSync(responsesPath, JSON.stringify(responses));

  const env = Object.fromEntries(
    Object.entries({
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    GEMINI_API_KEY: "offline-test-only",
    AI_MOCK_RESPONSES_FILE: responsesPath,
    AI_MOCK_REQUESTS_FILE: requestsPath,
    }).filter(([, value]) => typeof value === "string"),
  );
  const result = spawnSync(
    process.execPath,
    ["--require", mockFetchPath, scriptPath],
    { cwd: sandbox, env, encoding: "utf8" },
  );

  try {
    const requests = fs.existsSync(requestsPath)
      ? JSON.parse(fs.readFileSync(requestsPath, "utf8"))
      : [];
    const outputPath = path.join(outputDirectory, "ai-analysis.json");
    const output = fs.existsSync(outputPath)
      ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
      : null;
    return { result, requests, output };
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

function groupFindingsByCaseId(sourceFindings) {
  return sourceFindings.reduce((groups, finding) => {
    if (!groups.has(finding.caseId)) {
      groups.set(finding.caseId, []);
    }
    groups.get(finding.caseId).push(finding);
    return groups;
  }, new Map());
}

test("corrective retry validates trusted OMS, per-case schema, and exact identifiers", () => {
  const invalidFirstResponse = JSON.parse(createModelResponse());
  invalidFirstResponse.caseAnalyses["ORD-1008"].explanation =
    "OMS source data is wrong and should be corrected.";
  const { result, requests, output } = runExplainer([
    JSON.stringify(invalidFirstResponse),
    createModelResponse(),
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.length, 2);
  assert.match(
    requests[0].systemInstruction.parts[0].text,
    /never question, reinterpret, correct, or rewrite OMS evidence/,
  );
  assert.match(
    requests[0].systemInstruction.parts[0].text,
    /return an empty array when none are allowed/,
  );
  assert.match(requests[0].contents[0].parts[0].text, /trusted facts/);
  assert.match(requests[0].contents[0].parts[0].text, /observed downstream Analytics mismatch/);
  assert.match(
    requests[1].contents[0].parts[0].text,
    /previous response was rejected because/,
  );

  const input = JSON.parse(
    requests[0].contents[0].parts[0].text.split("\n").at(-1),
  );
  const schema = requests[0].generationConfig.responseSchema.properties.caseAnalyses;
  for (const [caseId, caseFindings] of groupFindingsByCaseId(findings)) {
    assert.ok(schema.required.includes(caseId));
    assert.deepEqual(
      schema.properties[caseId].properties.caseId.enum,
      [caseId],
    );
    assert.deepEqual(
      schema.properties[caseId].properties.findingIds.items.enum,
      caseFindings.map((finding) => finding.id),
    );
    const allowedMechanisms = input.cases.find(
      (item) => item.caseId === caseId,
    ).allowedRootCauseMechanisms;
    if (allowedMechanisms.length > 0) {
      assert.deepEqual(
        schema.properties[caseId].properties.rootCauseMechanisms.items.enum,
        allowedMechanisms,
      );
    } else {
      assert.equal(
        Object.hasOwn(
          schema.properties[caseId].properties.rootCauseMechanisms.items,
          "enum",
        ),
        false,
      );
      assert.match(
        schema.properties[caseId].properties.rootCauseMechanisms.description,
        /empty array/,
      );
    }
    assert.deepEqual(
      output.caseAnalyses
        .find((item) => item.caseId === caseId)
        .findingIds.slice()
        .sort(),
      caseFindings.map((finding) => finding.id).sort(),
    );
  }

  assert.equal(output.caseAnalyses.length, new Set(findings.map((f) => f.caseId)).size);
  assert.deepEqual(
    output.caseAnalyses.map((item) => item.caseId).sort(),
    [...new Set(findings.map((finding) => finding.caseId))].sort(),
  );
  assert.deepEqual(
    output.caseAnalyses.flatMap((item) => item.findingIds).sort(),
    findings.map((finding) => finding.id).sort(),
  );
});

test("second invalid response fails closed after exactly two requests", () => {
  const invalidFirstResponse = JSON.parse(createModelResponse());
  invalidFirstResponse.caseAnalyses["ORD-1008"].explanation =
    "OMS source data is wrong and should be corrected.";
  const invalidSecondResponse = JSON.parse(createModelResponse());
  const processCase = invalidSecondResponse.caseAnalyses["ORD-1012"];
  processCase.rootCauseMechanisms = ["NOT_ALLOWED_TEST_MECHANISM"];

  const { result, requests, output } = runExplainer([
    JSON.stringify(invalidFirstResponse),
    JSON.stringify(invalidSecondResponse),
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(requests.length, 2);
  assert.match(result.stderr, /not allowed for caseId "ORD-1012"/);
  assert.match(result.stderr, /No analysis was saved/);
  assert.equal(output, null);
});

test("unsupported business behavior is rejected without persisting output", () => {
  const invalidResponse = JSON.parse(createModelResponse());
  invalidResponse.caseAnalyses["ORD-1008"].investigationSteps = [
    "Review the missing refund records.",
  ];

  const { result, requests, output } = runExplainer([
    JSON.stringify(invalidResponse),
    JSON.stringify(invalidResponse),
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(requests.length, 2);
  assert.match(result.stderr, /unsupported business behavior "refund"/i);
  assert.equal(output, null);
});

test("a case with no allowed mechanisms is constrained to and returns an empty array", () => {
  const sourceFinding = {
    id: "DATA-TEST-001",
    caseId: "CASE-SOURCE-ONLY",
    rule: "SOURCE_DATA_RULE",
    category: "SOURCE_DATA",
    severity: "HIGH",
    description: "Test-only source-data finding.",
  };
  const response = JSON.parse(createModelResponse([sourceFinding]));
  const { result, requests, output } = runExplainer(
    [JSON.stringify(response)],
    [sourceFinding],
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.length, 1);
  const schema = requests[0].generationConfig.responseSchema.properties.caseAnalyses;
  assert.equal(
    schema.properties["CASE-SOURCE-ONLY"].properties.rootCauseMechanisms.items.type,
    "STRING",
  );
  assert.equal(
    Object.hasOwn(
      schema.properties["CASE-SOURCE-ONLY"].properties.rootCauseMechanisms.items,
      "enum",
    ),
    false,
  );
  assert.deepEqual(output.caseAnalyses[0].rootCauseMechanisms, []);
  assert.deepEqual(output.caseAnalyses[0].findingIds, ["DATA-TEST-001"]);

  const invalidResponse = JSON.parse(createModelResponse([sourceFinding]));
  invalidResponse.caseAnalyses["CASE-SOURCE-ONLY"].rootCauseMechanisms = [
    "INGESTION",
  ];
  const rejected = runExplainer(
    [JSON.stringify(invalidResponse), JSON.stringify(invalidResponse)],
    [sourceFinding],
  );
  assert.notEqual(rejected.result.status, 0);
  assert.match(rejected.result.stderr, /not allowed for caseId "CASE-SOURCE-ONLY"/);
  assert.equal(rejected.requests.length, 2);
  assert.equal(rejected.output, null);
});
