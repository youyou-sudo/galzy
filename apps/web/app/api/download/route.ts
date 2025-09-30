import { api } from '@libs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) {
    return new Response('喵喵什么都不知道喵，请提供下载的资源的路径喵～', {
      status: 400,
    })
  }
  const data = await api.download.path.get({
    query: {
      path,
    },
  })
  if (data.status >= 400) {
    return new Response(`${data.error?.value.message}`, {
      status: 400,
    })
  }

  return Response.redirect(data.data?.raw_url!, 302)
}
