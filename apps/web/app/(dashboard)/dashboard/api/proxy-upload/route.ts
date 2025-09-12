// app/api/proxy-upload/route.ts

import type { NextRequest } from 'next/server'
import { env } from 'next-runtime-env'

export async function PUT(req: NextRequest) {
  const body = req.body
  if (!body) {
    return new Response('No file body', { status: 400 })
  }

  const targetUrl = `${env('OPENLIST_HOST')}/api/fs/put`

  const headers = new Headers()

  // ✅ 从环境变量中注入 Authorization
  const authToken = env('OPENLIST_API_KEY')
  if (authToken) {
    headers.set('Authorization', authToken)
  }

  // ✅ 可选：继续转发其他有用的请求头
  const forwardedHeaders = req.headers
  for (const [key, value] of forwardedHeaders.entries()) {
    if (['file-path', 'content-type', 'as-task'].includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  }

  const upstreamRes = await fetch(targetUrl, {
    method: 'PUT',
    headers,
    body,
    // @ts-expect-error
    duplex: 'half',
  })

  const resBody = await upstreamRes.arrayBuffer()

  return new Response(resBody, {
    status: upstreamRes.status,
    headers: {
      'Content-Type':
        upstreamRes.headers.get('Content-Type') || 'application/octet-stream',
    },
  })
}
