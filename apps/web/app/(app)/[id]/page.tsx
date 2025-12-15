import { getFileList } from '@web/lib/repositories/alistFileList'
import React from 'react'
import { DownloadOptions } from './(components)/download-options'

export async function DownloadPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const fileList = await getFileList(id)
  return <DownloadOptions fileList={fileList} />
}

export default DownloadPage
