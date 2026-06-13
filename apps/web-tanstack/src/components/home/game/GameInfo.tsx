import { Link } from '@tanstack/react-router'
import { BBCodeRenderer } from '@web/components/bbcode'
import { TagsCard } from '@web/components/home/game/tags'
import { formatLooseDate } from '@web/lib'
import type { getGameDetail } from '@web/server/game'
import { Search } from 'lucide-react'

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>

export function GameInfo({ game }: { game: GameData }) {
  return (
    <>
      {/* 发行日期 */}
      {game?.released_first && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          发布：
          <Link
            to="/search"
            search={{
              startDate: `${formatLooseDate(String(game.released_first)).year}-01-01`,
              endDate: `${formatLooseDate(String(game.released_first)).year}-12-31`,
            }}
            className="relative inline-flex items-center gap-0.5 text-cyan-600"
          >
            <span className="relative">
              {formatLooseDate(String(game.released_first)).year}-
              {formatLooseDate(String(game.released_first)).formatted}
              <Search className="absolute -top-1 -right-3 size-3 text-zinc-400" />
            </span>
          </Link>
        </div>
      )}

      {/* 开发组织 */}
      {game?.producers && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          开发：
          {game.producers
            .filter((producer) => producer.type === 'co')
            .filter((producer) => producer.is_dev === true)
            .map((producer, index, arr) => (
              <Link
                to={`/producer/$pid`}
                params={{ pid: producer.id }}
                key={producer.id}
              >
                <span className="relative inline-flex items-center gap-0.5 text-cyan-600 wrap-break-word hover:underline">
                  {producer.name}
                </span>
                {index < arr.length - 1 ? ' & ' : ''}
              </Link>
            ))}
        </div>
      )}

      {/* 发行组织 */}
      {game?.producers && (
        <div className="text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">发行：</span>
          <span className="">
            {game.producers
              .filter((producer) => producer.is_pub === true)
              .map((producer, index, arr) => (
                <Link
                  to={`/producer/$pid`}
                  params={{ pid: producer.id }}
                  key={producer.id}
                >
                  <span
                    className={`${producer.type === 'ng' ? 'text-cyan-900 opacity-50 dark:opacity-100' : 'text-cyan-600'} wrap-break-word hover:underline`}
                  >
                    {producer.name}
                  </span>
                  {index < arr.length - 1 ? (
                    <span className="text-zinc-500 dark:text-zinc-400 opacity-100">
                      {' '}
                      &{' '}
                    </span>
                  ) : (
                    ''
                  )}
                </Link>
              ))}
          </span>
        </div>
      )}

      {/* Description */}
      {(game?.other_datas?.description || game?.vn_datas?.description) && (
        <div className="mt-2">
          <div className="text-xs text-zinc-500 uppercase mb-1">游戏简介</div>
          <div className="text-sm line-clamp-6 leading-relaxed text-zinc-800 dark:text-zinc-200">
            <BBCodeRenderer
              text={
                game?.other_datas?.description ||
                game?.vn_datas?.description ||
                ''
              }
            />
          </div>
        </div>
      )}
      {/* Tags section */}
      <TagsCard />
    </>
  )
}
