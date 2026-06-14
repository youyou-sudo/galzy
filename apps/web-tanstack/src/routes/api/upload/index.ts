import { createFileRoute } from '@tanstack/react-router'

const API_BASE = process.env.API_HOST

/**
 * 透传上传请求到 api 项目 /media/uploadavatar
 * 使用 ReadableStream 流式转发 body，前端可借此计算上传进度
 */
async function uploadProxy(request: Request) {
  const targetUrl = `${API_BASE}/media/uploadavatar`

  // 转发请求头，移除 host 避免连接冲突
  const headers = new Headers(request.headers)
  headers.delete('host')

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    redirect: 'manual',
    body: request.body,
  })

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  })
}

export const Route = createFileRoute('/api/upload/')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => uploadProxy(request),
    },
  },
})
