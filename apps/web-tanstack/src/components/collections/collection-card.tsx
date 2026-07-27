import { useNavigate } from '@tanstack/react-router'
import { AspectRatio } from '@web/components/ui/aspect-ratio'
import { Card, CardContent } from '@web/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@web/components/ui/sheet'
import { useIsMobile } from '@web/hooks/use-mobile'
import { getImageUrl } from '@web/lib/image-url'
import { useEffect, useRef, useState } from 'react'

interface PreviewItem {
  id: string
  alias: string
  imageId: string
  imageWidth: number
  imageHeight: number
  cSexualAvg: number | null
}

interface CollectionCardProps {
  collection: {
    id: number
    title: string
    description?: string | null
    type: string
    status: string
  }
  previews: PreviewItem[]
  totalCount: number
}

function CoverStack({
  previews,
  totalCount,
}: {
  previews: PreviewItem[]
  totalCount: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setIsOverflowing(el.scrollWidth > el.clientWidth)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [previews])

  if (previews.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 w-full border-2 border-dashed border-muted-foreground/30 rounded-lg">
        <span className="text-sm text-muted-foreground">暂无预览</span>
      </div>
    )
  }

  const renderCover = (game: PreviewItem) => (
    <div className="shrink-0" key={game.id}>
      <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-lg border overflow-hidden bg-muted">
        {game.imageId ? (
          <img
            src={getImageUrl({ imageId: game.imageId, width: game.imageWidth, height: game.imageHeight })}
            alt={game.alias || game.id}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            {game.alias || game.id}
          </div>
        )}
      </div>
    </div>
  )

  const countOverlay = (
    <div className="shrink-0 relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-black/40 to-black/70" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-xs font-medium whitespace-nowrap">
          共 {totalCount} 部
        </span>
      </div>
    </div>
  )

  if (isOverflowing) {
    return (
      <div className="relative w-full">
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-hidden pr-1 sm:pr-22"
        >
          {previews.map(renderCover)}
        </div>
        <div className="absolute sm:right-4 right-4 top-0">
          {countOverlay}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div ref={scrollRef} className="flex items-center gap-1.5">
        {previews.map(renderCover)}
        {countOverlay}
      </div>
    </div>
  )
}

function MobileSheet({
  open,
  onOpenChange,
  collection,
  previews,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: CollectionCardProps['collection']
  previews: PreviewItem[]
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{collection.title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <p className="text-sm text-muted-foreground mb-4">作品：</p>
          {previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {previews.slice(0, 50).map((game) => (
                <div key={game.id} className="group block">
                  <AspectRatio
                    ratio={9 / 13}
                    className="overflow-hidden rounded-lg bg-muted"
                  >
                    {game.imageId ? (
                      <img
                        src={getImageUrl({
                          imageId: game.imageId,
                          width: game.imageWidth,
                          height: game.imageHeight,
                        })}
                        alt={game.alias || game.id}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        {game.alias || game.id}
                      </div>
                    )}
                  </AspectRatio>
                  <p className="text-xs truncate w-full text-center mt-1">
                    {game.alias || game.id}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              暂无作品
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function CollectionCard({
  collection,
  previews,
  totalCount,
}: CollectionCardProps) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleClick = () => {
    if (isMobile) {
      setSheetOpen(true)
    } else {
      navigate({
        to: '/collections/$id',
        params: { id: String(collection.id) },
      })
    }
  }

  if (isMobile) {
    return (
      <>
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={handleClick}
        >
          <CardContent className="flex flex-col items-start gap-3 pt-4">
            <h3 className="font-semibold truncate w-full">
              {collection.title}
            </h3>
            <CoverStack previews={previews} totalCount={totalCount} />
          </CardContent>
        </Card>
        <MobileSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          collection={collection}
          previews={previews}
        />
      </>
    )
  }

  return (
    <Card
      className="cursor-pointer transition-all duration-500"
      onClick={handleClick}
    >
      <CardContent className="flex flex-col items-start gap-3">
        <h3 className="font-semibold text-xl truncate w-full">
          {collection.title}
        </h3>
        <CoverStack previews={previews} totalCount={totalCount} />
      </CardContent>
    </Card>
  )
}
