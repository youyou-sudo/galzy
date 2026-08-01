import { ViewsModel } from '@api/modules/views/model'
import { ViewsService } from '@api/modules/views/service'
import { Elysia } from 'elysia'

// 客户端 IP：优先取 BFF（web SSR）透传的 x-client-ip（见 @web/lib/ip-pass），
// 直连 API 的请求退回 socket 地址（server.requestIP）。截断到 64 字符防滥用。
function getClientIp(
  request: Request,
  server:
    | {
        requestIP?: (req: Request) => { address: string } | null
      }
    | null
    | undefined,
): string | null {
  const headerIp = request.headers.get('x-client-ip')?.trim().slice(0, 64)
  if (headerIp) return headerIp
  try {
    if (server && typeof server.requestIP === 'function') {
      const ipInfo = server.requestIP(request)
      if (ipInfo?.address) return ipInfo.address
    }
  } catch {
    /* 拿不到 IP 就不限流 */
  }
  return null
}

export const views = new Elysia({ prefix: '/views' })
  .post(
    '/game',
    async ({ body, request, server }) => {
      await ViewsService.recordGameView(body, getClientIp(request, server))
    },
    {
      body: ViewsModel.RecordGameView,
    },
  )
  .post(
    '/tag',
    async ({ body, request, server }) => {
      await ViewsService.recordTagView(body, getClientIp(request, server))
    },
    {
      body: ViewsModel.RecordTagView,
    },
  )
  .get('/hot/game', async () => {
    return await ViewsService.getHotGames()
  })
  .get('/hot/tag', async () => {
    return await ViewsService.getHotTags()
  })
