import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Badge } from '@web/components/ui/badge'
import { Input } from '@web/components/ui/input'
import { seoTemplate } from '@web/config/seoTemplate'
import { getSearchTags, SearchTagsSchema } from '@web/server/tags'
import { SearchIcon, TagsIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/tags/')({
  component: RouteComponent,
  validateSearch: SearchTagsSchema,
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ deps }) => {
    return {
      tags: await getSearchTags({ data: { q: deps.q, limit: 200 } }),
      q: deps.q,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `标签检索 - ${loaderData?.q || '所有标签'} | ${seoTemplate.title}`,
      },
      {
        name: 'description',
        content: `浏览和搜索游戏标签，当前${loaderData?.q ? `搜索"${loaderData.q}"` : '查看所有标签'}，共 ${loaderData?.tags?.totalHits || 0} 个标签`,
      },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'public, max-age=300',
    Vary: 'Accept, Accept-Encoding',
  }),
  staleTime: 1000 * 30,
})

function RouteComponent() {
  const { tags, q: initialQ } = Route.useLoaderData()
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState(initialQ || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      navigate({
        to: '/tags',
        search: trimmed ? { q: trimmed } : {},
        replace: true,
      })
    },
    [navigate],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(value)
    }, 300)
  }

  const handleClear = () => {
    setInputValue('')
    navigate({ to: '/tags', search: {}, replace: true })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      handleSearch(inputValue)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const tagItems = tags?.hits ?? []

  return (
    <section className="md:w-7xl p-3 space-y-4">
      <div className="flex items-center justify-center gap-2 mb-4">
        <TagsIcon className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">游戏标签检索</h1>
      </div>

      <div className="mx-auto md:w-1/2 items-center justify-center my-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入标签名称搜索，回车或自动搜索喵～"
            className="pl-9 pr-8"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="清除搜索"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
      {tagItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <TagsIcon className="size-12 mb-4 opacity-30" />
          <p className="text-lg">没有找到匹配的标签喵～</p>
          <p className="text-sm mt-1">试试其他关键词吧 🐾</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center p-3">
          {tagItems.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="px-3 py-1.5 text-sm hover:bg-secondary/80 transition-colors"
            >
              <Link
                to="/tags/$tagId"
                params={{ tagId: tag.id }}
                className="no-underline text-foreground/80 hover:text-foreground"
              >
                {tag.zh_name || tag.name}
              </Link>
            </Badge>
          ))}
        </div>
      )}
    </section>
  )
}
