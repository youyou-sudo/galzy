import { Link } from '@tanstack/react-router'
import { GameCard } from '@web/components/home/card'
import { getImageUrl } from '@web/lib/image-url'
import { Flame, TrendingUp } from 'lucide-react'

interface HotGame {
  id: string
  title: string | null
  total: number
  imageId: string | null
  imageWidth: number | null
  imageHeight: number | null
  cSexualAvg: number | null
}

interface HotGamesSectionProps {
  games: HotGame[] | null
}

export function HotGamesSection({ games }: HotGamesSectionProps) {
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
        {displayGames.map((game, index) => (
          <div key={game.id} className="relative">
            <GameCard.Item
              gameid={game.id}
              title={game.title || '未知游戏'}
              width={game.imageWidth ?? 200}
              height={game.imageHeight ?? 300}
              src={getImageUrl({
                imageId: game.imageId ?? null,
                width: game.imageWidth ?? null,
                height: game.imageHeight ?? null,
              })}
              cSexualAvg={game.cSexualAvg ?? null}
            />
            <span className="absolute top-1.5 left-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-background/80 text-xs font-bold text-foreground backdrop-blur-sm pointer-events-none">
              {index + 1}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function HotGamesSectionSkeleton() {
  return null
}
