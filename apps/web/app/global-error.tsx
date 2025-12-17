'use client'

import Errors from '@web/components/error'
import { Button } from '@web/components/ui/button'
import Link from 'next/link'

export default function Error() {

  return (
    <html>
      <body>
  <Errors code="404" errormessage={'找不到这个页面'} />
          <Link href="/">
            <Button>
              返回首页
            </Button>
          </Link>
      </body>
    </html>
  )
}
