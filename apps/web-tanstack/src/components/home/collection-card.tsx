import { Link } from '@tanstack/react-router'
import { getImageUrl } from '@web/lib/image-url'
import { Library } from 'lucide-react'

interface PreviewItem {
  id: string
  alias: string | null
  imageId: string | null
  imageWidth: number | null
  imageHeight: number | null
  cSexualAvg: number | null
}

interface CollectionData {
  id: number
  title: string
  description?: string | null
  type: string
  entryCount?: number
  previews: PreviewItem[]
}

function PokerStack({ previews }: { previews: PreviewItem[] }) {
  const stackItems = previews.slice(0, 3)

  if (stackItems.length === 0) {
    return (
      <div className="aspect-[4/3] flex items-center justify-center rounded-xl bg-muted">
        <Library className="size-8 text-muted-foreground/40" />
      </div>
    )
  }

  const layerStyles = [
    { rotate: -4, x: -4, y: 2, z: 0 },
    { rotate: 1, x: 0, y: 0, z: 10 },
    { rotate: 6, x: 4, y: 2, z: 20 },
  ]

  const hoverStyles = [
    { rotate: -8, x: -10, y: 4 },
    { rotate: -1, x: 0, y: -2 },
    { rotate: 10, x: 10, y: 4 },
  ]

  return (
    <div className="relative aspect-[1/1] w-full">
      {stackItems.map((item, i) => {
        const layer = layerStyles[i]
        const hover = hoverStyles[i]
        return (
          <img
            key={item.id}
            src={getImageUrl({
              imageId: item.imageId,
              width: item.imageWidth,
              height: item.imageHeight,
            })}
            alt=""
            style={{
              transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) translate(${layer.x}px, ${layer.y}px)`,
              zIndex: layer.z,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform =
                `translate(-50%, -50%) rotate(${hover.rotate}deg) translate(${hover.x}px, ${hover.y}px)`
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform =
                `translate(-50%, -50%) rotate(${layer.rotate}deg) translate(${layer.x}px, ${layer.y}px)`
            }}
            className={[
              'absolute top-1/2 left-1/2',
              'w-[70%] aspect-[2/3] rounded-lg border-2 border-background',
              'shadow-md shadow-black/15 dark:shadow-black/30',
              'object-cover transition-transform duration-300 ease-out',
            ].join(' ')}
            loading="lazy"
          />
        )
      })}
    </div>
  )
}

export function CollectionItem({ collection }: { collection: CollectionData }) {
  return (
    <Link to={`/collections/${collection.id}`} className="group block">
      <PokerStack previews={collection.previews} />
      <h3 className="mt-3 text-sm font-medium text-center truncate group-hover:text-primary transition-colors">
        {collection.title}
      </h3>
    </Link>
  )
}

export function CollectionItemSkeleton() {
  return (
    <div>
      <div className="rounded-xl bg-muted animate-pulse aspect-[1/1]" />
      <div className="mt-2 h-4 w-2/3 mx-auto rounded bg-muted animate-pulse" />
    </div>
  )
}
