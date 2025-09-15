'use client'

import Errors from '@web/components/error'
import { useEffect } from 'react'

export default function Error({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <Errors code="500" errormessage={error.message} />
}
