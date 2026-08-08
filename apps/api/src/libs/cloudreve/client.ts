import { delKv, getKv, setKv } from '@api/libs/redis'

// ── 环境配置 ──────────────────────────────────────────
const CLOUDREVE_HOST = process.env.CLOUDREVE_HOST
const CLOUDREVE_EMAIL = process.env.CLOUDREVE_EMAIL
const CLOUDREVE_PASSWORD = process.env.CLOUDREVE_PASSWORD
// 下载直链 HOST：拼接文件路径生成对外下载链接（如 https://dl.example.com）
const CLOUDREVE_DOWNLOAD_HOST = process.env.CLOUDREVE_DOWNLOAD_HOST

// Cloudreve 文件 URI 前缀：cloudreve://my 表示当前登录用户自己的网盘
const CLOUDREVE_FS_PREFIX = 'cloudreve://my'

const TOKEN_CACHE_KEY = 'galzy:cloudreve:access_token'
const REQUEST_TIMEOUT_MS = 30_000
// 默认分页大小（List files 接口的 max_page_size 一般为 2000）
const DEFAULT_PAGE_SIZE = 2000

// ── 类型 ──────────────────────────────────────────────
export interface CloudreveFile {
  id: string
  name: string
  /** 字节数，目录为 0 */
  size: number
  /** 0=文件 1=文件夹 */
  type: number
  /** 文件路径（不含 cloudreve:// 前缀），如 /Games/%5Bvndb-v123%5D（已百分号编码） */
  path: string
}

/** Cloudreve API 业务错误（code !== 0） */
export class CloudreveError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
    this.name = 'CloudreveError'
  }
}

// ── 认证 ──────────────────────────────────────────────
interface TokenCache {
  token: string
  /** 过期时间（epoch ms） */
  expiresAt: number
}

let memToken: TokenCache | null = null

async function login(): Promise<TokenCache> {
  const res = await fetch(`${CLOUDREVE_HOST}/api/v4/session/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: CLOUDREVE_EMAIL,
      password: CLOUDREVE_PASSWORD,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as {
    code?: number
    msg?: string
    data?: { token?: { access_token?: string; access_expires?: string } }
  } | null
  if (json?.code !== 0 || !json.data?.token?.access_token) {
    throw new CloudreveError(
      json?.code ?? res.status,
      json?.msg ?? 'Cloudreve 登录失败',
    )
  }
  const expiresAt = json.data.token.access_expires
    ? Date.parse(json.data.token.access_expires)
    : Date.now() + 3600_000
  return {
    token: json.data.token.access_token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 3600_000,
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (memToken && memToken.expiresAt > now + 60_000) return memToken.token

  // Redis 缓存（开发模式 Redis 不生效时退化为每次登录，配合内存缓存兜底）
  const cached = await getKv(TOKEN_CACHE_KEY)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as TokenCache
      if (parsed.token && parsed.expiresAt > now + 60_000) {
        memToken = parsed
        return parsed.token
      }
    } catch {
      // 缓存损坏，重新登录
    }
  }

  const fresh = await login()
  memToken = fresh
  const ttl = Math.max(60, Math.floor((fresh.expiresAt - now) / 1000) - 60)
  await setKv(TOKEN_CACHE_KEY, JSON.stringify(fresh), ttl)
  return fresh.token
}

// ── 底层请求 ──────────────────────────────────────────
interface CloudreveResponse {
  code?: number
  msg?: string
  data?: unknown
}

async function cloudreveRequest(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<CloudreveResponse> {
  const token = await getAccessToken()
  const res = await fetch(`${CLOUDREVE_HOST}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const json = (await res.json().catch(() => ({}))) as CloudreveResponse

  // token 过期：清缓存后重试一次
  if (res.status === 401 && !retried) {
    memToken = null
    await delKv(TOKEN_CACHE_KEY)
    return cloudreveRequest(path, init, true)
  }
  return json
}

async function cloudreveData<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const json = await cloudreveRequest(path, init)
  if (json.code !== 0) {
    throw new CloudreveError(json.code ?? -1, json.msg ?? 'Cloudreve 请求失败')
  }
  return json.data as T
}

// ── 路径转换 ──────────────────────────────────────────
/**
 * alist 风格路径 → Cloudreve 文件 URI。
 * `/Games/[vndb-v123]/file.7z` → `cloudreve://my/Games/%5Bvndb-v123%5D/file.7z`
 */
