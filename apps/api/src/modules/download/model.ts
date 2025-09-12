import { t } from 'elysia'

export namespace DownloadModel {
  export const path = t.Object({
    path: t.String({ minLength: 1 }),
  })
  export const workerConfigFormDel = t.Object({
    id: t.Number({ minimum: 0 }),
  })
  export const workerConfigForm = t.Object({
    id: t.Union([t.String(), t.Null(), t.Undefined()]),
    a_email: t.String({ minLength: 1 }),
    a_key: t.String({ minLength: 1 }),
    account_id: t.String({ minLength: 1 }),
    woker_name: t.String({ minLength: 1 }),
    url_endpoint: t.String({ minLength: 1 }),
  })

  export const nodeEnaledAc = t.Object({
    nodeId: t.Number({ minimum: 0 }),
    boole: t.Boolean(),
  })

  export type workerConfigForm = typeof workerConfigForm.static
  export type path = typeof path.static
  export type workerConfigFormDel = typeof workerConfigFormDel.static
  export type nodeEnaledAc = typeof nodeEnaledAc.static
}
