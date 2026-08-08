import { cloudflare, db, gameDownloadStats } from '@api/libs'
import {
  CloudreveError,
  createCloudreveDownloadUrl,
  pathToCloudreveUri,
} from '@api/libs/cloudreve'
import { eq } from 'drizzle-orm'
import { status } from 'elysia'
import type { DownloadModel } from './model'

export const Download = {
  async DownloadGet({
    path,
    game_id,
  }: DownloadModel.path): Promise<DownloadModel.DownloadGet> {
    // 通过 Cloudreve API 获取签名直链（对象存储 key 非完整路径，不能拼接）
    let rawUrl: string
    try {
      rawUrl = await createCloudreveDownloadUrl(pathToCloudreveUri(path))
    } catch (err) {
      if (err instanceof CloudreveError) throw status(404, err.message)
      throw err
    }

    // Fire-and-forget: stats tracking MUST NOT block the download response
    void db
      .insert(gameDownloadStats)
      .values({
        gameId: game_id,
        filePath: path,
        createdAt: new Date(),
      })
      .catch((err) => console.error('[DownloadGet] 统计写入失败:', err))

    return {
      success: true,
      raw_url: rawUrl,
    }
  },
  async Worker() {
    const res = await db
      .select({
        id: cloudflare.id,
        aEmail: cloudflare.aEmail,
        accountId: cloudflare.accountId,
        wokerName: cloudflare.wokerName,
        urlEndpoint: cloudflare.urlEndpoint,
        state: cloudflare.state,
        enable: cloudflare.enable,
        duration: cloudflare.duration,
        errors: cloudflare.errors,
        requests: cloudflare.requests,
        responseBodySize: cloudflare.responseBodySize,
        subrequests: cloudflare.subrequests,
        updateTime: cloudflare.updateTime,
      })
      .from(cloudflare)
      .orderBy(cloudflare.id)
    return res
  },
  async workerConfigFormPut({
    id,
    a_email,
    a_key,
    account_id,
    woker_name,
    url_endpoint,
  }: DownloadModel.workerConfigForm) {
    try {
      if (id) {
        // 修改数据
        await db
          .update(cloudflare)
          .set({
            aEmail: a_email,
            aKey: a_key,
            accountId: account_id,
            wokerName: woker_name,
            urlEndpoint: url_endpoint,
          })
          .where(eq(cloudflare.id, Number(id)))
      } else {
        // 创建数据
        await db.insert(cloudflare).values({
          aEmail: a_email,
          aKey: a_key,
          accountId: account_id,
          wokerName: woker_name,
          urlEndpoint: url_endpoint,
          state: false,
          enable: false,
          duration: 0,
          errors: 0,
          requests: 0,
          responseBodySize: 0,
          subrequests: 0,
          updateTime: null,
        })
      }
    } catch (error) {
      console.log(error)
      throw status(400, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
  },
  async workerConfigFormDel({ id }: DownloadModel.workerConfigFormDel) {
    if (id) {
      await db.delete(cloudflare).where(eq(cloudflare.id, id))
    } else {
      return status(400, `未提供 ID 喵～`)
    }
  },
  async nodeEnaledAc({ nodeId, boole }: DownloadModel.nodeEnaledAc) {
    try {
      await db
        .update(cloudflare)
        .set({
          enable: boole,
        })
        .where(eq(cloudflare.id, nodeId))
    } catch (error) {
      console.log(error)
      throw status(400, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
  },
}
