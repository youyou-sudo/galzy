import { t } from 'elysia'

/**
 * /walkthroughs 查询参数。
 *
 * 与 /characters 同口径：只做非空校验，不校验「形态」——vNNN / kgX / 纯数字
 * 都是历史合法入口，形态判断集中在 libs/identity（唯一解析入口），这里再写
 * 一份正则只会漂移。
 */
export namespace WalkthroughModel {
  export const gameQuery = t.Object({
    gameId: t.String({
      minLength: 1,
      description: '游戏展示身份（vNNN 或 kgX；旧链接会归一到 canonical）',
    }),
  })
  export type gameQuery = typeof gameQuery.static

  export const infoQuery = t.Object({
    id: t.String({
      minLength: 1,
      description: 'kungal 攻略 id（十进制字符串）',
    }),
  })
  export type infoQuery = typeof infoQuery.static
}
