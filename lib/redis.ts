import Redis from "ioredis";
import { env } from "next-runtime-env";
import { deflate, inflate } from "fflate";

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      host: env("REDIS_HOST"),
      port: Number(env("REDIS_PORT")),
      password: env("REDIS_PASSWORD"),
      lazyConnect: true, // 👈 避免自动连接
    });
  }
  return redis;
}

async function ensureConnected() {
  const r = getRedis();
  if (r.status === "end" || r.status === "waiting") {
    await r.connect(); // 显式连接
  }
  return r;
}

// 压缩数据并存储到 Redis
export const setKv = async (key: string, value: string, time?: number) => {
  const redis = await ensureConnected();
  const keyString = `${key}`;

  const compressedValue = await new Promise<Uint8Array>((resolve, reject) => {
    deflate(new TextEncoder().encode(value), (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  const compressedValueStr = Buffer.from(compressedValue.buffer).toString("base64");

  if (time) {
    await redis.setex(keyString, time, compressedValueStr);
  } else {
    await redis.set(keyString, compressedValueStr);
  }
};

export const getKv = async (key: string) => {
  const redis = await ensureConnected();
  const keyString = `${key}`;
  const compressedValueBase64 = await redis.get(keyString);
  if (!compressedValueBase64) return null;

  const compressedValue = new Uint8Array(Buffer.from(compressedValueBase64, "base64"));

  const decompressedValue = await new Promise<Uint8Array>((resolve, reject) => {
    inflate(compressedValue, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  return new TextDecoder().decode(decompressedValue);
};

export const delKv = async (key: string) => {
  const redis = await ensureConnected();
  await redis.del(`${key}`);
};

export const pushQueue = async (queueName: string, value: any) => {
  const redis = await ensureConnected();
  await redis.xadd(queueName, "*", "data", JSON.stringify(value));
};

export const popQueue = async (queueName: string) => {
  const redis = await ensureConnected();
  const result = await redis.xread("COUNT", 1, "STREAMS", queueName, "0-0");

  if (!result || !result[0] || !result[0][1] || !result[0][1][0]) return null;

  const [messageId, [, messageData]] = result[0][1][0];
  await redis.xdel(queueName, messageId);

  return JSON.parse(messageData);
};

export const getQueueLength = async (queueName: string) => {
  const redis = await ensureConnected();
  return await redis.xlen(queueName);
};

export const clearQueue = async (queueName: string) => {
  const redis = await ensureConnected();
  await redis.del(queueName);
};

export default getRedis;
