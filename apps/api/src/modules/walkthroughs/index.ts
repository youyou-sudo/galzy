import { Elysia } from 'elysia'
import { WalkthroughModel } from './model'
import { Walkthrough } from './service'

/**
 * 攻略查询（公开只读）。
 *
 * 数据源只有 kungal（NextMoe·未萌）目录的 walkthrough：本地表
 * galrc_kungal_walkthroughs 是按 work 同步下来的快照，chart 整块透传。
 * vndb 侧没有攻略数据，这里只借 vndb 锚点定位作品。
 *
 * 两个端点与前端约定（**字段名不得改**）：
 * - GET /walkthroughs/game?gameId=vNNN|kgX → { gameId, workId, items: 摘要[] }
 * - GET /walkthroughs/info?id=<id>         → 摘要 + chart
 */
export const walkthroughs = new Elysia({ prefix: '/walkthroughs' })
  .get(
    '/game',
    async ({ query: { gameId } }) => await Walkthrough.Game({ gameId }),
    {
      query: WalkthroughModel.gameQuery,
    },
  )
  .get('/info', async ({ query: { id } }) => await Walkthrough.Info({ id }), {
    query: WalkthroughModel.infoQuery,
  })
