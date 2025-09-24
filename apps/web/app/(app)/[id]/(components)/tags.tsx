import { Badge } from '@web/components/ui/badge'
import Link from 'next/link'
import { tagshData } from '../(action)/tags'

export async function TagsCard({ id }: { id: string }) {
  const tags = await tagshData(id)
  return (
    <div className="flex flex-wrap gap-2">
      {tags?.tags.map(
        (item, i) =>
          item.tag_data && (
            <Badge variant="secondary" key={i}>
              <Link href={`/tags/${item.tag_data?.id}`}>
                {item.tag_data?.zht_name || item.tag_data?.name}
              </Link>
            </Badge>
          ),
      )}
    </div>
  )
}
