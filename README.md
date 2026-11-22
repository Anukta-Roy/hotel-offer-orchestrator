# Hotel Offer Orchestrator

A TypeScript and Express-based service that concurrently retrieves hotel offers from two mock suppliers, selects the cheapest offer for each hotel, orchestrates the process using Temporal, stores the deduplicated results in Redis, and supports price-range filtering using Redis Sorted Sets.

## 1. Project Overview

The Hotel Offer Orchestrator integrates multiple hotel suppliers and provides a unified list of hotel offers.

The application:

- Fetches hotel offers concurrently from Supplier A and Supplier B.
- Uses Temporal to orchestrate the workflow.
- Handles supplier failures and continues if at least one supplier is available.
- Removes duplicate hotel names by retaining the cheapest offer.
- Stores the final results in Redis.
- Supports filtering hotels by minimum and maximum price using Redis Sorted Sets.
- Exposes REST API endpoints through Express.

## 2. Architecture

The application consists of four main components:

### Express API
- Exposes the public hotel aggregation endpoint.
- Provides mock endpoints for Supplier A and Supplier B.
- Supports filtering hotel offers by price.
- Provides a health-check endpoint.

### Temporal Workflow
- Coordinates the hotel aggregation process.
- Calls Supplier A and Supplier B concurrently.
- Handles individual supplier failures.
- Deduplicates offers based on normalized hotel names.
- Selects the cheapest offer for each hotel.
- Persists the final results in Redis.

### Redis
Redis is used for caching and efficient price filtering.

The application stores:
- The final hotel offer list.
- A Redis Hash containing hotel records.
- A Redis Sorted Set indexed by hotel price.

Price filtering uses the Redis `ZRANGEBYSCORE` command instead of filtering the complete hotel list in Node.js.

### Docker Compose
Docker Compose starts and manages:
- Express API
- Temporal server
- Temporal worker
- Redis

## 3. Technologies Used

| Technology | Purpose |
|---|---|
| Node.js 22 | JavaScript runtime |
| TypeScript | Application development |
| Express.js | REST API |
| Temporal | Workflow orchestration |
| Redis | Caching and price filtering |
| Docker | Containerization |
| Docker Compose | Multi-container management |
| Postman | API testing |

## 4. Prerequisites

Install the following before running the application:

- Docker Desktop
- Docker Compose
- Git (optional, for cloning the repository)

For local development without Docker:
- Node.js 22 or later
- npm
- Redis
- Temporal development server

## 5. Getting Started

### Clone the repository

```bash
git clone https://github.com/Anukta-Roy/hotel-offer-orchestrator.git
cd hotel-offer-orchestrator
```

### Run using Docker Compose

Build and start all services:

```bash
docker compose up --build
```

Wait until the API, Temporal worker, Temporal server, and Redis containers have started successfully.

### Service URLs

| Service | URL |
|---|---|
| Express API | http://localhost:3001 |
| Temporal UI | http://localhost:8233 |
| Redis | localhost:6379 |
| Temporal gRPC | localhost:7233 |

To stop the services:

```bash
docker compose down
```

To stop the services and remove the Redis data volume:

```bash
docker compose down -v
```

**Note:** The second command deletes persisted Redis data.

## 6. API Documentation

### 6.1 Aggregate Hotel Offers

**Endpoint**

```http
GET /api/hotels?city=delhi
```

**Example**

```http
http://localhost:3001/api/hotels?city=delhi
```

The first request for a city starts a Temporal workflow.

The workflow:
1. Fetches offers from both suppliers concurrently.
2. Combines the supplier responses.
3. Identifies duplicate hotel names.
4. Retains the cheapest offer for each hotel.
5. Stores the final results in Redis.
6. Returns the aggregated hotel offers.

Subsequent requests for the same city are served from Redis.

Each returned hotel contains exactly four fields:

- `name`
- `price`
- `supplier`
- `commissionPct`

**Example response**

```json
[
  {
    "name": "Holtin",
    "price": 5340,
    "supplier": "Supplier B",
    "commissionPct": 20
  },
  {
    "name": "Radison",
    "price": 5900,
    "supplier": "Supplier A",
    "commissionPct": 13
  }
]
```

### 6.2 Filter Hotels by Price Range

**Endpoint**

```http
GET /api/hotels?city=delhi&minPrice=5000&maxPrice=6000
```

The city must first be loaded using the aggregate endpoint.

The application uses Redis Sorted Sets to retrieve hotels within the specified price range.

The filtering operation uses:

```redis
ZRANGEBYSCORE
```

Both minimum and maximum price boundaries are inclusive.

**Example response**

```json
[
  {
    "name": "Holtin",
    "price": 5340,
    "supplier": "Supplier B",
    "commissionPct": 20
  },
  {
    "name": "Radison",
    "price": 5900,
    "supplier": "Supplier A",
    "commissionPct": 13
  }
]
```

### 6.3 Supplier A

**Endpoint**

```http
GET /supplierA/hotels?city=delhi
```

Returns mock hotel offers from Supplier A.

### 6.4 Supplier B

**Endpoint**

```http
GET /supplierB/hotels?city=delhi
```

