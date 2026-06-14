import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog'
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import { getSession } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { ArrowLeft, Camera, Loader2, X } from 'lucide-react'
import { type ChangeEvent, useCallback, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'

// ====== 裁剪 & 上传工具函数 (from AvatarEditor) ======

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

// ====== Route ======

export const Route = createFileRoute('/user/editor')({
  component: RouteComponent,
  loader: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/login' })
    }
    return session
  },
})

function RouteComponent() {
  const session = Route.useLoaderData()
  const { data: clientSession, refetch: refetchSession } =
    authClient.useSession()
  const user = clientSession?.user ?? session.user
  const queryClient = useQueryClient()

  if (!user) return null

  // ------ 名称编辑 ------
  const [name, setName] = useState(user.name ?? '')
  const [isSavingName, setIsSavingName] = useState(false)

  const handleSaveName = async () => {
    if (!name.trim()) return
    setIsSavingName(true)
    try {
      await authClient.updateUser({ name })
      await refetchSession()
      toast.success('名称已更新喵～')
    } catch {
      // Error is handled by better-auth
    } finally {
      setIsSavingName(false)
    }
  }

  // ------ 头像编辑 ------
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const avatarMutation = useMutation({
    mutationFn: async () => {
      if (!previewUrl || !croppedAreaPixels) return { url: '' }
      const croppedBlob = await getCroppedBlob(previewUrl, croppedAreaPixels)
      const formData = new FormData()
      formData.append('image', croppedBlob, selectedFile?.name ?? 'avatar.jpg')
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
      setSelectedFile(null)
      setPreviewUrl(null)
      setCropOpen(false)
      setUploadProgress(0)
    },
  })

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
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCropOpen(true)
      e.target.value = ''
    },
    [],
  )

  const handleConfirmCrop = () => avatarMutation.mutate()
  const handleCancelCrop = () => {
    setCropOpen(false)
    setPreviewUrl(null)
    setSelectedFile(null)
    setUploadProgress(0)
  }

  const displaySrc = user.image ?? undefined
  const fallbackChar = user.name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 返回链接 */}
      <Button asChild variant="ghost" size="sm">
        <Link to="/user">
          <ArrowLeft className="size-4" />
          返回个人主页
        </Link>
      </Button>

      {/* 头像编辑卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">头像</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 group/avatar"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending || isUploading}
              aria-label="更换头像"
            >
              <Avatar size="lg" className="size-24">
                <AvatarImage src={displaySrc} alt={user.name ?? ''} />
                <AvatarFallback className="text-3xl">
                  {fallbackChar}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
                <Camera className="size-6 text-white" />
              </div>
              {(avatarMutation.isPending || isUploading) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              点击头像上传新头像，支持 JPG/PNG/WebP，最大 5MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 名称编辑卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">显示名称</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="editor-name">名称</Label>
            <div className="flex gap-2">
              <Input
                id="editor-name"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                placeholder="请输入您的名称"
              />
              <Button
                size="sm"
                disabled={isSavingName || !name.trim() || name === user.name}
                onClick={handleSaveName}
              >
                {isSavingName ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  '保存'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 邮箱（只读） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">邮箱</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={user.email ?? ''} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground mt-2">
            邮箱无法直接修改，如需帮助请联系管理员喵。
          </p>
        </CardContent>
      </Card>

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

          {(isUploading || avatarMutation.isPending) && (
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

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelCrop}
              disabled={avatarMutation.isPending || isUploading}
            >
              <X className="size-3.5" />
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCrop}
              disabled={avatarMutation.isPending || isUploading}
            >
              {avatarMutation.isPending || isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                '上传头像'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
