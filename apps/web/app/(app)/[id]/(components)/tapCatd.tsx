'use client'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@web/components/animate-ui/radix/tabs'
import { Card, CardContent } from '@web/components/ui/card'
import { authClient } from '@web/lib/auth-client'
import { ArrowDownToLine, Swords } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Glgczujm } from './tips'

export const TapCatd = ({
  id,
  children,
}: {
  id: string
  children?: React.ReactNode
}) => {
  const pathname = usePathname()
  return (
    <Tabs
      defaultValue={
        pathname === `/${id}/introduction` || pathname.match(`${id}/\\d+`)
          ? 'introduction'
          : 'download'
      }
    >
      <TabsList>
        <TabsTrigger value="download" asChild>
          <Link href={`/${id}`}>
            <ArrowDownToLine className="h-4 w-4" />
            下载
          </Link>
        </TabsTrigger>
        <TabsTrigger value="introduction" asChild>
          <Link href={`/${id}/introduction`}>
            {' '}
            <Swords />
            攻略
          </Link>
        </TabsTrigger>
      </TabsList>
      <Card className="p-0">
        <CardContent className="p-0">
          {children}
          <Glgczujm />
        </CardContent>
      </Card>
    </Tabs>
  )
}
