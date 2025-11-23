import { Elysia } from 'elysia'
import { DownloadModel } from './model'
import { Download } from './service'

export const download = new Elysia({ prefix: '/download' })
  .get(
    '/path',
    async ({ query: { path, game_id } }) => {
      return Download.DownloadGet({ path, game_id })
    },
    {
      query: DownloadModel.path,
    },
  )
  .get('/worker', async () => {
    return Download.Worker()
  })
  .post(
    '/worker/configForm',
    async ({
      body: { id, a_email, a_key, account_id, woker_name, url_endpoint },
    }) => {
      await Download.workerConfigFormPut({
        id,
        a_email,
        a_key,
        account_id,
        woker_name,
        url_endpoint,
      })
    },
    {
      body: DownloadModel.workerConfigForm,
    },
  )
  .delete(
    '/worker/configFormDel',
    async ({ body: { id } }) => {
      return Download.workerConfigFormDel({ id })
    },
    {
      body: DownloadModel.workerConfigFormDel,
    },
  )

  .post(
    '/worker/confignodeEnaledAcForm',
    async ({ body: { nodeId, boole } }) => {
      return Download.nodeEnaledAc({ nodeId, boole })
    },
    {
      body: DownloadModel.nodeEnaledAc,
    },
  )
