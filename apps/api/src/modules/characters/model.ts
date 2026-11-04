import { t } from 'elysia'

/**
 * /characters 查询参数。
 *
 * 两个参数都只做非空校验，不校验「形态」：vNNN/kgX/数字都是历史合法入口，
 * 形态判断集中在 libs/identity（唯一解析入口），这里再写一份正则只会漂移。
 */
export namespace CharacterModel {
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
      description: 'kungal 角色 id（十进制字符串）',
    }),
  })
  export type infoQuery = typeof infoQuery.static
}
