// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const origin = request.headers.get('origin')
  const allowedOrigin = 'https://hexel-tech.de'

  // Nur auf CORS reagieren, wenn die Origin passt
  if (origin === allowedOrigin && request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.set('Access-Control-Max-Age', '86400')
    return response
  }

  // Für andere Anfragen: CORS Header hinzufügen
  const response = NextResponse.next()
  if (origin === allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
