# Concurrency and Inventory Design

## Flow: 10,000 users, 100 units

1. **Edge:** CDN serves the sale page. WAF blocks bots. Load balancer spreads traffic.
2. **API Gateway:** validates JWT, applies per-user rate limit (e.g. 5 req / 10 s) and a global sale throttle. Excess gets `429`.
3. **Admission control (waiting room):** requests above a configured concurrency are queued or told "high demand, retrying". This is where traffic is throttled and queued.
4. **Idempotency check:** `SET idem:{userId}:{saleId}:{key} NX EX 300`. If the key exists, return the stored result of the first request.
5. **Stock gate (contention point):** one atomic Redis Lua script on `stock:{productId}`.
   - stock >= 1: decrement, record reservation, return OK.
   - else: return `SOLD_OUT`.
   Redis serializes the script per shard, so exactly 100 calls can succeed.
6. **Durable write:** winners only (~100) write `INVENTORY_RESERVATION` (RESERVED, `expires_at = now + 5 min`) and update `INVENTORY` in one SQL transaction.
7. **Response:** winners get `201 reservation_id + expires_at`; losers get `409 OUT_OF_STOCK`.

Contention is controlled at two points: the Redis Lua script (fast path) and the SQL conditional update (final guard). Even a Redis failure cannot oversell.

## SQL final guard

```sql
BEGIN;
UPDATE inventory
   SET available_quantity = available_quantity - 1,
       reserved_quantity  = reserved_quantity + 1,
       version = version + 1, updated_at = NOW()
 WHERE product_id = :pid AND available_quantity >= 1;   -- rows affected must be 1
INSERT INTO inventory_reservation(reservation_id, product_id, customer_id,
       quantity, status, expires_at, idempotency_key)
 VALUES (:rid, :pid, :cid, 1, 'RESERVED', NOW() + INTERVAL 5 MINUTE, :key);
COMMIT;
-- rows affected = 0 -> ROLLBACK, return OUT_OF_STOCK
```

Schema guards: `CHECK (available_quantity >= 0)`, `CHECK (available + reserved + sold = total)`, `UNIQUE (idempotency_key)`.

## Concurrency approaches compared

| Approach | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| Pessimistic lock (`SELECT ... FOR UPDATE`) | Lock inventory row per request | Simple, correct | 10,000 requests queue on one row, DB collapses | Reject for hot path |
| Optimistic lock (version column) | Update `WHERE version = v`, retry | No long locks | Retry storm under heavy contention | Only for low contention |
| Atomic conditional update | One statement checks + decrements | Correct, no retry loop | Still hits DB per request if used alone | Use as final guard |
| Redis Lua gate | In-memory serialized decrement | ~100k ops/sec per shard, cheap rejects | Not durable, needs reconciliation | Use as fast gate |

**Selected:** Redis Lua gate + SQL conditional update.

## Reservation lifecycle

```
AVAILABLE -> RESERVED -> PAYMENT_PENDING -> CONFIRMED -> SOLD
RESERVED -> PAYMENT_FAILED -> RELEASED
RESERVED -> TIMEOUT/EXPIRED -> RELEASED
```

**Expiry:** `ExpiryWorker` runs every few seconds: select reservations in RESERVED/PAYMENT_PENDING with `expires_at < NOW()` using `FOR UPDATE SKIP LOCKED`, then release. Release is idempotent (acts only if status is still RESERVED/PENDING). A Redis TTL key is a fast backup trigger.

**Why it never exceeds 100:** `available + reserved + sold = total` always holds (DB constraint), every reservation needs a successful decrement of a counter that cannot go below 0, and a released unit is returned exactly once because of the status check.

## Last item scenario

One unit left, users A and B arrive together. The Lua script runs them one after the other: A sees 1 -> 0 and wins; B sees 0 and gets `OUT_OF_STOCK`. If Redis were wrong, B's SQL update affects 0 rows and is rejected.

## Consistency boundaries

- Strong: inventory + reservation (single SQL transaction).
- Eventual: order, shipment, notification, cache views.
- Redis vs SQL drift: reconciliation job recomputes `total - reserved - sold` and fixes the Redis counter; alert on mismatch.
