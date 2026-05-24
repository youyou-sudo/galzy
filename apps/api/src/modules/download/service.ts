import { db } from '@api/libs'
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
            Authorization: `${process.env.OPENLIST_API_KEY}`,
          },
          body: JSON.stringify({ path }),
        }),
      )

      const alistData = (await alistDatas.json()) as AlistFsResponse

      if (alistData.data === undefined) throw status(500, `未找到此文件`)
      if (alistData.data.sign === undefined)
        throw status(500, `未找到此文件的签名`)

      if (alisterror) throw status(500, `Error:${JSON.stringify(alisterror)}`)

      const [, error, workerList] = t(
        await db
          .selectFrom('galrc_cloudflare')
          .where('enable', '=', true)
          .selectAll()
          .orderBy('id')
          .execute(),
      )

      if (error || workerList.length === 0) {
        throw status(500, '没有可用的下载节点喵~')
      }

      const randomWorker =
        workerList[Math.floor(Math.random() * workerList.length)]
      await db
        .insertInto('galrc_gameDownloadStats')
        .values({
          game_id: game_id,
          file_path: path,
          created_at: new Date(),
        })
        .executeTakeFirst()

      return {
        success: true,
        raw_url: `${randomWorker.url_endpoint}${path.split('/').map(encodeURIComponent).join('/')}?sign=${alistData.data?.sign}`,
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
    const [, error, res] = t(
      await db
        .selectFrom('galrc_cloudflare')
        .selectAll()
        .orderBy('id')
        .execute(),
    )
    if (error)
      throw status(401, `服务出错了喵~，Error:${JSON.stringify(error)}`)
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
          .updateTable('galrc_cloudflare')
          .set({
            a_email,
            a_key,
            account_id,
            woker_name,
            url_endpoint,
          })
          .where('id', '=', Number(id))
          .executeTakeFirst()
      } else {
        // 创建数据
        await db
          .insertInto('galrc_cloudflare')
          .values({
            a_email,
            a_key,
            account_id,
            woker_name,
            url_endpoint,
            state: false,
            enable: false,
            duration: 0,
            errors: 0,
            requests: 0,
            responseBodySize: 0,
            subrequests: 0,
            updateTime: null,
          })
          .executeTakeFirst()
      }
    } catch (error) {
      console.log(error)
      throw status(400, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
  },
  async workerConfigFormDel({ id }: DownloadModel.workerConfigFormDel) {
    if (id) {
      await db
        .deleteFrom('galrc_cloudflare')
        .where('id', '=', id)
        .executeTakeFirst()
    } else {
      return status(400, `未提供 ID 喵～`)
    }
  },
  async nodeEnaledAc({ nodeId, boole }: DownloadModel.nodeEnaledAc) {
    try {
      await db
        .updateTable('galrc_cloudflare')
        .set({
          enable: boole,
        })
        .where('id', '=', nodeId)
        .execute()
    } catch (error) {
      console.log(error)
      throw status(400, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
  },
}
