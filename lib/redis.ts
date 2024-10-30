// lib/redis.ts
import Redis from "ioredis";
import { env } from "next-runtime-env";

const redis = new Redis({
  host: env("REDIS_HOST"),
  port: Number(env("REDIS_PORT")),
  password: env("REDIS_PASSWORD"),
});

export default redis;
