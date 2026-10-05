# Architecture Decision Records

| # | Decision | Alternatives | Why chosen | Consequence |
|---|---|---|---|---|
| ADR-1 | SQL (ACID) for inventory/payment/order | NoSQL | Need constraints, transactions, audit | Harder to scale writes; mitigated because only ~100 winners write |
| ADR-2 | Redis Lua gate + SQL conditional update | Pure pessimistic or pure optimistic locking | Protects DB from 10,000 contenders, DB stays the truth | Two stores to reconcile |
| ADR-3 | Temporary reservation with expiry | Deduct stock only after payment | Prevents paying for sold-out items; fair | Stock held up to 5 min |
| ADR-4 | Async order creation via events + outbox | Synchronous call to Order Service | Order outage must not lose paid orders | Eventual consistency, idempotent consumers |
| ADR-5 | Idempotency keys everywhere | Rely on client not double-clicking | Duplicates and retries are certain at scale | Extra storage and key management |
| ADR-6 | Kafka as broker | RabbitMQ | Durable log, replay, high throughput | More operational overhead |
| ADR-7 | Separate Inventory, Payment, Order services | Monolith | Independent scaling and failure isolation | More network calls, needs tracing |
| ADR-8 | Virtual waiting room + rate limiting | Accept all traffic | Protects system at 50x | Some users wait |
| ADR-9 | Saga (choreography) with reconciliation and compensation | Distributed 2PC | 2PC is slow and fragile across services | More states to model |
| ADR-10 | CDN + Redis cache for reads | Always hit DB | Browse traffic is mostly reads | Stale for seconds (fine for catalogue, never used for stock decisions) |
