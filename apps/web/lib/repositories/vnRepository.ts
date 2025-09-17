'use server'
import { api } from '@libs'

// [x] 使用 nextjs cache 来进行缓存以避免重复请求（以解决在 layout.tsx 中每次切换路由都重复请求渲染的问题）
export const getVnDetails = async (id: string) => {
  // 'use cache'
  const { data } = await api.games.get({
    query: {
      id,
    },
  })
  return data
}
