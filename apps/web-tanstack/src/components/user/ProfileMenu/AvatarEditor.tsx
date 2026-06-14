import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import { Button } from '@web/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog'
import { authClient } from '@web/server/auth/auth-client'
import { Camera, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'
import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash'

interface AvatarEditorProps {
  name?: string | null
  image?: string | null
  editor: boolean
}

/** 将裁剪区域从原图导出为 JPEG Blob */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> {
  const blob = await fetch(imageSrc).then((r) => r.blob())
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    bitmap,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )
  bitmap.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Canvas toBlob 失败'))
    }, 'image/jpeg')
  })
}

/** XHR 上传并回调进度 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({ url: '' })
        }
      } else {
        reject(new Error(`上传失败 (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.send(formData)
  })
}

/** 将 Blob 转为 ThumbHash 十六进制字符串 */
async function blobToThumbHashHex(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, 100 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  bitmap.close()
  const hash = rgbaToThumbHash(w, h, imageData.data)
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 从图片 URL 计算 ThumbHash 占位图 data URL */
async function imageUrlToPlaceholder(url: string): Promise<string> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
  const scale = Math.min(1, 100 / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const hash = rgbaToThumbHash(w, h, imageData.data)
  return thumbHashToDataURL(hash)
}

export default function AvatarComp({ name, image, editor }: AvatarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // ------ 状态 ------
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  // ------ 上传 mutation ------
  const mutation = useMutation({
    mutationFn: async () => {
      if (!previewUrl || !croppedAreaPixels) return { url: '' }

      // 1. 从原图裁剪出 Blob
      const croppedBlob = await getCroppedBlob(previewUrl, croppedAreaPixels)

      // 2. 计算 ThumbHash 作为文件名
      const hash = await blobToThumbHashHex(croppedBlob)

      // 3. 构建 FormData
      const formData = new FormData()
      formData.append('image', croppedBlob, `${hash}.jpg`)

      // 3. XHR 上传 + 进度
      setIsUploading(true)
      setUploadProgress(0)
      const result = await uploadWithProgress(
        '/api/upload/',
        formData,
        setUploadProgress,
      )
      setIsUploading(false)

      return result
    },
    onError: () => {
      setIsUploading(false)
      toast.error('头像更新失败喵～')
    },
    onSuccess: async (data) => {
      if (data.url) {
        await authClient.updateUser({ image: data.url })
      }
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      toast.success('头像已更新喵～')
      // 重置
      setPreviewUrl(null)
      setCropOpen(false)
      setUploadProgress(0)
    },
  })

  // ------ 文件选择 ------
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件喵')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('图片大小不能超过 5MB 喵')
        return
      }

      setPreviewUrl(URL.createObjectURL(file))
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCropOpen(true)
      e.target.value = ''
    },
    [],
  )

  /** 确认裁剪 → 触发上传 */
  const handleConfirmCrop = () => mutation.mutate()

  /** 取消裁剪 */
  const handleCancelCrop = () => {
    setCropOpen(false)
    setPreviewUrl(null)
    setUploadProgress(0)
  }

  // ------ 渲染 ------
  const displaySrc = image ?? undefined
  const fallbackChar = name?.charAt(0).toUpperCase() || 'U'

  return (
    <>
      {/* ====== 头像显示 + 点击触发 ====== */}
      <div className="flex flex-col items-center gap-3">
        <div className="group/avatar flex flex-col justify-center">
          {editor ? (
            <button
              type="button"
              className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={mutation.isPending || isUploading}
              aria-label="更换头像"
            >
              <Avatar size="lg" className="size-20">
                <AvatarImage src={displaySrc} alt={name ?? ''} />
                <AvatarFallback className="text-2xl">
                  {fallbackChar}
                </AvatarFallback>
              </Avatar>

              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
                <Camera className="size-6 text-white" />
              </div>

              {(mutation.isPending || isUploading) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              )}
            </button>
          ) : (
            <div className="relative rounded-full">
              <Avatar size="lg" className="size-20">
                <AvatarImage src={displaySrc} alt={name ?? ''} />
                <AvatarFallback className="text-2xl">
                  {fallbackChar}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* 隐藏文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ====== 裁剪对话框 ====== */}
      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelCrop()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>裁剪头像</DialogTitle>
            <DialogDescription>
              拖动或缩放图片，裁剪出满意的正方形头像
            </DialogDescription>
          </DialogHeader>

          <div className="relative h-80 w-full overflow-hidden rounded-md bg-black/5">
            {previewUrl && (
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={(_, area) => setCroppedAreaPixels(area)}
                onZoomChange={setZoom}
              />
            )}
          </div>

          {/* 缩放滑条 */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">缩放</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          {/* 上传进度条 */}
          {(isUploading || mutation.isPending) && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {isUploading ? `上传中 ${uploadProgress}%` : '处理中...'}
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelCrop}
              disabled={mutation.isPending || isUploading}
            >
              <X className="size-3.5" />
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCrop}
              disabled={mutation.isPending || isUploading}
            >
              {mutation.isPending || isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                '上传头像'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
