# 5-Minute Pitch Script

| Time | Say this |
|---|---|
| 30 s | **Problem:** flash sale, 10,000 buyers, 100 units. Risks: oversell, double charge, lost orders |
| 30 s | **Requirements:** strict (no oversell, no duplicate charge); targets (500k req/sec, p95 < 200 ms, 99.9% checkout) |
| 60 s | **HLD:** context + container diagram: CDN/WAF, LB, Gateway, services, Redis, SQL, Kafka |
| 60 s | **Critical design:** waiting room, idempotency, Redis Lua gate, SQL conditional update, reservation expiry |
| 45 s | **Payment and order:** idempotent payment, circuit breaker, outbox + Kafka, reconciliation, compensation |
| 45 s | **LLD:** `ReservationService`, `StockGate`, `PaymentProvider` adapter, State pattern for order; one SOLID example |
| 30 s | **Scale and validation:** 50x plan, failure recovery, optional simulation, trade-offs accepted |
