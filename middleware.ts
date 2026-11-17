import { geolocation, next, rewrite } from "@vercel/functions";

export default function middleware(request: Request): Response {
  if (geolocation(request).country === "US") {
    return rewrite(new URL("/blocked.html", request.url), { status: 451 });
  }
  return next();
}

export const config = { matcher: "/((?!blocked\\.html$).*)" };
