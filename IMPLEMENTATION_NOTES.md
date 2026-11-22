# Implementation notes

- Temporal workflow code is deterministic: all network and Redis operations live in activities.
- Supplier A/B requests are parallelized with `Promise.allSettled`.
- Redis sorted-set scores are hotel prices, so filtering is an inclusive `ZRANGEBYSCORE` operation.
- Workflow id includes city and timestamp to avoid collisions when the cache expires.
- `/health` checks Temporal, Redis and both mock supplier endpoints.
