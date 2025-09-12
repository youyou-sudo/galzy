'use server'

import type { Onthermeidia } from '@api/libs/kysely'
import { api } from '@libs'

export async function insertMediaToEntry(
  entryId: number,
  media: Omit<Onthermeidia, 'id'>,
  sortOrder = 0,
  cover: boolean = false,
) {
  await api.media.insertmediatoentry.post({
    entryId,
    media,
    sortOrder,
    cover,
  })
}

export async function deleMediaByEntryId(
  id: number,
  mediahash: string,
  name: string,
) {
  await api.media.delemediatoentry.post({
    id,
    mediahash,
    name,
  })
}

export async function getMediaByCover(other: number, mediahash: string) {
  const { data } = await api.media.getmediabycover.post({
    other,
    mediahash,
  })
  return data
}

export async function getMedia(other_id: string) {
  const { data } = await api.media.getmedia.get({
    query: { other_id },
  })
  return data
}
