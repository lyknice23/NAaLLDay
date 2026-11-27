import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absoluteUrl, configuredOrigin, originFromRequest } from "./site-origin.ts";

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("configuredOrigin", () => {
  it("uses BETTER_AUTH_URL and keeps only the origin", () => {
    assert.equal(
      configuredOrigin({ BETTER_AUTH_URL: "https://www.alldayna.xyz/some/path" }),
      "https://www.alldayna.xyz",
    );
  });

  it("returns null when unset or unusable", () => {
    assert.equal(configuredOrigin({}), null);
    assert.equal(configuredOrigin({ BETTER_AUTH_URL: "   " }), null);
    assert.equal(configuredOrigin({ BETTER_AUTH_URL: "not a url" }), null);
  });
});

describe("originFromRequest", () => {
  it("prefers the forwarded host and protocol behind a proxy", () => {
    const req = request("http://internal:8080/api/attendance-letter?reference=x", {
      "x-forwarded-host": "naallday-preview.grok-sandbox.com",
      "x-forwarded-proto": "https",
    });
    assert.equal(originFromRequest(req), "https://naallday-preview.grok-sandbox.com");
  });

  it("takes the first value of comma-separated forwarded headers", () => {
    const req = request("http://internal:8080/verify/x", {
      "x-forwarded-host": "preview.example.com, internal",
      "x-forwarded-proto": "https, http",
    });
    assert.equal(originFromRequest(req), "https://preview.example.com");
  });

  it("falls back to the request URL on local development", () => {
    assert.equal(
      originFromRequest(request("http://localhost:8080/verify/x")),
      "http://localhost:8080",
    );
    assert.equal(
      originFromRequest(request("http://127.0.0.1:8080/")),
      "http://127.0.0.1:8080",
    );
  });
});

describe("absoluteUrl", () => {
  it("joins with exactly one slash", () => {
    assert.equal(
      absoluteUrl("https://example.com/", "/verify/abc"),
      "https://example.com/verify/abc",
    );
    assert.equal(absoluteUrl("https://example.com", "verify/abc"), "https://example.com/verify/abc");
  });
});
