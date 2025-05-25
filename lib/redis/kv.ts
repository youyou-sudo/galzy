import { redis } from "./redis";

export const setKv = async (key: string, value: string, time?: number) => {
  return time ? redis.setex(key, time, value) : redis.set(key, value);
};

export const getKv = async (key: string) => redis.get(key);

export const delKv = async (key: string) => redis.del(key);
