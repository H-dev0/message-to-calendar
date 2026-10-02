import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/extract-task/route";

const request = (body: string) => new Request("http://localhost/api/extract-task", { method: "POST", body });

test("server rejects malformed, empty, oversized and invalid-zone input before calling Gemini", async () => {
  for (const body of ["not-json", "null", "[]", JSON.stringify({ message: " ", timeZone: "UTC" }), JSON.stringify({ message: "test", timeZone: "invalid" }), JSON.stringify({ message: "x".repeat(10001), timeZone: "UTC" })]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.equal((await POST(request(" ".repeat(65001)))).status, 413);
});

test("missing local API key produces a clear error instead of fake extraction", async () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await POST(request(JSON.stringify({ message: "Submit tomorrow at 11:59 PM", timeZone: "Asia/Riyadh" })));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /GEMINI_API_KEY/);
  } finally {
    if (original !== undefined) process.env.GEMINI_API_KEY = original;
  }
});
