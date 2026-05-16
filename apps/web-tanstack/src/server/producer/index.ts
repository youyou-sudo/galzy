import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { assertOk } from '#/lib'

export const producerInfo = createServerFn()
  .inputValidator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const producer = await api.producer.info.get({ query: { pid: data.pid } })
    return assertOk(producer, `${data.pid} producer 信息`)
  })

export const producerGameList = createServerFn()
  .inputValidator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const producer = await api.producer.gamelists.get({
      query: { pid: data.pid },
    })
    return assertOk(producer, `${data.pid} producer 游戏列表`)
  })
