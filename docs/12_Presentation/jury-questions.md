# Jury Questions: Ready Answers

| Question | Short answer |
|---|---|
| Why this service boundary? | Inventory owns stock consistency, Payment owns money, Order owns lifecycle; each scales and fails independently |
| Where exactly is inventory consistency guaranteed? | Redis Lua script (fast, serialized) and SQL `UPDATE ... WHERE available_quantity >= 1` with CHECK constraints (final truth) |
| Two requests hit inventory at the same time? | Lua serializes them; one decrements, the other sees the updated value. SQL guard repeats the same rule |
| Why this concurrency strategy? | Pessimistic locks queue everything on one row; optimistic locks cause retry storms. Atomic gate + conditional update has neither problem |
| Why sync here, async there? | Sync where the user needs an instant answer (reserve). Async where failure must not block or lose work (order, shipment, notification) |
| Payment success but order fails? | Outbox -> Kafka -> retry -> DLQ -> reconciliation worker -> refund compensation if truly impossible |
| Likely bottleneck? | Hot Redis key and payment gateway; solved with sharding, sold-out short-circuit at the gateway, and starting payments only for ~100 holders |

## Final question: walk through 10,000 clicks on 100 units

10,000 requests hit CDN/WAF, then LB, then the gateway, which rate-limits and admits through a waiting room. Each request is deduplicated by idempotency key, then hits one atomic Redis decrement. Exactly 100 win; the other 9,900 get an instant out-of-stock. The 100 winners get a durable reservation in SQL with a 5-minute expiry. They pay with an idempotent payment call. About 95 succeed, an event creates their orders (retried if Order Service is down), and the 5 failures are released back to stock. The database rules `available >= 0` and `available + reserved + sold = total` make overselling impossible even if Redis fails.
