import Redis from 'ioredis'

let redisClient: Redis | undefined

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
}

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConfig)
  }

  return redisClient
}
export const redis = getRedisClient()
