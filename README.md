# Hotel Offer Orchestrator

A TypeScript/Express service that concurrently retrieves mock offers from two hotel suppliers, selects the cheapest offer per hotel name with Temporal, stores the deduplicated result in Redis, and filters prices inside Redis.

## Architecture

- **Express API** exposes the public hotel endpoint and two mock supplier endpoints.
- **Temporal workflow** orchestrates supplier calls concurrently, tolerates one supplier being unavailable, deduplicates by normalized hotel name, and persists results.
- **Redis** stores the final JSON list, a hotel hash, and a sorted set indexed by price. Price filtering uses `ZRANGEBYSCORE` in Redis rather than filtering the list in Node.
- **Docker Compose** starts API, Temporal, worker, and Redis.

## Requirements

- Docker Desktop with Docker Compose
- Optional for local development: Node.js 22+

## Run with Docker

```bash
docker compose up --build
```

Wait for the API and worker containers to start. Services:

| Service | URL |
|---|---|
| API | http://localhost:3001 |
| Temporal UI | http://localhost:8233 |
| Redis | localhost:6379 |
| Temporal gRPC | localhost:7233 |

## API

### Aggregate offers

```http
GET http://localhost:3001/api/hotels?city=delhi
```

The first request starts a Temporal workflow. The workflow calls Supplier A and Supplier B in parallel, then returns one cheapest offer per hotel name and saves the result in Redis. Later requests for the same city are served from Redis. The response contains exactly `name`, `price`, `supplier`, and `commissionPct`.

Example response:

```json
[
  {
    "name": "Holtin",
    "price": 5340,
    "supplier": "Supplier B",
    "commissionPct": 20
  }
]
```

### Filter by price range

```http
GET http://localhost:3001/api/hotels?city=delhi&minPrice=5000&maxPrice=6000
```

The city must have been loaded once using the aggregate endpoint. The filter is executed by Redis with a sorted-set range query. Both bounds are inclusive.

### Mock suppliers

```http
GET http://localhost:3001/supplierA/hotels?city=delhi
GET http://localhost:3001/supplierB/hotels?city=delhi
```

Both suppliers deliberately return overlapping hotel names so that the comparison is meaningful.

### Health

```http
GET http://localhost:3001/health
```

Reports Redis, Temporal, and both supplier endpoint statuses. Returns HTTP 200 only when all dependencies are up, otherwise HTTP 503.

## Test scenarios

1. **Valid city / overlapping results:** `GET /api/hotels?city=delhi`
2. **City with no results:** `GET /api/hotels?city=jaipur` returns `[]`.
3. **Price range:** first load Delhi, then call `GET /api/hotels?city=delhi&minPrice=5000&maxPrice=6000`.
4. **One supplier down:** stop either supplier logically by setting `SUPPLIER_A_ENABLED=false` or `SUPPLIER_B_ENABLED=false` for the relevant service process, then recreate/restart the worker and API containers. The workflow will return the offers from the available supplier. If both are unavailable, the workflow fails.
5. **Health:** `/health` becomes degraded when Redis, Temporal, or either supplier is unavailable.

To test supplier-down behavior with Compose, set the environment variable in `docker-compose.yml` under both `api` and `worker`, then run:

```bash
docker compose up --build
```

For example, set `SUPPLIER_A_ENABLED: "false"` under `api`. The mock Supplier A endpoint will return 503, while Supplier B results can still be returned.

## Local development (without Docker)

Start Redis and a Temporal dev server separately, then:

```bash
cp .env.example .env
npm install
npm run build
npm start
```

In another terminal:

```bash
npm run worker
```

For local development, set `TEMPORAL_ADDRESS=localhost:7233`, `REDIS_URL=redis://localhost:6379`, and `SERVICE_URL=http://localhost:3001` in `.env`.

## Project structure

```text
src/
  activities/hotels.ts
  workflows/hotelWorkflow.ts
  config.ts
  redis.ts
  server.ts
  suppliers.ts
  types.ts
  worker.ts
postman/
  Hotel-Offer-Orchestrator.postman_collection.json
Dockerfile
docker-compose.yml
```

## Implementation notes

- Hotel names are compared case-insensitively after trimming whitespace.
- Equal prices keep the first encountered offer (Supplier A, because its results are processed first).
- If only one supplier succeeds, its results are still returned.
- Price filter bounds are inclusive.
- Redis keys use a normalized lowercase city.
- The example supplier data is static and intended for a take-home assignment/demo, not production inventory.
