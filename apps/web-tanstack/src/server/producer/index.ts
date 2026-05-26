import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { elysiaErrorF } from '@web/lib'

export const producerInfo = createServerFn()
  .inputValidator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const { data: producer, error } = await api.producer.info.get({
      query: { pid: data.pid },
    })
    elysiaErrorF(error)
    return producer
  })

export const producerGameList = createServerFn()
  .inputValidator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const { data: producer, error } = await api.producer.gamelists.get({
      query: { pid: data.pid },
    })
    elysiaErrorF(error)
    return producer
  })
