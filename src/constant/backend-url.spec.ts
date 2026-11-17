import { describe, expect, it } from "vitest";
import { resolveBackendUrl } from "./backend-url";

describe("resolveBackendUrl", () => {
  const origin = "https://example.trycloudflare.com";

  it("uses the configured URL when set", () => {
    expect(resolveBackendUrl("http://127.0.0.1:5001", origin)).toBe("http://127.0.0.1:5001");
  });

  it("drops a trailing slash from the configured URL", () => {
    expect(resolveBackendUrl("http://127.0.0.1:5001/", origin)).toBe("http://127.0.0.1:5001");
  });

  it.each([undefined, "", "   "])("falls back to the page origin when unset (%s)", (value) => {
    expect(resolveBackendUrl(value, origin)).toBe(origin);
  });
});
