import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react' // make sure to import from better-auth/react sure to import from better-auth/react

export const authClient = createAuthClient({
  //you can pass client configuration here
  plugins: [adminClient()],
})
