import HoverPrefetchLink from '@web/components/HoverPLink'

interface Item {
  id?: string
  tag?: string
  title: string
}

interface RankingListProps<T extends Item> {
  fetchData: () => Promise<T[]>
  linkKey: 'id' | 'tag'
}

export default async function RankingList<T extends Item>({
  fetchData,
  linkKey,
}: RankingListProps<T>) {
  const datas = await fetchData()

  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
      {datas.map((item, index) => {
        const linkValue = item[linkKey]
        if (!linkValue) return null
        const href = linkKey === 'tag' ? `/tags/${linkValue}` : `/${linkValue}`

        return (
          <li key={linkValue} className="w-full">
            <HoverPrefetchLink href={href} className="block w-full">
              <span className="flex items-center w-full">
                <span
                  className={`font-bold mr-2 shrink-0 ${
                    index === 0
                      ? 'text-red-500'
                      : index === 1
                        ? 'text-yellow-500'
                        : index === 2
                          ? 'text-blue-500'
                          : ''
                  }`}
                >
                  {index + 1}.
                </span>
                <span
                  className={`font-bold text-sm flex-1 min-w-0 truncate ${
                    index === 0
                      ? 'underline decoration-red-500 underline-offset-4'
                      : index === 1
                        ? 'underline decoration-yellow-500 underline-offset-4'
                        : index === 2
                          ? 'underline decoration-blue-500 underline-offset-4'
                          : ''
                  }`}
                >
                  {linkKey === 'tag' ? '#' : ''}
                  {item.title}
                </span>
              </span>
            </HoverPrefetchLink>
          </li>
        )
      })}
    </ul>
  )
}
