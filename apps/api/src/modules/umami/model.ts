import { t } from "elysia";

export namespace UmamiModel {
  export const gameDloadNuber = t.Object({
    vid: t.String({ minLength: 1 }),
  })
  export type gameDloadNuber = typeof gameDloadNuber.static
  export type remfTag = { value: string; total: number }[]
  export type remfGame = { value: string; total: number }[]
}
