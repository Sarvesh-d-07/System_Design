# Observability Design

| Category | What we measure |
|---|---|
| Metrics | Request rate, p50/p95/p99 latency, error rate, reservation success/fail, payment success/failure rate, order conversion, queue lag, DLQ size, Redis vs SQL stock difference |
| Logs | Structured JSON: `traceId, userId, reservationId, paymentId, orderId, event, status, timestamp` |
| Tracing | Trace ID passed from gateway through reservation, checkout, payment, order and Kafka headers (OpenTelemetry + Jaeger) |
| Alerts | Inventory inconsistency (sold + reserved > total, or Redis != SQL), payment failure rate > 10%, Kafka consumer lag > 60 s, DLQ not empty, circuit breaker open, expired-reservation backlog |
