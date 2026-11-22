import Redis from "ioredis";
import { config } from "./config";
import { HotelOffer } from "./types";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false
});

const normalizeCity = (city: string) => city.trim().toLowerCase();
const hotelsKey = (city: string) => `hotels:${normalizeCity(city)}:data`;
const pricesKey = (city: string) => `hotels:${normalizeCity(city)}:prices`;
const cacheKey = (city: string) => `hotels:${normalizeCity(city)}:list`;

export async function saveHotels(city: string, hotels: HotelOffer[]): Promise<void> {
  const tx = redis.multi();
  tx.del(hotelsKey(city), pricesKey(city), cacheKey(city));
  for (const hotel of hotels) {
    const member = hotel.name.toLowerCase();
    tx.hset(hotelsKey(city), member, JSON.stringify(hotel));
    tx.zadd(pricesKey(city), hotel.price, member);
  }
  tx.set(cacheKey(city), JSON.stringify(hotels), "EX", config.cacheTtlSeconds);
  tx.expire(hotelsKey(city), config.cacheTtlSeconds);
  tx.expire(pricesKey(city), config.cacheTtlSeconds);
  await tx.exec();
}

export async function getCachedHotels(city: string): Promise<HotelOffer[] | null> {
  const value = await redis.get(cacheKey(city));
  return value ? JSON.parse(value) as HotelOffer[] : null;
}

/** Price range is evaluated by Redis itself through ZRANGEBYSCORE. */
export async function filterHotelsByPrice(
  city: string, minPrice: number, maxPrice: number
): Promise<HotelOffer[]> {
  const names = await redis.zrangebyscore(pricesKey(city), minPrice, maxPrice);
  if (!names.length) return [];
  const records = await redis.hmget(hotelsKey(city), ...names);
  return records.filter((value): value is string => value !== null)
    .map((value) => JSON.parse(value) as HotelOffer);
}

export async function getRedisHealth(): Promise<boolean> {
  try { return (await redis.ping()) === "PONG"; } catch { return false; }
}
