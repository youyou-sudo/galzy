'use server'
import { api } from '@libs'
export const alistDownloadGet = async (path: string) => {
  const { data } = await api.download.path.get({
    query: {
      path,
    },
  })
  return data
}
