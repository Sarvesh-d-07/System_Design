# Requirements and Assumptions

## Functional requirements

| ID | Requirement |
|---|---|
| FR1 | Customers browse products and sale pages (read-heavy, cacheable) |
| FR2 | Customers add items to a cart |
| FR3 | "Buy Now" creates a temporary inventory reservation with expiry |
| FR4 | Checkout takes payment for a valid reservation only |
| FR5 | Successful payment creates exactly one order |
| FR6 | Failed or expired reservations release stock back |
| FR7 | Order moves through fulfilment, shipment and delivery with notifications |
| FR8 | Duplicate requests never create duplicate reservations, payments or orders |

## Non-functional requirements

| Area | Target | Type |
|---|---|---|
| Overselling | Sold units never exceed stock (100) | Strict guarantee |
| Duplicate payment/order | Zero | Strict guarantee |
| Normal traffic | ~10,000 req/sec | Target |
| Flash-sale peak | Reason up to 500,000 req/sec | Target |
| Reservation API latency | p95 < 200 ms | Target |
| Availability (browse) | 99.95% | Target |
| Availability (checkout) | 99.9%, correctness over availability | Target |
| Reservation expiry | 5 minutes (configurable) | Config |
| Recovery | Payment/order mismatch reconciled within 5 minutes | Target |
| Security | HTTPS, JWT, rate limits, no card data stored | Strict |

## Assumptions

- Stock = 100 units, concurrent users = 10,000, max 1 unit per customer for the sale item.
- Payment gateway is external (Razorpay/Stripe style) and supports idempotency keys and webhooks.
- Payment success 95%, failure 5%, duplicate requests 2% (about 200).
- Order Service may be down for 30 seconds; no data may be lost.
- Customers are authenticated before clicking Buy Now.

## Strict vs target

Correctness (no oversell, no duplicate charge) is never traded away. Latency and availability of the buy path may degrade ("try again", waiting room) to protect correctness. This is a CP choice for inventory.
