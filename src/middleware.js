// middleware.js
import { NextResponse } from "next/server";

const ALLOWLIST = new Set([
  "https://hexel-tech.de",
  "https://www.hexel-tech.de",
  "http://localhost:3000",
  "https://hexel-node1.vercel.app",
]);

export function middleware(request) {
  const origin = request.headers.get("origin") || "";
  const isAllowed = ALLOWLIST.has(origin);

  // Preflight
  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (isAllowed) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    res.headers.set("Vary", "Origin");
    return res;
  }

  // Normale Requests
  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  res.headers.set("Vary", "Origin");
  return res;
}

export const config = { matcher: "/api/:path*" };
