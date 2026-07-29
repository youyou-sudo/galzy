import { Link } from '@tanstack/react-router'
import { cn } from '@web/lib/utils'
import { getImageUrl } from '@web/lib/image-url'
import type { CollectionWithPreviews, CollectionPreviewGame } from '@web/lib/collections'
import { Library, Layers } from 'lucide-react'

// ── Cover Stack ───────────────────────────────────────────────

function CoverStack({
  previews,
  count,
}: {
  previews: CollectionPreviewGame[]
  count: number
}) {
  const items = previews.slice(0, 3)

  if (items.length === 0) {
    return (
      <div className="aspect-[2/3] flex items-center justify-center rounded-xl bg-muted/40">
        <Library className="size-8 text-muted-foreground/25" />
      </div>
    )
  }

  const layers = [
    { rotate: -5, x: 8, y: 4, z: 0, scale: 0.82 },
    { rotate: 2, x: -2, y: 0, z: 10, scale: 0.9 },
    { rotate: 7, x: -10, y: 4, z: 20, scale: 1 },
  ]

  const hoverOut = [
    'group-hover:rotate-[-8deg] group-hover:translate-x-[14px] group-hover:translate-y-[5px]',
    'group-hover:rotate-[3deg] group-hover:-translate-x-[5px] group-hover:-translate-y-[2px]',
    'group-hover:rotate-[10deg] group-hover:-translate-x-[16px] group-hover:translate-y-[5px]',
  ]

  return (
    <div className="relative aspect-[2/3] w-full">
      {items.map((item, i) => {
        const layer = layers[i]
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
              transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) translate(${layer.x}px, ${layer.y}px) scale(${layer.scale})`,
              zIndex: layer.z,
            }}
            className={cn(
              'absolute top-1/2 left-1/2',
              'w-[72%] aspect-[2/3] rounded-lg border-[3px] border-background',
              'shadow-lg shadow-black/20 dark:shadow-black/40',
              'object-cover transition-all duration-400 ease-out',
              hoverOut[i],
            )}
            loading="lazy"
          />
        )
      })}

      {/* Bottom gradient for count badge */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent rounded-lg pointer-events-none" />

      {/* Count badge */}
      <div
        style={{ zIndex: 30 }}
        className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-white/90 dark:bg-black/55 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
      >
        <Layers className="size-2.5" />
        {count} 部
      </div>
    </div>
  )
}

// ── Main Card ─────────────────────────────────────────────────

export function CollectionCard({ collection }: { collection: CollectionWithPreviews }) {
  const { id, title, entryCount, previews } = collection
  const gameCount = entryCount ?? previews?.length ?? 0

  return (
    <Link
      to="/collections/$id"
      params={{ id: String(id) }}
      className="group block"
    >
      <CoverStack previews={previews ?? []} count={gameCount} />

      <h3 className="mt-2 text-sm font-medium text-center leading-snug line-clamp-1 group-hover:text-primary transition-colors px-0.5">
        {title}
      </h3>
    </Link>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

export function CollectionCardSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-3/4 mx-auto rounded bg-muted animate-pulse" />
    </div>
  )
}
