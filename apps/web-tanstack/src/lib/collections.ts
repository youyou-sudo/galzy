/** A game entry within a collection preview */
export interface CollectionPreviewGame {
  id: string
  alias: string | null
  title?: string | null
  imageId: string | null
  imageWidth: number | null
  imageHeight: number | null
  cSexualAvg: number | null
}

/** A collection as returned by the list API */
export interface CollectionData {
  id: number
  title: string
  description: string | null
  type: 'manual' | 'producer'
  status: string
  entryCount?: number
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

/** A collection enriched with its game previews */
export interface CollectionWithPreviews extends CollectionData {
  previews: CollectionPreviewGame[]
}
