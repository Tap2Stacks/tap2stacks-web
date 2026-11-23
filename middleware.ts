import { geolocation, next, rewrite } from "@vercel/functions";

export default function middleware(request: Request): Response {
  const { pathname } = new URL(request.url);
  if (pathname === "/trading-terms.html") return next();

  if (geolocation(request).country === "US") {
    return rewrite(new URL("/blocked.html", request.url), {
      status: 451,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return next();
}

export const config = { matcher: "/((?!blocked\\.html$).*)" };
