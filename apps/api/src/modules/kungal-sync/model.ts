import { t } from 'elysia'

export namespace KungalSyncModel {
  export const SyncResult = t.Object({
    ok: t.Boolean(),
    message: t.String(),
  })

  export type syncResult = typeof SyncResult.static
}
