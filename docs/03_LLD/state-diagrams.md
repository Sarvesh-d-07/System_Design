# State Diagrams

## Reservation lifecycle

```mermaid
stateDiagram-v2
  [*] --> RESERVED
  RESERVED --> PAYMENT_PENDING
  PAYMENT_PENDING --> CONFIRMED: payment success
  CONFIRMED --> SOLD: order created
  RESERVED --> EXPIRED: timeout
  PAYMENT_PENDING --> PAYMENT_FAILED: payment failed
  PAYMENT_PENDING --> EXPIRED: timeout
  EXPIRED --> RELEASED
  PAYMENT_FAILED --> RELEASED
  SOLD --> [*]
  RELEASED --> [*]
```

| Transition | Trigger | Effect on inventory |
|---|---|---|
| create -> RESERVED | Buy Now wins gate | available -1, reserved +1 |
| RESERVED -> PAYMENT_PENDING | Checkout starts | no change |
| PAYMENT_PENDING -> CONFIRMED | Payment success event | no change yet |
| CONFIRMED -> SOLD | Order created | reserved -1, sold +1 |
| -> RELEASED | Payment failed / expired | reserved -1, available +1, Redis stock +1 |

## Order lifecycle

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> PAYMENT_PENDING
  PAYMENT_PENDING --> CONFIRMED
  CONFIRMED --> PROCESSING
  PROCESSING --> SHIPPED
  SHIPPED --> OUT_FOR_DELIVERY
  OUT_FOR_DELIVERY --> DELIVERED
  CREATED --> CANCELLED
  PAYMENT_PENDING --> CANCELLED
  CONFIRMED --> CANCELLED: refund + restock
  PROCESSING --> CANCELLED: refund + restock
  DELIVERED --> [*]
  CANCELLED --> [*]
```

Only valid transitions are allowed (State pattern). Any other transition throws `IllegalStateTransition` and is audited.
