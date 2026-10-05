# Synchronous vs Asynchronous Communication

| Step | Mode | Why |
|---|---|---|
| Buy Now -> reservation | Sync | User needs instant yes/no; correctness is decided here |
| Payment call to gateway | Sync with timeout + async webhook | Customer waits, webhook is the safety net |
| Order creation after payment | Async (event) | Order Service downtime must not lose a paid order |
| Shipment, notification | Async | Not on the critical path; retry freely |
| Reservation expiry | Background | Time-driven, not request-driven |