Returns mock hotel offers from Supplier B.

Both suppliers intentionally return overlapping hotel names to demonstrate duplicate detection and cheapest-price selection.

### 6.5 Health Check

**Endpoint**

```http
GET /health
```

Checks the availability of:
- Redis
- Temporal
- Supplier A
- Supplier B

Returns HTTP 200 when all dependencies are healthy and HTTP 503 when a dependency is unavailable.

## 7. Test Scenarios

The following scenarios were tested using Postman:

| Test | Description | Expected Result |
|---|---|---|
| Aggregate offers | Fetch Delhi hotel offers | Deduplicated hotel list |
| Price filtering | Filter prices between 5000 and 6000 | Only matching offers |
| Empty results | Fetch Jaipur hotel offers | Empty array `[]` |
| Supplier A | Fetch Supplier A offers | Supplier A mock data |
| Supplier B | Fetch Supplier B offers | Supplier B mock data |
| Health check | Check service dependencies | Healthy status |

### Supplier Failure Handling

The workflow uses `Promise.allSettled()` to handle supplier responses independently.

If one supplier becomes unavailable, the workflow can still return offers from the available supplier.

If both suppliers fail, the workflow fails.

To test this behavior:

1. Stop the running Compose services.
2. Add the following environment variable under the `api` service in `docker-compose.yml`:

```yaml
environment:
  SUPPLIER_A_ENABLED: "false"
```

3. Start the services again:

```bash
docker compose up --build
```

4. Use a fresh city that has not already been cached, or clear the relevant city's Redis cache before testing.
5. Call the aggregate hotel endpoint.

Supplier A should return an unavailable response, while Supplier B should still provide offers.

To test the reverse scenario, use:

```yaml
SUPPLIER_B_ENABLED: "false"
```

## 8. Postman Collection

The Postman collection is available at:

```text
postman/Hotel-Offer-Orchestrator.postman_collection.json
```

To import it:

1. Open Postman.
2. Click **Import**.
3. Select the collection JSON file from the `postman` folder.
4. Import the collection.
5. Make sure Docker Compose is running.
6. Execute the requests.

The collection includes:

- Aggregate Delhi hotel offers
- Filter Delhi hotels by price range
- Test a city with no results
- Test Supplier A
- Test Supplier B
- Check application health

The API base URL is:

```text
http://localhost:3001
```

## 9. Local Development Without Docker

To run the application locally, start Redis and a Temporal development server separately.

Create the environment file:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux/macOS**

```bash
cp .env.example .env
```

Install dependencies:

```bash
npm install
```

Build the TypeScript application:

```bash
npm run build
```

Start the API:

```bash
npm start
```

In a separate terminal, start the Temporal worker:

```bash
npm run worker
```

Configure the following environment variables in `.env` as required:

```env
TEMPORAL_ADDRESS=localhost:7233
REDIS_URL=redis://localhost:6379
SERVICE_URL=http://localhost:3001
```

## 10. Project Structure

```text
hotel-offer-orchestrator/
│
├── src/
│   ├── activities/
│   │   └── hotels.ts
│   │
│   ├── workflows/
│   │   └── hotelWorkflow.ts
│   │
│   ├── config.ts
│   ├── redis.ts
│   ├── server.ts
│   ├── suppliers.ts
│   ├── types.ts
│   └── worker.ts
│
├── postman/
│   └── Hotel-Offer-Orchestrator.postman_collection.json
│
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── IMPLEMENTATION_NOTES.md
├── package.json
├── README.md
└── tsconfig.json
```

## 11. Implementation Details

### Duplicate Hotel Handling

Hotel names are normalized by trimming whitespace and comparing names without case sensitivity.

When duplicate hotel names are found, the application retains the offer with the lowest price.

If two offers have the same price, the first encountered offer is retained.

### Concurrent Supplier Requests

Both supplier requests are executed concurrently using `Promise.allSettled()`.

This allows the workflow to process successful supplier responses even if another supplier fails.

### Redis Price Indexing

The application maintains a Redis Sorted Set indexed by hotel price.

This enables efficient price-range queries using `ZRANGEBYSCORE`.

### Caching

Aggregated hotel results are stored in Redis so subsequent requests for the same city can be served without repeating the complete supplier aggregation workflow.

### Error Handling and Logging

The application includes workflow logging, supplier failure handling, API error handling, and a health-check endpoint for monitoring service dependencies.

## 12. Limitations

- Supplier responses are mock data and do not represent live hotel inventory.
- The application is designed as a take-home assignment demonstration rather than a production booking system.
- Cached results may need to be cleared when testing changes in supplier availability.
- A city must be loaded before its price-range filter can return cached results.

## 13. GitHub Repository

**Repository:**  
https://github.com/Anukta-Roy/hotel-offer-orchestrator

The repository contains the application source code, Docker configuration, Postman collection, README documentation, and environment variable example.

---

**Project:** Hotel Offer Orchestrator  
**Backend:** Node.js, TypeScript, Express.js  
**Workflow Orchestration:** Temporal  
**Caching and Filtering:** Redis  
**Containerization:** Docker and Docker Compose