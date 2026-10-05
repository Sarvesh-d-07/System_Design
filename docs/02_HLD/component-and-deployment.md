# Component and Deployment Diagrams

## Component diagram: Inventory & Reservation Service

```
 ReservationController
        |
 ReservationService  --uses-->  IdempotencyStore (Redis)
        |
        +--> StockGate (Redis Lua script)      <- fast atomic decrement
        +--> InventoryRepository (SQL)         <- authoritative record
        +--> ReservationRepository (SQL)
        +--> EventPublisher (Outbox -> Kafka)
 ExpiryWorker --> ReservationService.release()
```

## Deployment diagram

```
 Region (multi-AZ)
  [CDN/WAF edge]
        |
  [L7 Load Balancer]  (AZ-a, AZ-b, AZ-c)
        |
  [API Gateway x N pods]  --  autoscaling (Kubernetes HPA)
        |
  [Service pods: Product, Cart, Inventory, Checkout, Payment, Order ...]
        |
  [Redis Cluster: 3 shards + replicas]   [Kafka: 3 brokers, RF=3]
  [SQL primary + 2 replicas (sync to 1)] [Prometheus, Grafana, ELK, Jaeger]
```
