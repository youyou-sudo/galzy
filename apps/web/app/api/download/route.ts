import { alistDownloadGet } from '@web/lib/dashboard/download/alistFileRaw'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) {
    return new Response('喵喵什么都不知道喵，请提供下载的资源的路径喵～', {
      status: 400,
    })
  }
  const raw = await alistDownloadGet(path)
  if (!raw?.raw_url) {
    return new Response(raw?.message, {
      status: 400,
    })
  }

  return Response.redirect(raw?.raw_url!, 302)
}
