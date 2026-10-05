# API and Event Design

All APIs use HTTPS and `Authorization: Bearer <JWT>`.

## REST APIs

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/v1/sales/{saleId}` | - | 200 sale + stock status (cached) | 404 |
| POST | `/v1/cart/items` | `{productId, qty}` | 201 | 400, 401 |
| POST | `/v1/reservations` | Header `Idempotency-Key`; `{productId, qty}` | 201 `{reservationId, expiresAt}`; 200 on replay | 409 OUT_OF_STOCK, 409 ALREADY_RESERVED, 429, 401 |
| POST | `/v1/checkout` | Header `Idempotency-Key`; `{reservationId, paymentMethod}` | 202 `{paymentId, status}` | 410 RESERVATION_EXPIRED, 402 PAYMENT_FAILED, 503 |
| GET | `/v1/payments/{paymentId}` | - | 200 status | 404 |
| GET | `/v1/orders/{orderId}` | - | 200 order + state | 404 |
| POST | `/v1/orders/{orderId}/cancel` | `{reason}` | 202 | 409 INVALID_STATE |
| POST | `/v1/webhooks/payment` | gateway payload + signature | 200 | 401 bad signature |

Error body: `{ "code": "OUT_OF_STOCK", "message": "...", "traceId": "..." }`

## Events

| Event | Producer | Consumers | Action |
|---|---|---|---|
| `StockReserved` | Inventory | Checkout, Analytics | Start checkout timer |
| `ReservationExpired` | Inventory | Cart, Notification | Tell customer |
| `PaymentSucceeded` | Payment | Order, Inventory, Notification | Create order, confirm reservation |
| `PaymentFailed` | Payment | Inventory, Notification | Release stock |
| `OrderCreated` | Order | Shipment, Notification | Start fulfilment |
| `OrderShipped` / `OrderDelivered` | Shipment | Order, Notification | Update state, notify |
| `OrderCancelled` | Order | Payment (refund), Inventory (restock) | Compensate |

Commands: `ReserveStock`, `ProcessPayment`, `CreateOrder`, `RefundPayment`. Every consumer is idempotent (dedupe by `event_id`).
