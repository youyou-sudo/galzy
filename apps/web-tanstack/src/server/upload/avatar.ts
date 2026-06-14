import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import { cookiePass } from '@web/lib/cookie-pass'
import { z } from 'zod'

const uploadAvatarInputSchema = z.object({
  image: z
    .instanceof(File)
    .refine((f) => f.type.startsWith('image/'), {
      message: '请选择图片文件喵',
    })
    .refine((f) => f.size <= 5 * 1024 * 1024, {
      message: '图片大小不能超过 5MB 喵',
    }),
  name: z.string(),
  type: z.string(),
})
export const uploadAvatar = createServerFn({ method: 'POST' })
  .inputValidator((formData: FormData) => {
    const name = formData.get('name')
    const type = formData.get('type')
    const image = formData.get('image')
    const raw = {
      name,
      type,
      image,
    }
    const parsed = uploadAvatarInputSchema.parse(raw)
    return { name: parsed.name, type: parsed.type, image: parsed.image }
  })
  .handler(async ({ data }) => {
    const { image } = data
    const { data: res, error } = await api.media.uploadavatar.post(
      {
        image: image,
      },
      cookiePass(),
    )
    elysiaErrorF(error)
    if (!res)
      throw {
        status: 422,
        message: '头像 url 未获取到喵',
      }

    return res
  })
