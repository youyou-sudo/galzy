'use server'
import { api } from '@libs'

export const dwAcConst = async (path?: string) => {
  if (!path) {
    throw new Error('喵喵什么都不知道喵，请提供下载的资源的路径喵～')
  }

  const { data, error, status } = await api.download.path.get({
    query: { path },
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