export function pathToCloudreveUri(path: string): string {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
  return `${CLOUDREVE_FS_PREFIX}/${segments.join('/')}`
}

/**
 * Cloudreve 文件 URI / 裸路径 → 解码后的 alist 风格路径（用于存入 alistb.path）。
 * `cloudreve://my/Games/%5Bvndb-v123%5D/file.7z` 或 `/Games/%5Bvndb-v123%5D/file.7z` → `/Games/[vndb-v123]/file.7z`
 */
export function cloudreveUriToPath(uri: string): string {
  const rest = uri.startsWith(`${CLOUDREVE_FS_PREFIX}/`)
    ? uri.slice(CLOUDREVE_FS_PREFIX.length)
    : uri
  if (!rest) return '/'
  try {
    const decoded = decodeURIComponent(rest)
    return decoded.startsWith('/') ? decoded : `/${decoded}`
  } catch {
    return rest.startsWith('/') ? rest : `/${rest}`
  }
}

// ── 文件列表 / 搜索 ───────────────────────────────────
interface ListFileData {
  files?: CloudreveFile[]
  pagination?: {
    next_token?: string
    is_cursor?: boolean
  }
}

/**
 * 列出目录内容或按 URI 中的搜索条件递归搜索文件。
 * 自动翻页直到取完（cursor 分页优先，offset 分页兜底）。
 */
export async function listCloudreveFiles(
  uri: string,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<CloudreveFile[]> {
  const files: CloudreveFile[] = []
  let nextToken: string | undefined
  let page = 0

  while (true) {
    const params = new URLSearchParams({
      uri,
      page: String(page),
      page_size: String(pageSize),
    })
    if (nextToken) params.set('next_page_token', nextToken)

    const data = await cloudreveData<ListFileData>(`/api/v4/file?${params}`)
    // 只保留路径本身，去掉 cloudreve://my 前缀
    const batch = (data.files ?? []).map((file) => ({
      ...file,
      path: file.path.startsWith(`${CLOUDREVE_FS_PREFIX}/`)
        ? file.path.slice(CLOUDREVE_FS_PREFIX.length)
        : file.path,
    }))
    files.push(...batch)

    const pagination = data.pagination
    if (pagination?.next_token) {
      // cursor 分页：继续取下一页
      nextToken = pagination.next_token
      page = 0
      continue
    }
    if (pagination?.is_cursor === false && batch.length === pageSize) {
      // offset 分页兜底：本页取满则继续翻页
      nextToken = undefined
      page += 1
      continue
    }
    break
  }
  return files
}

/**
 * 递归搜索当前用户网盘中名称包含关键词的文件夹（等价于原 alist `fs/search` + `scope: 1`）。
 */
export async function searchCloudreveFolders(
  keyword: string,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<CloudreveFile[]> {
  const searchUri = `${CLOUDREVE_FS_PREFIX}/?name=${encodeURIComponent(keyword)}&type=folder&case_folding=true`
  return listCloudreveFiles(searchUri, pageSize)
}

// ── 下载 ──────────────────────────────────────────────
/**
 * 构建直链下载 URL：下载 HOST + 百分号编码后的文件路径，无需向 Cloudreve 申请签名 URL。
 * `/Games/[vndb-v123]/file.7z` → `${CLOUDREVE_DOWNLOAD_HOST}/Games/%5Bvndb-v123%5D/file.7z`
 */
export function buildCloudreveDownloadUrl(path: string): string {
  if (!CLOUDREVE_DOWNLOAD_HOST) {
    throw new CloudreveError(-1, '缺少 CLOUDREVE_DOWNLOAD_HOST 环境变量')
  }
  const encodedPath = pathToCloudreveUri(path).slice(CLOUDREVE_FS_PREFIX.length)
  return `${CLOUDREVE_DOWNLOAD_HOST}${encodedPath}`
}

// ── 删除 ──────────────────────────────────────────────
/**
 * 永久删除文件（跳过回收站）。best-effort：失败仅记录日志，不向上抛。
 */
export async function deleteCloudreveFiles(uris: string[]): Promise<void> {
  try {
    await cloudreveRequest('/api/v4/file', {
      method: 'DELETE',
      body: JSON.stringify({ uris, skip_soft_delete: true }),
    })
  } catch (err) {
    console.error('[Cloudreve] 删除文件失败:', err)
  }
}
