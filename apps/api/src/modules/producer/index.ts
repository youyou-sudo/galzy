import { Elysia } from 'elysia'
import { ProducerModel } from './model'
import { Producer } from './service'

export const producer = new Elysia({ prefix: '/producer' })
  .get(
    '/info',
    async ({ query: { pid } }) => {
      return await Producer.info({ pid })
    },
    {
      query: ProducerModel.producerGet,
    },
  )
  .get(
    '/gamelists',
    async ({ query: { pid } }) => {
      return await Producer.gamelists({ pid })
    },
    {
      query: ProducerModel.producerGet,
    },
  )
