import type { NextRequest } from 'next/server'
import '@web/lib/env'

const API_BASE = `${process.env.API_HOST}`

async function proxy(req: NextRequest) {
  const { pathname, search } = new URL(req.url)

  const targetUrl = `${API_BASE}${pathname}${search}`

  const res = await fetch(targetUrl, {
    method: req.method,
    headers: req.headers,
    body:
      req.method !== 'GET' && req.method !== 'HEAD'
        ? await req.text()
        : undefined,
    cache: 'no-store',
  })

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  })
}

export async function GET(req: NextRequest) {
  return proxy(req)
}

export async function POST(req: NextRequest) {
  return proxy(req)
}
