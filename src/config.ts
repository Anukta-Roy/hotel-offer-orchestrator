import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "hotel-offer-queue",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  serviceUrl: process.env.SERVICE_URL ?? "http://localhost:3000",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 3600),
};
