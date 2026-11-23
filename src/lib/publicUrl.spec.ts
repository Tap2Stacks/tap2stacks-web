import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_URL, resolvePublicUrl } from "./publicUrl";

describe("resolvePublicUrl", () => {
  it("defaults to the tentative sslip.io URL", () => {
    expect(resolvePublicUrl(undefined)).toBe(DEFAULT_PUBLIC_URL);
    expect(resolvePublicUrl("   ")).toBe(DEFAULT_PUBLIC_URL);
  });

  it("strips trailing slashes from custom URLs", () => {
    expect(resolvePublicUrl("https://tap2stacks.example.com/")).toBe(
      "https://tap2stacks.example.com",
    );
    expect(resolvePublicUrl("  https://tap2stacks.example.com///  ")).toBe(
      "https://tap2stacks.example.com",
    );
  });

  it("rejects non-http protocols", () => {
    expect(() => resolvePublicUrl("ftp://bad.example.com")).toThrow();
  });
});
