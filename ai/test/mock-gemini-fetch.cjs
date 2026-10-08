const fs = require("node:fs");

const endpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const responses = JSON.parse(
  fs.readFileSync(process.env.AI_MOCK_RESPONSES_FILE, "utf8"),
);
const requests = [];

globalThis.fetch = async (input, options = {}) => {
  if (String(input) !== endpoint) {
    throw new Error("Offline test blocked an unexpected network request.");
  }

  requests.push(JSON.parse(options.body));
  fs.writeFileSync(
    process.env.AI_MOCK_REQUESTS_FILE,
    JSON.stringify(requests, null, 2),
  );

  const responseText = responses[requests.length - 1];
  if (typeof responseText !== "string") {
    throw new Error("Offline test received more requests than mock responses.");
  }

  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: responseText }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
