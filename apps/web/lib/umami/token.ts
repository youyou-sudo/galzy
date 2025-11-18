import { env } from 'next-runtime-env'

export const umamiTokenGet = async () => {
  'use cache'
  const res = await fetch(`${env('UMAMI_URL')}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: env('UMAMI_DATA_USER'),
      password: env('UMAMI_DATA_PASSWORD'),
    }),
  })
  const data = await res.json()
  return data.token
}
