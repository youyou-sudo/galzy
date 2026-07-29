import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { GameCard } from '@web/components/home/card'
import { getImageUrl } from '@web/lib/image-url'
import { getGameImages } from '@web/server/game'
import { Flame, TrendingUp } from 'lucide-react'

interface HotGame {
  id: string
  title: string | null
  total: number
}

interface HotGamesSectionProps {
  games: HotGame[] | null
}

export function HotGamesSection({ games }: HotGamesSectionProps) {
  const ids = (games ?? []).slice(0, 12).map((g) => g.id)

  const { data: imageMap } = useSuspenseQuery({
    queryKey: ['hotGameImages', ids],
    queryFn: () => getGameImages({ data: { ids } }),
    staleTime: 5 * 60_000,
  })

  const imageById = new Map((imageMap ?? []).map((img) => [img.id, img]))

  if (!games || games.length === 0) return null

  const displayGames = games.slice(0, 12)

  return (
    <section className="px-3 md:px-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-orange-500" />
          <h2 className="text-xl font-semibold">本周热门</h2>
          <TrendingUp className="size-4 text-muted-foreground" />
        </div>
        <Link
          to="/games"
          search={{ sortBy: 'downloads', order: 'desc' }}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          更多游戏 →
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {displayGames.map((game, index) => {
          const img = imageById.get(game.id)
          return (
            <div key={game.id} className="relative">
              <GameCard.Item
                gameid={game.id}
                title={game.title || '未知游戏'}
                width={img?.imageWidth ?? 200}
                height={img?.imageHeight ?? 300}
                src={getImageUrl({
                  imageId: img?.imageId ?? null,
                  width: img?.imageWidth ?? null,
                  height: img?.imageHeight ?? null,
                })}
                cSexualAvg={img?.cSexualAvg ?? null}
              />
              <span className="absolute top-1.5 left-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-background/80 text-xs font-bold text-foreground backdrop-blur-sm pointer-events-none">
                {index + 1}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function HotGamesSectionSkeleton() {
  return null
}
