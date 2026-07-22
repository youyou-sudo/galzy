import { cloudflare, db, gameDownloadStats } from '@api/libs'
import { eq } from 'drizzle-orm'
import { status } from 'elysia'
import { t } from 'try'
import type { AlistFsResponse, DownloadModel } from './model'

export const Download = {
  async DownloadGet({
    path,
    game_id,
  }: DownloadModel.path): Promise<DownloadModel.DownloadGet> {
    const alistDownloadGet = async (path: string) => {
      const [, alisterror, alistDatas] = t(
        await fetch(`${process.env.OPENLIST_HOST}/api/fs/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.OPENLIST_API_KEY,
          },
          body: JSON.stringify({ path }),
        }),
      )

      const alistData = (await alistDatas.json()) as AlistFsResponse

      if (alistData.data === undefined) throw status(500, `未找到此文件`)
      if (alistData.data.sign === undefined)
        throw status(500, `未找到此文件的签名`)

      if (alisterror) throw status(500, `Error:${JSON.stringify(alisterror)}`)

      const workerList = await db
        .select()
        .from(cloudflare)
        .where(eq(cloudflare.enable, true))
        .orderBy(cloudflare.id)

      if (workerList.length === 0) {
        throw status(500, '没有可用的下载节点喵~')
      }

      const randomWorker =
        workerList[Math.floor(Math.random() * workerList.length)]
      await db.insert(gameDownloadStats).values({
        gameId: game_id,
        filePath: path,
        createdAt: new Date(),
      })

      return {
        success: true,
        raw_url: `${randomWorker.urlEndpoint}${path.split('/').map(encodeURIComponent).join('/')}?sign=${alistData.data?.sign}`,
        sign: alistData.data.sign,
      }
    }

    const [, error, res] = t(await alistDownloadGet(path))
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    return res
  },
  async Worker() {
    const res = await db.select().from(cloudflare).orderBy(cloudflare.id)
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
