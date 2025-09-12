import { t } from 'elysia'
export namespace MediaModel {
  export const insertmediatoentry = t.Object({
    entryId: t.Number({ minimum: 0 }),
    media: t.Any(),
    sortOrder: t.Number({ minimum: 0, default: 0 }),
    cover: t.Boolean({ default: false }),
  })
  export const delemediatoentry = t.Object({
    id: t.Number({ minimum: 0 }),
    mediahash: t.String(),
    name: t.String(),
  })
  export const getMediaByCover = t.Object({
    other: t.Number({ minimum: 0 }),
    mediahash: t.String(),
  })
  export const getMedia = t.Object({
    other_id: t.String(),
  })
  export type insertmediatoentry = typeof insertmediatoentry.static
  export type delemediatoentry = typeof delemediatoentry.static
  export type getMediaByCover = typeof getMediaByCover.static
  export type getMedia = typeof getMedia.static
}
