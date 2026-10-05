# AI Usage Note

- **Tools used:** (fill in, e.g. Claude) for drafting documentation structure, Mermaid diagram text and an optional simulation script.
- **Design first:** requirements, architecture, concurrency strategy, payment/order states and trade-offs were decided by the team before using AI for artefacts.
- **Validation:** generated diagrams and code were reviewed and corrected by the team.
- **Ownership:** every team member can explain every artefact.

## Optional simulation idea

A small script (Python threads or Locust) that fires 10,000 concurrent reserve requests at a mock service with 100 units and asserts: reservations == 100, sold never above 100, duplicates return the same result, expired reservations are released.
