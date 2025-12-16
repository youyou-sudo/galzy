'use server'
import type { StrategyModel } from '@api/modules/strategy/model'
import { api } from '@libs'
import type { ContentData } from '@web/components/dashboard/dataManagement/strategy/stores/EditStores'
import { cacheLife, cacheTag, updateTag } from 'next/cache'

export const strategyListGet = async (id: string) => {
  'use cache'
  cacheTag(`introduction-${id}`)
  cacheLife('days')
  const { data } = await api.strategy.gamestrategys.get({
    query: { gameId: id },
  })
  return data
}

export const strategyListUpdate = async (id: string, data: ContentData) => {
  updateTag(`introduction-content-${id}`)
  await api.strategy.strategylistupdate.post({
    id,
    data,
  })
}

export const strategyListCreate = async (
  id: string,
  data: ContentData,
  userid: string,
) => {
  updateTag(`introduction-${id}`)
  await api.strategy.strategylistcreate.post({
    id,
    data,
    userid,
  })
}

export const strategyListDelete = async ({
  strategyId,
  id,
}: StrategyModel.strategy & { id: string }) => {
  updateTag(`introduction-${id}`)
  await api.strategy.strategylistdelete.post({
    strategyId,
  })
}
