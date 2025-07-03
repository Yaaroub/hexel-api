// middleware.js
import { NextResponse } from 'next/server';

const allowedOrigins = ['https://hexel-tech.de']; // Produktionsdomain

export function middleware(req) {
  const origin = req.headers.get('origin');
  const isPreflight = req.method === 'OPTIONS';

  if (origin && allowedOrigins.includes(origin)) {
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (isPreflight) {
      return new NextResponse(null, { status: 204, headers });
    }

    const res = NextResponse.next();
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/contact/:path*',
};
