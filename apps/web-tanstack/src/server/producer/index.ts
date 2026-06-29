import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import z from 'zod'

export const producerInfo = createServerFn()
  .validator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const { data: producer, error } = await api.producer.info.get({
      query: { pid: data.pid },
    })
    elysiaErrorF(error)
    return producer
  })

export const producerGameList = createServerFn()
  .validator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const { data: producer, error } = await api.producer.gamelists.get({
      query: { pid: data.pid },
    })
    elysiaErrorF(error)
    return producer
  })
