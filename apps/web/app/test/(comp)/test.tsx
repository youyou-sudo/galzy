"use client"

import { authClient } from "@web/lib/auth-client"

export default function TestComp() {
  const { data: session } = authClient.useSession()
  return (
    <div>{JSON.stringify(session, null, 2)}</div>
  )
}
