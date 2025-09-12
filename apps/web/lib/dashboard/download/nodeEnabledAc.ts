'use server'

import { api } from '@libs'

export const nodeEnaledAc = async (nodeId: number, boole: boolean) => {
  await api.download.worker.confignodeEnaledAcForm.post({ nodeId, boole })
}
