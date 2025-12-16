import { getSearch } from '@web/lib/search/meilisearch'
import { tryit } from 'radash'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  if (!q) {
    return new Response('喵喵什么都不知道喵，请提供搜索关键词喵～', {
      status: 400,
    })
  }
  const [error, datas] = await tryit(getSearch)({ q, limit: 100 })
  if (error) {
    return new Response('服务出错了喵~', { status: 500 })
  }
  return Response.json(datas)
}
