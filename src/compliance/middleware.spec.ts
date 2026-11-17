import { expect, it } from "vitest";
import middleware from "../../middleware";

it("middleware rewrites US to /blocked.html with 451 and passes VN", () => {
  const us = middleware(
    new Request("https://example.com/trade", {
      headers: { "x-vercel-ip-country": "US" },
    }),
  );
  expect(us.status).toBe(451);
  expect(us.headers.get("x-middleware-rewrite")).toBe("https://example.com/blocked.html");
  const vn = middleware(
    new Request("https://example.com/trade", {
      headers: { "x-vercel-ip-country": "VN" },
    }),
  );
  expect(vn.headers.get("x-middleware-next")).toBe("1");
});
