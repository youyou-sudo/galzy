import { t } from 'elysia'

export namespace ProducerModel {
  export const producerGet = t.Object({
    pid: t.String(),
  })
  export type ProducerGet = typeof producerGet.static
}
