import { getRequestHeader } from '@tanstack/react-start/server'

export const cookiePass = () => ({
  fetch: {
    headers: {
      cookie: getRequestHeader('Cookie') || '',
    },
  },
})
