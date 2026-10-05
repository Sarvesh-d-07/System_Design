# Design Pattern Mapping

| Pattern | Used for | Problem solved | Trade-off |
|---|---|---|---|
| Strategy | Pricing (flash, coupon, bulk), delivery partner choice | Swap rules without if/else | More classes |
| Factory | `PaymentProviderFactory` | Create right provider by config | Extra indirection |
| Adapter | Razorpay/Stripe, delivery APIs | One interface over different external APIs | One more layer |
| State | Order and reservation lifecycle | Prevent illegal transitions | Many small state classes |
| Observer / Pub-Sub | `OrderCreated` -> notification, shipment | Loose coupling | Harder to trace (fixed with tracing) |
| Repository | DB access | Services independent of SQL details | Mapping overhead |
| Facade | `CheckoutFacade` | One entry for reserve -> pay -> order | Can become a god class |
| Circuit Breaker | Payment gateway, delivery API | Stops cascading failure | Needs tuning |

## Adding new things with minimal change

- **New payment provider:** write `NewProviderAdapter implements PaymentProvider`, register in the factory.
- **New pricing rule:** add a `PricingStrategy` class.
- **New delivery partner:** add a `DeliveryPartnerAdapter`.
