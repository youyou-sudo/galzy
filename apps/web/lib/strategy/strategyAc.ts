'use server'
import type { StrategyModel } from '@api/modules/strategy/model'
import { api } from '@libs'
import type { ContentData } from '@web/components/dashboard/dataManagement/strategy/stores/EditStores'

export const strategyListGet = async (id: string) => {
  const { data } = await api.strategy.gamestrategys.get({
    query: { gameId: id },
  })
  return data
}

export const strategyListUpdate = async (id: string, data: ContentData) => {
  await api.strategy.strategylistupdate.post({
    id,
    data,
  })
}

export const strategyListCreate = async (id: string, data: ContentData, userid: string) => {
  await api.strategy.strategylistcreate.post({
    id,
    data,
    userid,
  })
}

export const strategyListDelete = async ({
  strategyId,
  gameId,
}: StrategyModel.strategy) => {
  await api.strategy.strategylistdelete.post({
    strategyId,
    gameId,
  })
}
