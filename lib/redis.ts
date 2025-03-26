import Redis from "ioredis";
import { env } from "next-runtime-env";
import { deflate, inflate } from "fflate";

// 初始化 Redis 连接
const redis = new Redis({
  host: env("REDIS_HOST"),
  port: Number(env("REDIS_PORT")),
  password: env("REDIS_PASSWORD"),
});

// 压缩数据并存储到 Redis
export const setKv = async (key: string, value: string, time?: number) => {
  const keyString = `${key}`;

  // 使用 deflate 压缩字符串数据
  const compressedValue = await new Promise<Uint8Array>((resolve, reject) => {
    deflate(new TextEncoder().encode(value), (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  // 将压缩后的 Uint8Array 转换为 Base64 字符串
  const compressedValueStr = Buffer.from(compressedValue.buffer).toString(
    "base64"
  );

  if (time) {
    await redis.setex(keyString, time, compressedValueStr);
  } else {
    await redis.set(keyString, compressedValueStr);
  }
};

// 从 Redis 获取数据并解压
export const getKv = async (key: string) => {
  const keyString = `${key}`;
  const compressedValueBase64 = await redis.get(keyString);

  if (!compressedValueBase64) return null;

  // 将 Base64 字符串转换为 Buffer，然后转换为 Uint8Array
  const compressedValue = new Uint8Array(
    Buffer.from(compressedValueBase64, "base64")
  );

  // 使用 inflate 解压数据
  const decompressedValue = await new Promise<Uint8Array>((resolve, reject) => {
    inflate(compressedValue, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  // 将解压后的 Uint8Array 转换为字符串
  const decodedValue = new TextDecoder().decode(decompressedValue);

  return decodedValue;
};

// 删除 Redis 中的键值
export const delKv = async (key: string) => {
  const keyString = `${key}`;
  await redis.del(keyString);
};
// 入队（添加到 Stream）
export const pushQueue = async (queueName: string, value: any) => {
  const stringValue = JSON.stringify(value);
  await redis.xadd(queueName, "*", "data", stringValue);
};

// 出队（从 Stream 读取并确认）
export const popQueue = async (queueName: string) => {
  // 读取一条消息，使用 0-0 表示从最早的未读消息开始
  const result = await redis.xread("COUNT", 1, "STREAMS", queueName, "0-0");

  if (!result || !result[0] || !result[0][1] || !result[0][1][0]) {
    return null;
  }

  const [messageId, [, messageData]] = result[0][1][0];

  // 删除已读消息
  await redis.xdel(queueName, messageId);

  return JSON.parse(messageData);
};

// 获取队列长度
export const getQueueLength = async (queueName: string) => {
  const info = await redis.xlen(queueName);
  return info;
};

// 清空队列
export const clearQueue = async (queueName: string) => {
  await redis.del(queueName);
};

export default redis;
