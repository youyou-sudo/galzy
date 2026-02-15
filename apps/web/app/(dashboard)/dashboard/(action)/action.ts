'use server'

import { api } from '@libs'

export const OpenlistAc = async () => {
  await api.task.alistSyncScript.get()
  return true
}

export const WorkerDataAC = async () => {
  await api.task.workerDataPull.get()
  return true
}

export const meiliSearchAddContenAc = async () => {
  await api.task.meiliSearchAddIndex.get()
  return true
}

export const meiliSearchAddTagAc = async () => {
  await api.task.meiliSearchAddTag.get()
  return true
}
