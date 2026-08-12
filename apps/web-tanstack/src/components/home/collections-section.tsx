import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import { getCollectionsWithPreview } from '@web/server/collections'
import { r18Store } from '@web/stores/r18Store'
import { BookOpen } from 'lucide-react'
import { CollectionItem, CollectionItemSkeleton } from './collection-card'

export function CollectionsSection() {
  const showR18 = useSelector(r18Store, (s) => s.showR18)
  const { data: collections } = useQuery({
    queryKey: ['homeCollections', showR18],
    queryFn: () =>
      getCollectionsWithPreview({
        data: { limit: 5, previewLimit: 3, showR18 },
      }).then((r) => r.items),
    staleTime: 5 * 60_000,
  })

  if (!collections || collections.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">精选合集</h2>
        </div>
        <Link
          to="/collections"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          更多合集 →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {collections.map((col) => (
          <CollectionItem key={col.id} collection={col} />
        ))}
      </div>
    </section>
  )
}

export function CollectionsSectionSkeleton() {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-5 rounded bg-muted animate-pulse" />
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CollectionItemSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}
