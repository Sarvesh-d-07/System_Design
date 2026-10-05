# Scalability and Failure Recovery

## Practical test case

Stock 100 | users 10,000 | payment success 95% | failures 5% | duplicates 2% | Order Service down 30 s.

| Step | What happens |
|---|---|
| 1 | 10,000 requests arrive; gateway throttles, ~9,900 rejected fast (`409`/`429`) via cheap Redis calls |
| 2 | 100 users win the gate and get reservations (5 min hold) |
| 3 | ~200 duplicates return the same stored response; no extra reservation |
| 4 | 95 payments succeed -> 95 `PaymentSucceeded` events |
| 5 | 5 payments fail -> 5 reservations RELEASED -> stock = 5 -> waiting users can reserve those |
| 6 | Order Service down 30 s: events wait in Kafka; orders created on recovery; reconciliation covers misses |
| 7 | Final: 95 sold, 5 re-sold or still available, never more than 100 sold |
| 8 | At zero stock: Redis returns `SOLD_OUT` instantly; sale page flips to "Sold out" via cache invalidation |

## Traces

- **Successful purchase:** request -> auth -> idempotency -> Redis gate -> SQL reserve -> checkout -> payment SUCCESS -> event -> order CONFIRMED -> notification.
- **Failed payment:** FAILED -> `PaymentFailed` -> reservation RELEASED -> Redis +1, SQL available +1 -> customer told to retry.
- **Duplicate Buy:** same `Idempotency-Key` -> Redis NX fails -> stored first response returned.
- **Paid, Order Service down:** outbox -> Kafka -> retry -> reconciliation.
- **Inventory zero:** Lua returns 0 -> `409 OUT_OF_STOCK`, no DB access.

## What changes at 50x traffic (500,000 req/sec)

| Layer | Change |
|---|---|
| CDN | Almost everything edge-cached; stock status with short TTL |
| Gateway | Autoscale pods; per-IP/per-user limits; virtual waiting room admits users in batches |
| Redis | Shard by product/sale; gateway keeps in-memory "sold out" flag to reject without calling Redis |
| Kafka | More partitions keyed by `reservation_id` |
| DB | Only winners write, so load stays small; read replicas; partition by product |
| Likely bottleneck | Hot Redis key and payment gateway; solved by sold-out short-circuit and starting payments only for ~100 holders |

## Failure recovery

| Failure | Recovery |
|---|---|
| Redis down | Fall back to SQL conditional update (slower, still correct) behind stricter rate limit; rebuild Redis counter from SQL |
| DB primary down | Failover to synchronous replica; reservations return `503 retry` meanwhile; no oversell since only committed rows count; outbox resumes |
| Payment gateway down | Circuit breaker opens; reservations extended once; retries with same idempotency key; webhook reconciliation |
| Kafka down | Outbox table retains events; relay resumes |
| Service pod crash | Stateless pods, LB health checks, autoscaling |
| Poison message | Retry x5 -> Dead Letter Queue -> alert -> fix or replay |

## Trade-offs accepted

- Correctness over availability on the buy path: some users see "try again".
- Redis + SQL is more complex than SQL alone (two systems to reconcile).
- Async orders mean a short delay before confirmation shows.
- Reservation holds lock stock for up to 5 minutes.
