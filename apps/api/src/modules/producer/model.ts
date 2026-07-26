import { t } from 'elysia'

export namespace ProducerModel {
  export const producerGet = t.Object({
    pid: t.String(),
  })
  export type ProducerGet = typeof producerGet.static

  export const Search = t.Object({
    q: t.String({ minLength: 1 }),
    limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
  })
  export type search = typeof Search.static
}
