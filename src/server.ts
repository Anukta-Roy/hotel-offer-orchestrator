import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { Client, Connection } from "@temporalio/client";
import { z } from "zod";
import { config } from "./config";
import { getSupplierHotels } from "./suppliers";
import { filterHotelsByPrice, getCachedHotels, getRedisHealth, redis } from "./redis";
import { hotelOfferWorkflow } from "./workflows/hotelWorkflow";

const app = express();
app.use(cors());
app.use(express.json());

let temporalClient: Client;
async function getTemporalClient(): Promise<Client> {
  if (!temporalClient) {
    const connection = await Connection.connect({ address: config.temporalAddress });
    temporalClient = new Client({ connection, namespace: config.temporalNamespace });
  }
  return temporalClient;
}

app.get("/supplierA/hotels", (req, res) => {
  const city = String(req.query.city ?? "");
  if (!city) return res.status(400).json({ error: "city query parameter is required" });
  try { return res.json(getSupplierHotels("A", city)); }
  catch (error) { return res.status(503).json({ error: (error as Error).message }); }
});

app.get("/supplierB/hotels", (req, res) => {
  const city = String(req.query.city ?? "");
  if (!city) return res.status(400).json({ error: "city query parameter is required" });
  try { return res.json(getSupplierHotels("B", city)); }
  catch (error) { return res.status(503).json({ error: (error as Error).message }); }
});

const citySchema = z.string().trim().min(1).max(80);
app.get("/api/hotels", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityResult = citySchema.safeParse(req.query.city);
    if (!cityResult.success) return res.status(400).json({ error: "A valid city query parameter is required" });
    const city = cityResult.data;
    const minProvided = req.query.minPrice !== undefined;
    const maxProvided = req.query.maxPrice !== undefined;

    if (minProvided || maxProvided) {
      const min = minProvided ? Number(req.query.minPrice) : 0;
      const max = maxProvided ? Number(req.query.maxPrice) : Number.MAX_SAFE_INTEGER;
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
        return res.status(400).json({ error: "minPrice/maxPrice must be valid non-negative numbers and maxPrice >= minPrice" });
      }
      const cached = await getCachedHotels(city);
      if (!cached) return res.status(404).json({
        error: "No cached hotel list found for this city. Call /api/hotels?city=<city> first."
      });
      return res.json(await filterHotelsByPrice(city, min, max));
    }

    const cached = await getCachedHotels(city);
    if (cached) return res.json(cached);

    const client = await getTemporalClient();
    const handle = await client.workflow.start(hotelOfferWorkflow, {
      taskQueue: config.taskQueue,
      workflowId: `hotel-offers-${city.toLowerCase()}-${Date.now()}`,
      args: [city]
    });
    const offers = await handle.result();
    return res.json(offers);
  } catch (error) { next(error); }
});

app.get("/health", async (_req, res) => {
  const redisHealthy = await getRedisHealth();
  let temporalHealthy = false;
  try {
    const client = await getTemporalClient();
    await client.workflowService.getSystemInfo({});
    temporalHealthy = true;
  } catch { temporalHealthy = false; }

  const suppliers = await Promise.all(["A", "B"].map(async (key) => {
    try {
      const response = await fetch(`${config.serviceUrl}/supplier${key}/hotels?city=delhi`);
      return { supplier: `Supplier ${key}`, status: response.ok ? "up" : "down" };
    } catch { return { supplier: `Supplier ${key}`, status: "down" }; }
  }));
  const healthy = redisHealthy && temporalHealthy && suppliers.every((s) => s.status === "up");
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "degraded",
    dependencies: {
      redis: redisHealthy ? "up" : "down",
      temporal: temporalHealthy ? "up" : "down",
      suppliers
    }
  });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error", message: error.message });
});

const server = app.listen(config.port, () => {
  console.log(`Hotel Offer Orchestrator API listening on :${config.port}`);
});

async function shutdown() {
  server.close();
  await redis.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
