# Flash Sale Architecture Simulator

Single-page dashboard (React + Vite + TypeScript + Tailwind v4 + Recharts) showing how a
high-concurrency e-commerce stack scales and degrades. Client-side mocked math only, no backend.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

## Model (all in `src/App.tsx`, `simulate()`)
- 60 one-second ticks; traffic ramps for 15 s, then holds at peak. Default: 10,000 users, 100 units.
- Requests/sec = users x 1.5. 20% of admitted requests become order messages.
- Admitted = min(rps, LB capacity, Gateway capacity). Consumption = min(queue partitions, DB replicas).
- Backlog grows when order arrivals exceed consumption.
- Latency = sum over stages of base x (1 + 4 x util^2), plus queue wait (backlog / consumption).
- Contention % = 100 x (1 - 1 / (1 + pressure)), pressure = active users x 0.02 / (remaining units x sqrt(partitions)).
- Per-unit capacity (req/s): LB 100k, Gateway 30k, Queue partition 5k, DB replica 10k. Tune in `CAP`.

## Demo tips
- Defaults are healthy (all stages < 20%).
- ~80k users on 4 gateways saturates the API Gateway; ~100k users saturates queue + DB, so backlog and latency spike.
- 500k users needs roughly max sliders (10 LB / 30 GW / 32 partitions / 16 replicas) to stay healthy.

## Architecture diagram (`src/ArchitectureDiagram.tsx`)
Rendered below the dashboard (top-to-bottom flow) as inline SVG and driven by the same simulation state:
- Node counts follow the sliders (LB nodes, gateway instances, queue partitions, DB replicas); long lists collapse to a "+N more" chip.
- Each group shows peak utilisation with a Healthy / Near limit / Saturated badge.
- Arrows: solid = synchronous request, dashed = asynchronous message, slate = database operation. Edge width scales with load and turns dark blue when that path is at or over capacity. Rates (req/s, msgs/s) are computed from the simulation.
- Only components already in the model are drawn (no cache or monitoring tier exists in the simulation, so none is shown).

## Export PDF
The **Export PDF** button opens the browser print dialog (A4 landscape, backgrounds on); choose *Save as PDF*.
Controls are hidden, a report header with the current parameters is added, and the diagram starts on its own page.

## Slider smoothness
Sliders update from immediate state; the simulation, charts and diagram follow via `useDeferredValue`, and chart animations are off.
