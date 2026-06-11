import { getRequestHeader } from '@tanstack/react-start/server'

const cookie = getRequestHeader('Cookie')

export const cookiePass = {
  fetch: {
    headers: {
      cookie: cookie || '',
    },
  },
}
