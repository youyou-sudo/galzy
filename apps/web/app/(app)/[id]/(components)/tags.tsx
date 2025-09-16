import { Badge } from '@web/components/ui/badge'
import Link from 'next/link'
import { tagshData } from '../(action)/tags'

export async function TagsCard({ id }: { id: string }) {
  const tags = await tagshData(id)
  return (
    <div className="flex flex-wrap gap-2">
      {tags?.tag.map(
        (item, i) =>
          item && (
            <Badge variant="secondary" key={i}>
              <Link href={`/tags/${item.id}`}>
                {item.zh_name || item.name}
              </Link>
            </Badge>
          ),
      )}
    </div>
  )
}
