import Redis from "ioredis";
import { env } from "next-runtime-env";

let redisClient: Redis | undefined;

export const redisConfig = {
  host: env("REDIS_HOST")!,
  port: parseInt(env("REDIS_PORT")!),
  password: env("REDIS_PASSWORD")!,
};

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);
  }

  return redisClient;
}
