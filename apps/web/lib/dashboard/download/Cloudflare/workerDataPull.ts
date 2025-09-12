'use server'
import { api } from '@libs'

export const workerDataGet = async () => {
  const { data } = await api.download.worker.get()
  return data
}
