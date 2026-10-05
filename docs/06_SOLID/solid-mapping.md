# SOLID Mapping

| Principle | Where applied |
|---|---|
| SRP | `ReservationService` only reserves; `PaymentService` only pays; `OrderService` only manages order state; `NotificationService` only notifies |
| OCP | New payment provider = new Adapter + register in factory; new pricing = new `PricingStrategy`. Core checkout code unchanged |
| LSP | `RazorpayAdapter` and `StripeAdapter` honour the same `PaymentProvider` contract (errors, idempotency) so they swap freely |
| ISP | Small interfaces: `StockGate`, `InventoryRepository`, `PaymentProvider`, `NotificationChannel` |
| DIP | `CheckoutFacade` and `PaymentService` depend on interfaces; Redis/SQL/gateway classes are injected |
