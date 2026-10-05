# Class Diagram (Inventory, Payment, Order)

```mermaid
classDiagram
  class ReservationService {
    +reserve(ReserveCommand) ReservationResult
    +confirm(reservationId)
    +release(reservationId, reason)
  }
  class StockGate { <<interface>>
    +tryDecrement(productId, qty) bool
    +increment(productId, qty) }
  class RedisStockGate
  class InventoryRepository { <<interface>>
    +conditionalReserve(productId, qty) bool }
  class ReservationRepository { <<interface>> }
  class IdempotencyStore { <<interface>>
    +putIfAbsent(key) Optional }
  class PaymentService {
    +pay(PaymentRequest) PaymentResult
  }
  class PaymentProvider { <<interface>>
    +charge(req) ProviderResult
    +status(ref) ProviderResult }
  class RazorpayAdapter
  class StripeAdapter
  class PaymentProviderFactory
  class CircuitBreaker
  class OrderService {
    +createOrder(PaymentSucceeded)
    +transition(orderId, event)
  }
  class OrderState { <<interface>>
    +next(event) OrderState }
  class CheckoutFacade {
    +checkout(cmd)
  }
  ReservationService --> StockGate
  ReservationService --> InventoryRepository
  ReservationService --> ReservationRepository
  ReservationService --> IdempotencyStore
  RedisStockGate ..|> StockGate
  PaymentService --> PaymentProvider
  PaymentService --> PaymentProviderFactory
  PaymentService --> CircuitBreaker
  RazorpayAdapter ..|> PaymentProvider
  StripeAdapter ..|> PaymentProvider
  OrderService --> OrderState
  CheckoutFacade --> ReservationService
  CheckoutFacade --> PaymentService
  CheckoutFacade --> OrderService
```

## Where validation, idempotency and error handling live

- **Validation:** API Gateway (schema, auth) and service entry points (sale active, per-user limit).
- **Idempotency:** Reservation (idempotency key + UNIQUE constraint), Payment (key + `payment_ref`), Order consumer (UNIQUE `reservation_id`).
- **Error handling:** domain exceptions mapped to HTTP codes at controllers; retries and DLQ at message consumers.
