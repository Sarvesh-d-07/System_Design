# Container / Service Architecture

| Service | Responsibility | Data store | Style |
|---|---|---|---|
| CDN + WAF | Static/sale pages, bot and DDoS filtering | Edge cache | - |
| API Gateway | JWT auth, rate limit, routing, request-id | - | Sync |
| Product/Sale Service | Catalogue, sale rules, deals, coupons | SQL + Redis cache | Sync, read-heavy |
| Cart Service | Cart and cart items | Redis + SQL | Sync |
| Inventory & Reservation Service | Reserve, confirm, release stock | Redis (gate) + SQL (truth) | Sync (critical) |
| Checkout Service (Facade) | Orchestrates reserve -> pay -> order | SQL (saga state) | Sync + async |
| Payment Service | Gateway calls, idempotency, reconciliation | SQL | Sync + async |
| Order Service | Order lifecycle state machine | SQL | Async consumer |
| Shipment Service | Fulfilment, delivery partner | SQL | Async |
| Notification Service | Email/SMS/push | Queue + SQL | Async |
| Message Broker (Kafka) | Events between services | Durable log | Async |
| Reservation Expiry Worker | Releases expired reservations | SQL + Redis | Background |
| Reconciliation Worker | Fixes payment/order mismatches | SQL | Background |

## Bottlenecks and why each component exists

| Bottleneck | Mitigation |
|---|---|
| 10,000 users on one hot row | Redis atomic gate absorbs traffic; DB sees only ~100 writes |
| Product page reads | CDN + Redis cache |
| Payment gateway limits | Queue, circuit breaker, only ~100 payments needed |
| Single DB primary | Partition by product/sale, read replicas, outbox pattern |
