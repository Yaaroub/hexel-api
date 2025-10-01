// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

// Erlaube mehrere Origins (www, non-www, lokal, Preview)
const ALLOWLIST = new Set([
  "https://hexel-tech.de",
  "https://www.hexel-tech.de",
  "http://localhost:3000",
  // optional: Vercel-Preview-Domain
  "https://hexel-node1.vercel.app",
]);

function getOrigin(req: NextRequest) {
  return req.headers.get("origin") ?? "";
}

export function middleware(req: NextRequest) {
  const origin = getOrigin(req);
  const isAllowed = ALLOWLIST.has(origin);

  // Preflight: Browser fragt "darf ich POST mit diesen Headern?"
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (isAllowed) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      // Erlaube GET + POST (wir haben /api/chat GET-Healthcheck + POST)
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    // CORS caches sind origin-spezifisch
    res.headers.set("Vary", "Origin");
    return res;
  }

  // Für "normale" Requests (GET/POST) nur ACAO setzen, wenn erlaubt
  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    // Falls du Cookies/Credentials brauchst: auch erlauben
    // res.headers.set("Access-Control-Allow-Credentials", "true");
  }
  res.headers.set("Vary", "Origin");
  return res;
}

// Gilt für alle API-Routen
export const config = {
  matcher: "/api/:path*",
};
