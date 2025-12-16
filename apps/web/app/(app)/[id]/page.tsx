"use cache"

import { getFileList } from '@web/lib/repositories/alistFileList'
import React from 'react'
import { DownloadOptions } from './(components)/download-options'
import { cacheTag } from 'next/cache'

export async function DownloadPage({ params }: { params: { id: string } }) {
  const { id } = await params
  cacheTag(`DownloadPage-${id}`)

  const fileList = await getFileList(id)
  return <DownloadOptions fileList={fileList} />
}

export default DownloadPage
