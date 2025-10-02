import { api } from '@libs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  if (!q) {
    return new Response('喵喵什么都不知道喵，请提供搜索关键词喵～', {
      status: 400,
    })
  }
  const data = await api.search.get({
    query: {
      q: q,
      limit: 100,
    },
  })
  if (data.status >= 400) {
    return new Response(`${data.error?.value.message}`, {
      status: 400,
    })
  }
  return Response.json(data.data)
}
