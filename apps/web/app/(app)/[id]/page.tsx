import { getFileList } from '@web/lib/repositories/alistFileList'
import { getVnDetails } from '@web/lib/repositories/vnRepository'
import type { Metadata } from 'next'
import React from 'react'
import { DownloadOptions } from './(components)/download-options'
import { aliasFilter, getTitles } from './(lib)/contentDataac'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getVnDetails(id)
  const [titlesData, aliasData] = await Promise.all([
    getTitles({ data }),
    aliasFilter({ data }),
  ])
  return {
    title: '下载',
    description: `${titlesData.zhHans}|${titlesData.olang
      } 的资源下载，游戏别名：${aliasData || '无'}`,
  }
}

export async function DownloadPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const fileList = await getFileList(id)
  return <DownloadOptions fileList={fileList} />
}

export default DownloadPage
