# System Context and Request Path

```
 Customer (Web/Mobile)          Admin/Ops
        |                            |
        v                            v
 +---------------------------------------------+
 |              FLASH SALE PLATFORM            |
 +---------------------------------------------+
     |             |               |
     v             v               v
 Payment       Delivery        SMS/Email/Push
 Gateway       Partner API     Provider
 (external)    (external)      (external)
```

## Request path

```
Users -> CDN/WAF -> Load Balancer -> API Gateway
      -> Product / Cart / Sale Service
      -> Inventory & Reservation Service
      -> Checkout -> Payment -> Order
      -> Shipment / Notification
```

Supporting infrastructure: Redis (cache, idempotency, stock gate), Kafka (events), SQL cluster (source of truth), Prometheus/Grafana/ELK/Jaeger (observability).
