import Redis from "ioredis";
import { env } from "next-runtime-env";

export const redisConfig = {
  port: parseInt(env("REDIS_PORT")!),
  host: env("REDIS_HOST")!,
  password: env("REDIS_PASSWORD"),
};

export const redis = new Redis(redisConfig);
