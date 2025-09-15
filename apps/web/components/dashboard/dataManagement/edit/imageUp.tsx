/* eslint-disable @next/next/no-img-element */
'use client'

import { QueryClient, useMutation } from '@tanstack/react-query'
import {
  RadioGroup,
  RadioGroupItem,
} from '@web/components/animate-ui/radix/radio-group'
import { Button } from '@web/components/ui/button'
import { Label } from '@web/components/ui/label'
import {
  type FileMetadata,
  formatBytes,
  useFileUpload,
} from '@web/hooks/use-file-upload'
import type { vidassociationGet } from '@web/lib/dashboard/dataManagement/dataGet'
import {
  deleMediaByEntryId,
  getMediaByCover,
  insertMediaToEntry,
} from '@web/lib/dashboard/images/upimageData'
import { imageAcc } from '@web/lib/ImageUrl'
import { calculateThumbHash } from '@web/lib/thumbhash-utils'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ImageIcon,
  Loader2,
  PlayIcon,
  RefreshCwIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'

type DataTy = Awaited<ReturnType<typeof vidassociationGet>>

export default function Component({ datas }: { datas: DataTy }) {
  const coverItem = datas?.othermedia.find((item) => item.cover === true)
  const coverId = coverItem ? coverItem.mediadata?.hash : null

  const maxSizeMB = 50000
  const maxSize = maxSizeMB * 1024 * 1024
  const maxFiles = 9999

  // [x] 图片上传模块的文件预览及使用的签名逻辑完善

  const initialFiles = datas?.othermedia.map((item) => ({
    id: Number(item.mediadata?.id),
    cover: item.cover!,
    name: item.mediadata!.name,
    thumb_hash: item.mediadata!.thumb_hash,
    type: item.mediadata!.type,
    media_url: imageAcc(item.mediadata!.name),
    Hash: item.mediadata!.hash,
    size: Number(item.mediadata!.size),
  }))

  const [
    { files, isDragging, errors, hasPendingUploads, isAllUploadsComplete },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
      uploadFile,
      uploadAllFiles,
      retryUpload,
    },
  ] = useFileUpload({
    accept: 'image/svg+xml,image/png,image/jpeg,image/jpg,image/webp',
    maxSize,
    multiple: true,
    maxFiles,
    initialFiles,
    uploadConfig: {
      apiUrl: '/dashboard/api/proxy-upload',
      basePath: '/upload',
      asTask: true,
    },
  })

  const queryClient = new QueryClient()
  const addTodoMutation = useMutation({
    mutationFn: (value: string) => getMediaByCover(Number(datas?.id), value),
    onSettled: () => queryClient.invalidateQueries(),
  })

  const { isPending, mutate, isError } = addTodoMutation

  files.forEach(async (f) => {
    if (f.uploadStatus === 'success') {
      if (f.file instanceof File) {
        // [x] 图片 ThumbHash 记录逻辑
        const thumbHashResult = await calculateThumbHash(f.file)
        await insertMediaToEntry(Number(datas!.id), {
          name: f.file.name,
          type: f.file.type,
          thumb_hash: thumbHashResult.base64,
          width: thumbHashResult.width,
          height: thumbHashResult.height,
          hash: f.id,
          size: BigInt(f.file.size),
        })
      }
    } else if (f.uploadStatus === 'error') {
      console.error('上传失败', f.uploadError)
    }
  })

  // [x] 是否为封面图片的逻辑
  function isFile(obj: any): obj is File {
    return obj && typeof obj === 'object' && 'Hash' in obj
  }
  return (
    <div className="flex flex-col gap-2">
      {/* Drop area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px]"
      >
        <input
          {...getInputProps()}
          className="sr-only"
          aria-label="Upload image file"
        />
        <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
          <div
            className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
            aria-hidden="true"
          >
            <ImageIcon className="size-4 opacity-60" />
          </div>
          <p className="mb-1.5 text-sm font-medium">Drop your images here</p>
          <p className="text-muted-foreground text-xs">
            SVG, PNG, JPG or GIF (max. {maxSizeMB}MB)
          </p>
          <Button
            variant="outline"
            className="mt-4 bg-transparent"
            onClick={openFileDialog}
          >
            <UploadIcon className="-ms-1 opacity-60" aria-hidden="true" />
            Select images
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          className="text-destructive flex items-center gap-1 text-xs"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}
      {/* Upload status indicator */}
      {files.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {hasPendingUploads
              ? '有文件待上传'
              : isAllUploadsComplete
                ? '✅ 所有文件上传完成'
                : '无待上传文件'}
          </span>
          {isAllUploadsComplete && (
            <span className="text-green-600 font-medium">数据已刷新</span>
          )}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {/* Upload all button */}
          {hasPendingUploads && (
            <div className="flex justify-end">
              <Button size="sm" onClick={uploadAllFiles}>
                <PlayIcon className="size-3" />
                Upload All
              </Button>
            </div>
          )}
          <RadioGroup defaultValue={String(coverId)} onValueChange={mutate}>
            {files.map((file) => (
              <div
                key={file.id}
                className="bg-background flex items-center justify-between gap-2 rounded-lg border p-2 pe-3"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <div className="bg-accent aspect-square shrink-0 rounded relative">
                    <img
                      src={file.preview || '/placeholder.svg'}
                      alt={file.file.name}
                      className="size-10 rounded-[inherit] object-cover"
                    />
                    {/* Status indicator */}
                    <div className="absolute -top-1 -right-1">
                      {file.uploadStatus === 'success' && (
                        <div className="bg-green-500 text-white rounded-full p-0.5">
                          <CheckCircleIcon className="size-3" />
                        </div>
                      )}
                      {file.uploadStatus === 'error' && (
                        <div className="bg-red-500 text-white rounded-full p-0.5">
                          <AlertCircleIcon className="size-3" />
                        </div>
                      )}
                      {file.uploadStatus === 'uploading' && (
                        <div className="bg-blue-500 text-white rounded-full p-0.5 animate-spin">
                          <RefreshCwIcon className="size-3" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {file.file.name}
                    </p>

                    {/* 是否为封面 */}
                    <div className="flex items-center">
                      <p className="text-muted-foreground text-xs">
                        {formatBytes(file.file.size)}
                      </p>
                      {file.uploadStatus === 'success' ||
                      (!file.uploadStatus && isFile(file.file)) ? (
                        <div className="flex items-center">
                          <RadioGroupItem value={file.id} />
                          <Label>封面</Label>
                          {isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                      ) : null}
                    </div>

                    {/* Progress bar */}
                    {file.uploadStatus === 'uploading' &&
                      typeof file.uploadProgress === 'number' && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${file.uploadProgress}%` }}
                          />
                        </div>
                      )}

                    {/* Error message */}
                    {file.uploadStatus === 'error' && file.uploadError && (
                      <p className="text-red-500 text-xs truncate">
                        {file.uploadError}
                      </p>
                    )}

                    {isError && (
                      <p className="text-red-500 text-xs truncate">
                        封面设置失败
                      </p>
                    )}

                    {/* Success message */}
                    {file.uploadStatus === 'success' && (
                      <p className="text-green-500 text-xs">Upload completed</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Upload/Retry button */}
                  {(file.uploadStatus === 'pending' ||
                    file.uploadStatus === 'error') && (
                    <Button
                      size="icon"
                      type="button"
                      variant="ghost"
                      className="size-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() =>
                        file.uploadStatus === 'error'
                          ? retryUpload(file.id)
                          : uploadFile(file.id)
                      }
                      aria-label={
                        file.uploadStatus === 'error'
                          ? 'Retry upload'
                          : 'Upload file'
                      }
                    >
                      {file.uploadStatus === 'error' ? (
                        <RefreshCwIcon className="size-4" />
                      ) : (
                        <PlayIcon className="size-4" />
                      )}
                    </Button>
                  )}

                  {/* Remove button */}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground/80 hover:text-foreground size-8 hover:bg-transparent"
                    onClick={async () => {
                      if ('thumb_hash' in file.file && file.file.thumb_hash) {
                        const f = file.file as FileMetadata
                        await deleMediaByEntryId(
                          Number(datas!.id),
                          f.Hash,
                          f.name,
                        )
                      }
                      removeFile(file.id)
                    }}
                    aria-label="Remove file"
                    disabled={file.uploadStatus === 'uploading'}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      <p
        aria-live="polite"
        role="region"
        className="text-muted-foreground mt-2 text-center text-xs"
      >
        Multiple image uploader with streaming upload & progress ∙{' '}
        <a
          href="https://github.com/origin-space/originui/tree/main/docs/use-file-upload.md"
          className="hover:text-foreground underline"
        >
          API
        </a>
      </p>
    </div>
  )
}
