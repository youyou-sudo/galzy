import Redis from 'ioredis'

let redisClient: Redis | undefined
const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  throw new Error('Missing REDIS_URL environment variable')
}

const url = new URL(redisUrl)
const redisConfig = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  password: url.password || undefined,
  username: url.username || undefined,
}

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConfig)
  }

  return redisClient
}
export const redis = getRedisClient()
