'use server'

import type { DownloadModel } from '@api/modules/download/model'
import { api } from '@libs'

export const configFormPut = async ({
  id,
  a_email,
  a_key,
  account_id,
  woker_name,
  url_endpoint,
}: DownloadModel.workerConfigForm) => {
  await api.download.worker.configForm.post({
    id,
    a_email,
    a_key,
    account_id,
    woker_name,
    url_endpoint,
  })
}

export const configFormDel = async (
  id: DownloadModel.workerConfigFormDel['id'],
) => {
  await api.download.worker.configFormDel.delete({ id })
}
