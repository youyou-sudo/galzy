import { SlidingNumber } from '@web/components/animate-ui/text/sliding-number'
import { Send } from 'lucide-react'
import Link from 'next/link'
import { totalCountGet } from '../(action)/homeData'

export default async function CountComponent() {
  const coutn = await totalCountGet()
  return (
    <div className="flex items-center">
      {coutn && (
        <span className="pl-1 flex opacity-50">
          共收录了： <SlidingNumber number={coutn} padStart />
          条目
        </span>
      )}
      <span className="inline-flex items-center gap-1 ml-2">
        <Link
          className="underline text-blue-500 hover:text-blue-300"
          target="_blank"
          href="https://t.me/+mKVpQNjxQss1ZDRl"
        >
          频道
        </Link>
        <Send size={15} className="text-blue-400" />
      </span>
    </div>
  )
}
