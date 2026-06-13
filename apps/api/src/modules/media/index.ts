import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { MediaModel } from './model'
import { Media } from './service'

export const media = new Elysia({ prefix: '/media' })
  .use(betterAuth)
  .post(
    '/insertmediatoentry',
    async ({ body: { entryId, media, sortOrder, cover } }) => {
      return Media.insertmediatoentry({ entryId, media, sortOrder, cover })
    },
    {
      body: MediaModel.insertmediatoentry,
    },
  )
  .post(
    '/delemediatoentry',
    async ({ body: { id, mediahash, name } }) => {
      return Media.delemediatoentry({ id, mediahash, name })
    },
    {
      body: MediaModel.delemediatoentry,
    },
  )
  .post(
    '/getmediabycover',
    async ({ body: { other, mediahash } }) => {
      return Media.getMediaByCover({ other, mediahash })
    },
    {
      body: MediaModel.getMediaByCover,
    },
  )
  .get(
    '/getmedia',
    async ({ query: { other_id } }) => {
      return Media.getMedia({ other_id })
    },
    {
      query: MediaModel.getMedia,
    },
  )
  .post(
    '/uploadavatar',
    async ({ body: { image }, user }) => {
      return Media.uploadAvatar({ image, userId: user.id })
    },
    {
      auth: true,
      body: MediaModel.uploadAvatar,
    },
  )
