import { t } from 'elysia'

export namespace DownloadModel {
  // ── 请求参数 ──────────────────────────────────
  export const path = t.Object({
    path: t.String({ minLength: 1 }),
    game_id: t.String({ minLength: 1 }),
  })

  export const workerConfigForm = t.Object({
    id: t.Optional(t.String()),
    a_email: t.String({ minLength: 1 }),
    a_key: t.String({ minLength: 1 }),
    account_id: t.String({ minLength: 1 }),
    woker_name: t.String({ minLength: 1 }),
    url_endpoint: t.String({ minLength: 1 }),
  })

  export const workerConfigFormDel = t.Object({
    id: t.Number({ minimum: 0 }),
  })

  export const nodeEnaledAc = t.Object({
    nodeId: t.Number({ minimum: 0 }),
    boole: t.Boolean(),
  })

  // ── 响应 ──────────────────────────────────────
  export const DownloadGet = t.Object({
    success: t.Boolean(),
    raw_url: t.String(),
    sign: t.String(),
  })

  // ── 类型推导 ──────────────────────────────────
  export type path = typeof path.static
  export type workerConfigForm = typeof workerConfigForm.static
  export type workerConfigFormDel = typeof workerConfigFormDel.static
  export type nodeEnaledAc = typeof nodeEnaledAc.static
  export type DownloadGet = typeof DownloadGet.static
}

// ── Alist FS 相关类型 ────────────────────────────
export interface AlistFsObject {
  created?: Date
  hash_info?: Record<string, string> | null
  hashinfo?: string
  id?: string
  is_dir?: boolean
  modified?: Date
  mount_details?: AlistStorageDetails | null
  name?: string
  path?: string
  sign?: string
  /** 字节，目录为 0 */
  size?: number
  thumb?: string
  /** 0=Unknown 1=Folder 2=Video 3=Audio 4=Text 5=Image */
  type?: number
}

export interface AlistStorageDetails {
  driver_name?: string
  free_space?: number
  total_space?: number
}

export interface AlistFsResponse {
  code: number
  data?: AlistFsObject
  message: string
}
