import type { ReactNode } from "react";

type StageKey = "lb" | "gw" | "order" | "db";

export type DiagramProps = {
  params: { users: number; inventory: number; lb: number; gw: number; mq: number; db: number };
  peak: Record<StageKey, number>; // peak utilisation per stage (1 = 100%)
  rps: number; // offered requests/sec at peak
  orders: number; // order messages/sec reaching the queue at peak
  backlog: number; // peak queue backlog (messages)
  remaining: number; // inventory left at end of run
  contention: number; // contention % at end of run
};

/* ---------- tokens & layout (top -> bottom) ---------- */
const C = { sync: "#0ea5e9", async: "#3b82f6", db: "#475569", hot: "#1d4ed8", border: "#cbd5e1", text: "#0f172a", muted: "#64748b" };
const W = 1160, H = 1070;
const BX = 40, BW = 1080, BH = 104, INFO = 250; // band geometry
const NX = BX + INFO + 14, NW = 124, NGAP = 10, SLOTS = 6; // node row
const EX = 680; // x of vertical arrows
const ROW = { client: 20, lb: 224, gw: 386, mq: 548, os: 710, db: 872 } as const;
type Row = keyof typeof ROW;

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${Math.round(n)}`);
const state = (u: number) => (u >= 1 ? "sat" : u >= 0.8 ? "near" : "ok");

/* ---------- building blocks ---------- */
function Band(props: { row: Row; title: string; subtitle: string; util?: number; children?: ReactNode }) {
  const { row, title, subtitle, util, children } = props;
  const y = ROW[row];
  const s = util === undefined ? "ok" : state(util);
  const badge = s === "sat" ? { t: "SATURATED", f: C.hot, c: "#fff", w: 84 }
    : s === "near" ? { t: "NEAR LIMIT", f: "#e0f2fe", c: "#0369a1", w: 84 }
    : { t: "HEALTHY", f: "#f1f5f9", c: C.muted, w: 66 };
  return (
    <g>
      <rect x={BX} y={y} width={BW} height={BH} rx={2} fill="#fff" stroke={C.border} />
      <line x1={BX + INFO} x2={BX + INFO} y1={y + 10} y2={y + BH - 10} stroke="#e2e8f0" />
      <rect x={BX + 12} y={y + 12} width={14} height={14} rx={2} fill="#e0f2fe" stroke={C.sync} />
      <text x={BX + 34} y={y + 25} fontSize={15} fontWeight={600} fill={C.text}>{title}</text>
      <text x={BX + 12} y={y + 48} fontSize={12.5} fill={C.muted}>{subtitle}</text>
      {util !== undefined && (
        <g>
          <text x={BX + 12} y={y + 72} fontSize={12.5} fill={C.muted}>peak {Math.round(util * 100)}%</text>
          <rect x={BX + 104} y={y + 59} width={badge.w} height={18} rx={2} fill={badge.f} />
          <text x={BX + 104 + badge.w / 2} y={y + 72} fontSize={10.5} fontWeight={600} fill={badge.c} textAnchor="middle" letterSpacing={0.5}>{badge.t}</text>
          <rect x={BX + 12} y={y + 86} width={INFO - 24} height={4} fill="#f1f5f9" />
          <rect x={BX + 12} y={y + 86} width={Math.min(1, util) * (INFO - 24)} height={4} fill={s === "sat" ? C.hot : C.sync} />
        </g>
      )}
      {children}
    </g>
  );
}

function Nodes(props: { row: Row; count: number; name: (i: number) => string; sub: (i: number) => string; hot: boolean }) {
  const { row, count, name, sub, hot } = props;
  const y = ROW[row] + 20;
  const overflow = count > SLOTS;
  const shown = overflow ? SLOTS - 1 : count;
  const x = (i: number) => NX + i * (NW + NGAP);
  return (
    <g>
      {Array.from({ length: shown }, (_, i) => (
        <g key={i}>
          <rect x={x(i)} y={y} width={NW} height={52} rx={2} fill={hot ? "#eff6ff" : "#f8fafc"} stroke={hot ? C.hot : C.border} />
          <rect x={x(i)} y={y} width={4} height={52} fill={hot ? C.hot : C.sync} />
          <text x={x(i) + 14} y={y + 21} fontSize={14} fontWeight={600} fill={C.text}>{name(i)}</text>
          <text x={x(i) + 14} y={y + 39} fontSize={11.5} fill={C.muted}>{sub(i)}</text>
        </g>
      ))}
      {overflow && (
        <g>
          <rect x={x(shown)} y={y} width={NW} height={52} rx={2} fill="none" stroke={C.border} strokeDasharray="4 3" />
          <text x={x(shown) + NW / 2} y={y + 31} fontSize={14} fontWeight={600} fill={C.muted} textAnchor="middle">+{count - shown} more</text>
        </g>
      )}
    </g>
  );
}

function Note({ row, children }: { row: Row; children: ReactNode }) {
  return <text x={BX + BW - 16} y={ROW[row] + 96} fontSize={13} fill={C.muted} textAnchor="end">{children}</text>;
}

function Edge(props: { from: Row; to: Row; kind: "sync" | "async" | "db"; label: string; rate: number; util: number; labelMid?: number }) {
  const { from, to, kind, label, rate, util } = props;
  const y1 = ROW[from] + BH + 3, y2 = ROW[to] - 3;
  const mid = props.labelMid ?? (y1 + y2) / 2;
  const hot = util >= 1;
  const color = hot ? C.hot : C[kind];
  const tag = kind === "sync" ? "SYNC" : kind === "async" ? "ASYNC" : "SQL";
  return (
    <g>
      <line x1={EX} x2={EX} y1={y1} y2={y2} stroke={color} strokeWidth={1.5 + Math.min(1, util) * 2.5}
        strokeDasharray={kind === "async" ? "7 5" : undefined} markerEnd="url(#arrow)" />
      <text x={EX + 14} y={mid - 2} fontSize={13} fontWeight={600} fill={C.text}>{label}</text>
      <text x={EX + 14} y={mid + 14} fontSize={12} fill={color}>{fmt(rate)}/s</text>
      <text x={EX - 14} y={mid + 6} fontSize={10.5} fontWeight={600} fill={C.muted} textAnchor="end" letterSpacing={0.8}>{tag}</text>
    </g>
  );
}

/* ---------- diagram ---------- */
export default function ArchitectureDiagram({ params: p, peak, rps, orders, backlog, remaining, contention }: DiagramProps) {
  const afterLb = rps / Math.max(1, peak.lb);
  const consumed = orders / Math.max(1, peak.order, peak.db);
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Flash sale system architecture">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 1 L10 5 L0 9 z" fill="context-stroke" />
        </marker>
      </defs>

      {/* platform boundary (everything behind the internet-facing edge) */}
      <rect x={24} y={184} width={1112} height={812} rx={2} fill="#f8fafc" stroke="#94a3b8" strokeDasharray="6 4" />
      <text x={BX} y={208} fontSize={13} fontWeight={600} fill={C.muted} letterSpacing={0.8}>FLASH SALE PLATFORM</text>

      <Band row="client" title="Client / Frontend" subtitle="Traffic source">
        <Nodes row="client" count={1} name={() => "Users"} sub={() => `${p.users.toLocaleString()} users`} hot={false} />
      </Band>
      <Band row="lb" title="Load Balancing" subtitle={plural(p.lb, "node")} util={peak.lb}>
        <Nodes row="lb" count={p.lb} name={(i) => `LB-${i + 1}`} sub={() => "Load Balancer"} hot={peak.lb >= 1} />
      </Band>
      <Band row="gw" title="API Layer" subtitle={plural(p.gw, "instance")} util={peak.gw}>
        <Nodes row="gw" count={p.gw} name={(i) => `Gateway-${i + 1}`} sub={() => "API Gateway"} hot={peak.gw >= 1} />
      </Band>
      <Band row="mq" title="Message Queue" subtitle={plural(p.mq, "partition")} util={peak.order}>
        <Nodes row="mq" count={p.mq} name={(i) => `Partition ${i}`} sub={() => `~${fmt(backlog / p.mq)} backlog`} hot={peak.order >= 1} />
        <Note row="mq">peak backlog <tspan fontWeight={600} fill={C.text}>{fmt(backlog)} msgs</tspan></Note>
      </Band>
      <Band row="os" title="Services" subtitle="Order processing" util={peak.order}>
        <Nodes row="os" count={1} name={() => "Order Service"} sub={() => plural(p.mq, "consumer")} hot={peak.order >= 1} />
        <text x={NX + NW + 16} y={ROW.os + 42} fontSize={13} fill={C.muted}>Consumes order events</text>
        <text x={NX + NW + 16} y={ROW.os + 59} fontSize={13} fill={C.muted}>and reserves inventory</text>
      </Band>
      <Band row="db" title="Database" subtitle={plural(p.db, "replica")} util={peak.db}>
        <Nodes row="db" count={p.db} name={(i) => `DB-${i + 1}`} sub={() => "Replica"} hot={peak.db >= 1} />
        <Note row="db">
          inventory <tspan fontWeight={600} fill={C.text}>{remaining}/{p.inventory}</tspan> · contention <tspan fontWeight={600} fill={C.text}>{contention}%</tspan>
        </Note>
      </Band>

      {/* flows */}
      <Edge from="client" to="lb" kind="sync" label="HTTPS" rate={rps} util={peak.lb} labelMid={154} />
      <Edge from="lb" to="gw" kind="sync" label="REST" rate={afterLb} util={peak.gw} />
      <Edge from="gw" to="mq" kind="async" label="publish order event" rate={orders} util={peak.order} />
      <Edge from="mq" to="os" kind="async" label="consume" rate={consumed} util={peak.order} />
      <Edge from="os" to="db" kind="db" label="inventory transaction" rate={consumed} util={peak.db} />

      {/* legend */}
      {[
        { x: 40, id: "sync", dash: undefined, color: C.sync, text: "Synchronous request" },
        { x: 270, id: "async", dash: "7 5", color: C.async, text: "Asynchronous message / event" },
        { x: 590, id: "db", dash: undefined, color: C.db, text: "Database operation" },
        { x: 830, id: "hot", dash: undefined, color: C.hot, text: "Saturated path (100%+ capacity)" },
      ].map((l) => (
        <g key={l.id}>
          <line x1={l.x} x2={l.x + 40} y1={1030} y2={1030} stroke={l.color} strokeWidth={2.5} strokeDasharray={l.dash} markerEnd="url(#arrow)" />
          <text x={l.x + 52} y={1035} fontSize={13.5} fill={C.text}>{l.text}</text>
        </g>
      ))}
    </svg>
  );
}
