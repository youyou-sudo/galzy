import { Badge } from '@web/components/ui/badge'
import { tagshData } from '../(action)/tags'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@web/components/animate-ui/radix/accordion'
import HoverPrefetchLink from '@web/components/HoverPLink'

export async function TagsCard({ id }: { id: string }) {
  const tags = await tagshData(id)
  return (
    (tags?.tags.length === 0 ? null :
      <div className="mt-4 mb-5" >
        <Accordion type="single" collapsible className="w-full ">
          <AccordionItem
            value="tags"
            className="px-3 border rounded-lg"
          >
            <AccordionTrigger className="text-sm opacity-70 hover:opacity-100 py-3">
              游戏标签
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="flex flex-wrap gap-2">
                {tags?.tags.map(
                  (item, i) =>
                    item.tag_data && (
                      <Badge variant="secondary" key={i}>
                        <HoverPrefetchLink prefetch={true} href={`/tags/${item.tag_data?.id}`}>
                          {item.tag_data?.zht_name || item.tag_data?.name}
                        </HoverPrefetchLink>
                      </Badge>
                    ),
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    )
  )
}
