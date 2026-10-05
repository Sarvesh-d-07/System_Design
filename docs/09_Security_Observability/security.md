# Security Design

| Area | Design |
|---|---|
| Authentication / Authorization | OAuth2/JWT, short-lived tokens, RBAC for admin APIs, users access only their own cart/orders |
| Transport | HTTPS/TLS 1.2+, mTLS between services |
| Rate limiting / abuse | Per-user, per-IP, per-device limits at gateway; WAF bot rules; CAPTCHA on Buy; one reservation per customer per sale |
| Input validation | Schema validation at gateway and services; parameterised SQL |
| Payment data | Card details go directly to the gateway (tokenised / hosted fields); we store only token and `payment_ref` |
| Audit logging | Append-only `AUDIT_LOG` for reservation, payment, order changes |
| Secrets | Vault/KMS; none in code or images; key rotation |
| Webhook safety | Verify gateway signature; replay protection |
