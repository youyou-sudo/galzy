'use server'
import { api } from '@libs'

/**
 * 根据传入的 vid 和 otherId 条件，查询 galrc_alistb 表中对应的数据。
 *
 * 三种支持的查询情况（互斥）：
 *
 * 1. 仅传 otherId：
 *    - 查询条件：other IS NOT NULL AND vid IS NULL
 *    - 适用于只希望筛选出存在 other，但没有 vid 的记录。
 *    - NO VBDB
 *
 * 2. 同时传 vid 和 otherId：
 *    - 查询条件：vid IS NOT NULL AND other IS NOT NULL
 *    - 适用于筛选出同时存在 vid 和 other 的记录。
 *    - 已补充数据
 *
 * 3. 仅传 vid：
 *    - 查询条件：vid IS NOT NULL AND other IS NULL
 *    - 适用于只希望筛选出存在 vid，但没有 other 的记录。
 *    - 未补充数据
 *
 * 4. 什么都没传：
 *    - 返回所有数据
 *
 * @param {Object} params 查询条件对象
 * @param {number | null | undefined} params.vid 可选，视频 ID
 * @param {number | null | undefined} params.otherId 可选，其他关联 ID
 * @param {number | null | undefined} params.limit 可选，每页列出多少数据（默认20）
 * @param {number | null | undefined} params.page 可选，页码（默认第一页）
 * @param {string | null | undefined} params.query 可选，视频 ID
 * @returns {Promise<any[]>} 查询结果数组
 */

export const dataFilteringGet = async ({
  vid,
  otherId,
  query,
  limit = 20,
  page = 1,
}: {
  vid?: number | null
  otherId?: number | null
  query?: any | null
  limit?: number
  page?: number
} = {}) => {
  const { data } = await api.games.datafiltering.get({
    query: {
      vid,
      otherId,
      query,
      limit,
      page,
    },
  })
  return data
}

/**
 * 获取 galrc_alistb 表中 4 类数据的 **统计信息**：
 *  1. `onlyOther`：只存在 other，vid 为 null
 *  2. `bothExist`：vid 和 other 都存在
 *  3. `onlyVid`：只存在 vid，other 为 null
 *  4. `all`：全部数据数量
 */
export const dataFilteringStats = async () => {
  const { data } = await api.games.datafilteringstats.get()
  return data
}

export const vidassociationGet = async (id: string) => {
  const { data } = await api.games.vidassociation.get({ query: { id } })
  return data
}

// 创建新 no vndb 数据
export const vidassociationCreate = async () => {
  const { data } = await api.games.vidassociationCreate.post()
  return data
}

export const vidassociationUpdate = async (id: number, datas: any) => {
  const { data } = await api.games.vidassociationupdate.post({
    id,
    data: datas,
  })
  return data
}
