'use server'
import { api } from '@libs'
import { updateTag } from 'next/cache'

export const dwAcConst = async (path?: string, game_id?: string) => {
  updateTag(`dwcount-${game_id}`)
  if (!path) {
    throw new Error('喵喵什么都不知道喵，请提供下载的资源的路径喵～')
  }
  if (!path) {
    throw new Error('喵喵什么都不知道喵，请提供下载的资源的路径喵～')
  }
  if (!game_id) {
    throw new Error('喵喵什么都不知道喵，请提供下载的游戏 ID 喵～')
  }

  const { data, error, status } = await api.download.path.get({
    query: { path, game_id },
  })

  if (status >= 400) {
    console.log(data)
    throw new Error(error?.value.message || '下载请求失败喵～')
  }

  if (!data?.raw_url) {
    throw new Error('资源 URL 不存在喵～')
  }

  return {
    url: data.raw_url,
  }
}
