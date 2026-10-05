# Payment and Order Reliability

## Payment scenarios

| Scenario | Design response |
|---|---|
| Payment succeeds | Payment row SUCCESS -> reservation CONFIRMED -> `PaymentSucceeded` -> Order Service creates order |
| Payment fails | Payment row FAILED -> `PaymentFailed` -> reservation RELEASED -> stock returned -> customer notified |
| Payment times out | Mark `UNKNOWN`; do not release yet. Query gateway by our `payment_ref`, retry with the same idempotency key, reconcile until final; release only when reservation expires and gateway confirms no charge |
| Duplicate payment request | `UNIQUE(idempotency_key)` + same `payment_ref` to gateway -> existing result returned, charged once |
| Payment succeeds, Order Service down | See below |

## Gateway call rules

- **Timeout:** 5 seconds.
- **Retry:** up to 3 times, exponential backoff + jitter, same idempotency key.
- **Circuit breaker:** open at 50% failures in 20 calls; half-open probe after 30 s. While open, return "payment temporarily unavailable" and extend the reservation once (bounded).
- **Webhook:** gateway webhook is the source of truth for late results; handler is idempotent and signature-verified.

## Payment success, then Order Service fails (30 s outage)

1. Payment Service commits `SUCCESS` and writes `PaymentSucceeded` to the outbox in the same transaction.
2. Outbox relay publishes to Kafka (durable).
3. Order Service is down: message waits in the topic. After recovery it consumes and creates the order. Consumer is idempotent (`UNIQUE(reservation_id)` on ORDER).
4. Repeated failures: retry with backoff, then Dead Letter Queue + alert.
5. Reconciliation worker (every minute) finds SUCCESS payments with no order older than 2 minutes and re-emits the event. If the order truly cannot be created, compensate: refund + release/notify.
6. Customer sees "Payment received, confirming your order".

Result: no paid customer lost, no duplicate order, no charge without an order beyond a few minutes.

## Order lifecycle

```
CREATED -> PAYMENT_PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED
CREATED/PAYMENT_PENDING -> CANCELLED (payment failed/expired)
CONFIRMED/PROCESSING -> CANCELLED (+ refund + stock restore)
```
