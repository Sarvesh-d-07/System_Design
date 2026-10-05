import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import ArchitectureDiagram from "./ArchitectureDiagram";

/* ---------- Domain model ---------- */
type Params = { users: number; inventory: number; lb: number; gw: number; mq: number; db: number };
type Tick = { t: number; throughput: number; latency: number; backlog: number; contention: number; remaining: number };
type StageKey = "lb" | "gw" | "order" | "db";

const DEFAULTS: Params = { users: 10_000, inventory: 100, lb: 2, gw: 4, mq: 4, db: 2 };
// Per-unit capacity in requests/sec (mocked)
const CAP = { lb: 100_000, gw: 30_000, mq: 5_000, db: 10_000 };
const BASE_MS: Record<StageKey, number> = { lb: 2, gw: 8, order: 15, db: 10 };
const RPS_PER_USER = 1.5;
const ORDER_SHARE = 0.2;
const TICKS = 60;

function simulate(p: Params) {
  const series: Tick[] = [];
  const peak: Record<StageKey, number> = { lb: 0, gw: 0, order: 0, db: 0 };
  let backlog = 0;
  let sold = 0;
  for (let t = 0; t < TICKS; t++) {
    const active = p.users * Math.min(1, (t + 1) / 15); // ramp, then hold peak
    const rps = active * RPS_PER_USER;
    const capLb = p.lb * CAP.lb, capGw = p.gw * CAP.gw;
    const capQ = p.mq * CAP.mq, capDb = p.db * CAP.db;
    const admitted = Math.min(rps, capLb, capGw);
    const orders = admitted * ORDER_SHARE;
    const consume = Math.min(capQ, capDb);
    backlog = Math.max(0, backlog + orders - consume);
    const processed = Math.min(orders, consume);
    const remaining = Math.max(0, p.inventory - sold);
    sold += Math.min(remaining, processed * 0.002);

    const util: Record<StageKey, number> = {
      lb: rps / capLb, gw: rps / capGw, order: orders / capQ, db: orders / capDb,
    };
    (Object.keys(util) as StageKey[]).forEach((k) => (peak[k] = Math.max(peak[k], util[k])));
    // latency = base * (1 + 4 * util^2) per stage, plus queue wait
    const stageMs = (Object.keys(util) as StageKey[]).reduce(
      (s, k) => s + BASE_MS[k] * (1 + 4 * Math.min(util[k], 2.5) ** 2), 0);
    const queueWait = consume > 0 ? (backlog / consume) * 1000 : 0;
    const latency = Math.min(9_999, stageMs + queueWait);
    // contention ~ active users per remaining unit, eased by queue partitions
    const pressure = (active * 0.02) / (Math.max(remaining, 1) * Math.sqrt(p.mq));
    const contention = Math.min(99, 100 * (1 - 1 / (1 + pressure)));
    series.push({ t, throughput: Math.round(admitted), latency: Math.round(latency),
      backlog: Math.round(backlog), contention: +contention.toFixed(1), remaining: Math.round(remaining) });
  }
  return { series, peak, sold: Math.round(sold) };
}

