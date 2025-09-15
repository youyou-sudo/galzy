'use server'

import { api } from '@libs'

export const OpenlistAc = async () => {
  await api.task.alistSyncScript.get()
}

export const WorkerDataAC = async () => {
  await api.task.workerDataPull.get()
}

export const meiliSearchAddContenAc = async () => {
  await api.task.meiliSearchAddIndex.get()
}

export const meiliSearchAddTagAc = async () => {
  await api.task.meiliSearchAddTag.get()
}