/* ---------- UI primitives (Astryx-style: small, composable, token-driven) ---------- */
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${n}`);

function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-slate-200 bg-white rounded-sm avoid-break">
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-slate-500">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const { label, value, min, max, step = 1, onChange } = props;
  return (
    <label className="block">
      <div className="flex justify-between text-sm text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-mono text-slate-900">{value.toLocaleString()}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-sky-500 cursor-pointer" />
    </label>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="border border-slate-200 bg-white rounded-sm px-4 py-3">
      <div className="text-[13px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-3xl font-semibold text-sky-600 font-mono leading-tight">
        {value}<span className="text-sm text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function Badge({ util }: { util: number }) {
  if (util >= 1) return <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-sm">SATURATED</span>;
  if (util >= 0.8) return <span className="text-xs px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded-sm">NEAR LIMIT</span>;
  return <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-sm">HEALTHY</span>;
}

function Chart({ children, data, unit }: { children: ReactNode; data: Tick[]; unit?: string }) {
  void data; void unit;
  return <div className="h-48">{children}</div>;
}

const axis = { stroke: "#94a3b8", fontSize: 12, tickLine: false } as const;
const tip = { contentStyle: { fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 2, boxShadow: "none" } };

/* ---------- Dashboard ---------- */
export default function App() {
  const [p, setP] = useState<Params>(DEFAULTS);
  const set = (k: keyof Params) => (v: number) => setP((s) => ({ ...s, [k]: v }));
  // sliders update instantly from `p`; the heavy simulation/charts follow `dp` at lower priority
  const dp = useDeferredValue(p);
  const { series, peak, sold } = useMemo(() => simulate(dp), [dp]);
  const last = series[series.length - 1];
  const peakLatency = Math.max(...series.map((s) => s.latency));
  const peakBacklog = Math.max(...series.map((s) => s.backlog));
  const exportPdf = () => {
    // browser print dialog -> "Save as PDF"; vector output, selectable text
    const prev = document.title;
    document.title = "flash-sale-architecture-report";
    window.print();
    document.title = prev;
  };
  const rps = dp.users * RPS_PER_USER;
  const orders = Math.max(...series.map((s) => s.throughput)) * ORDER_SHARE;

  const stages: { key: StageKey; name: string; detail: string }[] = [
    { key: "lb", name: "Load Balancer", detail: `${dp.lb} nodes` },
    { key: "gw", name: "API Gateway", detail: `${dp.gw} instances` },
    { key: "order", name: "Order Service", detail: `${dp.mq} partitions` },
    { key: "db", name: "Database", detail: `${dp.db} replicas` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-5 text-base">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Flash Sale Architecture Simulator</h1>
        <div className="flex gap-2 no-print">
          <button onClick={() => setP(DEFAULTS)}
            className="text-sm px-3 py-1.5 border border-sky-500 text-sky-600 bg-white hover:bg-sky-50 rounded-sm">
            Reset to 10,000 users / 100 units
          </button>
          <button onClick={exportPdf}
            className="text-sm px-3 py-1.5 border border-sky-500 bg-sky-500 text-white hover:bg-sky-600 rounded-sm">
            Export PDF
          </button>
        </div>
      </div>
      <p className="print-only text-sm text-slate-500 mb-4">
        Report generated {new Date().toLocaleString()} · {dp.users.toLocaleString()} users · {dp.inventory} units ·
        {" "}{dp.lb} LB · {dp.gw} gateways · {dp.mq} partitions · {dp.db} replicas
      </p>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <Panel title="Load">
            <div className="space-y-4">
              <Slider label="Concurrent users" value={p.users} min={1_000} max={500_000} step={1_000} onChange={set("users")} />
              <Slider label="Inventory units" value={p.inventory} min={10} max={1_000} step={10} onChange={set("inventory")} />
            </div>
          </Panel>
          <Panel title="Infrastructure">
            <div className="space-y-4">
              <Slider label="Load balancers" value={p.lb} min={1} max={10} onChange={set("lb")} />
              <Slider label="API gateway instances" value={p.gw} min={1} max={30} onChange={set("gw")} />
              <Slider label="Queue partitions" value={p.mq} min={1} max={32} onChange={set("mq")} />
              <Slider label="Database replicas" value={p.db} min={1} max={16} onChange={set("db")} />
            </div>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-9 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Peak latency" value={fmt(peakLatency)} unit="ms" />
            <Stat label="Peak queue backlog" value={fmt(peakBacklog)} unit="msgs" />
            <Stat label="Contention (end)" value={`${last.contention}`} unit="%" />
            <Stat label="Units sold" value={`${sold}`} unit={`/ ${dp.inventory}`} />
          </div>

          <Panel title="System status (peak utilisation)">
            <div className="flex items-stretch gap-2">
              {stages.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div className="flex-1 border border-slate-200 rounded-sm px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge util={peak[s.key]} />
                    </div>
                    <div className="text-[13px] text-slate-500 mb-1">{s.detail} · {Math.round(peak[s.key] * 100)}%</div>
                    <div className="h-1 bg-slate-100">
                      <div className="h-1 bg-sky-500" style={{ width: `${Math.min(100, peak[s.key] * 100)}%` }} />
                    </div>
                  </div>
                  {i < stages.length - 1 && <span className="text-slate-300">→</span>}
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Panel title="Throughput vs latency">
              <Chart data={series}>
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="t" {...axis} />
                    <YAxis yAxisId="l" {...axis} width={42} tickFormatter={fmt} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={42} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip {...tip} />
                    <Line yAxisId="l" dataKey="throughput" name="req/s" stroke="#94a3b8" dot={false} isAnimationActive={false} strokeWidth={1.5} />
                    <Line yAxisId="r" dataKey="latency" name="latency ms" stroke="#0ea5e9" dot={false} isAnimationActive={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </Chart>
            </Panel>
            <Panel title="Queue backlog">
              <Chart data={series}>
                <ResponsiveContainer>
                  <AreaChart data={series}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="t" {...axis} />
                    <YAxis {...axis} width={42} tickFormatter={fmt} />
                    <Tooltip {...tip} />
                    <Area dataKey="backlog" name="messages" stroke="#0ea5e9" fill="#e0f2fe" isAnimationActive={false} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </Chart>
            </Panel>
            <Panel title="Inventory contention rate">
              <Chart data={series}>
                <ResponsiveContainer>
                  <AreaChart data={series}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="t" {...axis} />
                    <YAxis {...axis} width={42} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip {...tip} />
                    <Area dataKey="contention" name="retries/failures %" stroke="#3b82f6" fill="#dbeafe" isAnimationActive={false} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </Chart>
            </Panel>
          </div>
          <p className="text-[13px] text-slate-400">
            Mocked model: 60 one-second ticks, traffic ramps for 15s then holds. latency = Σ base·(1 + 4·util²) + queue wait.
          </p>
        </div>
      </div>

      <div className="mt-4 page-break">
        <Panel title="Architecture diagram (live, reflects current sliders)">
          <div className="diagram-wrap max-w-4xl mx-auto"><ArchitectureDiagram params={dp} peak={peak} rps={rps} orders={orders}
            backlog={peakBacklog} remaining={last.remaining} contention={last.contention} /></div>
        </Panel>
      </div>
    </div>
  );
}
