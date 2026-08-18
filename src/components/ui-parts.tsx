import { cn } from "@/lib/utils";
import { fmtDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Minus,
  PackageSearch,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200/80",
  high: "bg-amber-50 text-amber-700 border-amber-200/80",
  normal: "bg-sky-50 text-sky-700 border-sky-200/80",
  low: "bg-slate-100 text-slate-600 border-slate-200/80",
};

export function PriorityBadge({ value, className }: { value: string; className?: string }) {
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return <Badge variant="outline" className={cn("font-medium capitalize", PRIORITY_STYLES[value] ?? "", className)}>{label}</Badge>;
}

const STATUS_STYLES: Record<string, string> = {
  created: "bg-slate-100 text-slate-600 border-slate-200/80",
  confirmed: "bg-sky-50 text-sky-700 border-sky-200/80",
  allocated: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  picking: "bg-blue-50 text-blue-700 border-blue-200/80",
  packing: "bg-violet-50 text-violet-700 border-violet-200/80",
  quality_check: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  dispatched: "bg-teal-50 text-teal-700 border-teal-200/80",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300/70",
  exception: "bg-red-50 text-red-700 border-red-200/80",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200/80",
};

export const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  confirmed: "Confirmed",
  allocated: "Allocated",
  picking: "Picking",
  packing: "Packing",
  quality_check: "Quality Check",
  ready: "Ready to Dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  exception: "Exception",
  cancelled: "Cancelled",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[value] ?? "", className)}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[value] ?? value}
    </Badge>
  );
}

const RISK_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200/80",
  high: "bg-amber-50 text-amber-700 border-amber-200/80",
  medium: "bg-orange-50 text-orange-600 border-orange-200/80",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
};

export function RiskBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", RISK_STYLES[value] ?? "", className)}>
      {value}
    </Badge>
  );
}

const INV_STYLES: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  low_stock: "bg-amber-50 text-amber-700 border-amber-200/80",
  critical: "bg-red-50 text-red-700 border-red-200/80",
  out_of_stock: "bg-red-100 text-red-800 border-red-300/70",
  overstock: "bg-sky-50 text-sky-700 border-sky-200/80",
  damaged: "bg-rose-50 text-rose-700 border-rose-200/80",
};

export const INV_LABELS: Record<string, string> = {
  healthy: "Healthy",
  low_stock: "Low Stock",
  critical: "Critical",
  out_of_stock: "Out of Stock",
  overstock: "Overstock",
  damaged: "Damaged",
};

export function InvStatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", INV_STYLES[value] ?? "", className)}>
      {INV_LABELS[value] ?? value}
    </Badge>
  );
}

const TASK_STYLES: Record<string, string> = {
  waiting: "bg-slate-100 text-slate-600 border-slate-200/80",
  assigned: "bg-sky-50 text-sky-700 border-sky-200/80",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200/80",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  blocked: "bg-red-50 text-red-700 border-red-200/80",
  packing: "bg-violet-50 text-violet-700 border-violet-200/80",
  packed: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
  qc_required: "bg-amber-50 text-amber-700 border-amber-200/80",
  failed_qc: "bg-red-50 text-red-700 border-red-200/80",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
};

export const TASK_LABELS: Record<string, string> = {
  waiting: "Waiting",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
  packing: "Packing",
  packed: "Packed",
  qc_required: "QC Required",
  failed_qc: "Failed QC",
  ready: "Ready",
};

export function TaskStatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TASK_STYLES[value] ?? "", className)}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current opacity-70" />
      {TASK_LABELS[value] ?? value}
    </Badge>
  );
}

const SHIP_STYLES: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  processing: "bg-sky-50 text-sky-700 border-sky-200/80",
  dispatched: "bg-blue-50 text-blue-700 border-blue-200/80",
  delayed: "bg-red-50 text-red-700 border-red-200/80",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300/70",
};

export function ShipStatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", SHIP_STYLES[value] ?? "", className)}>
      {value}
    </Badge>
  );
}

const EXC_STATUS_STYLES: Record<string, string> = {
  open: "bg-slate-100 text-slate-600 border-slate-200/80",
  investigating: "bg-sky-50 text-sky-700 border-sky-200/80",
  action_required: "bg-amber-50 text-amber-700 border-amber-200/80",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  escalated: "bg-red-50 text-red-700 border-red-200/80",
};

export const EXC_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  investigating: "Investigating",
  action_required: "Action Required",
  resolved: "Resolved",
  escalated: "Escalated",
};

export function ExcStatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", EXC_STATUS_STYLES[value] ?? "", className)}>
      {EXC_STATUS_LABELS[value] ?? value}
    </Badge>
  );
}

const EXC_TYPE_LABELS: Record<string, string> = {
  damaged: "Damaged Item",
  missing: "Missing Item",
  mismatch: "Inventory Mismatch",
  picking_delay: "Picking Delay",
  packing_error: "Packing Error",
  qc_failure: "QC Failure",
  dispatch_delay: "Dispatch Delay",
  stockout: "Stockout",
  sla_risk: "SLA Risk",
};

export function ExcTypeBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    damaged: "bg-rose-50 text-rose-700 border-rose-200/80",
    missing: "bg-amber-50 text-amber-700 border-amber-200/80",
    mismatch: "bg-orange-50 text-orange-600 border-orange-200/80",
    picking_delay: "bg-blue-50 text-blue-700 border-blue-200/80",
    packing_error: "bg-violet-50 text-violet-700 border-violet-200/80",
    qc_failure: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
    dispatch_delay: "bg-teal-50 text-teal-700 border-teal-200/80",
    stockout: "bg-red-50 text-red-700 border-red-200/80",
    sla_risk: "bg-amber-50 text-amber-700 border-amber-200/80",
  };
  return <Badge variant="outline" className={cn("font-medium", colors[value] ?? "")}>{EXC_TYPE_LABELS[value] ?? value}</Badge>;
}

export function SeverityDot({ value }: { value: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-amber-500",
    medium: "bg-orange-400",
    low: "bg-emerald-500",
    info: "bg-sky-400",
  };
  return <span className={cn("inline-block size-1.5 rounded-full", styles[value] ?? "bg-slate-400")} />;
}

// ---------------------------------------------------------------------------
// Panels + headers
// ---------------------------------------------------------------------------

export function GlassPanel({ className, children, strong }: { className?: string; children: ReactNode; strong?: boolean }) {
  return <div className={cn(strong ? "glass-panel-strong" : "glass-panel", "rounded-2xl", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: LucideIcon }) {
  const Icon = icon;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="glass-chip mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-primary shadow-sm">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: LucideIcon; title: string; message?: string; action?: ReactNode }) {
  const Icon = icon ?? PackageSearch;
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="glass-chip flex size-12 items-center justify-center rounded-2xl text-slate-400">
        <Icon className="size-6" />
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-700">{title}</p>
      {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

export interface KpiData {
  key: string;
  label: string;
  value: number;
  display: string;
  delta: number;
  deltaLabel: string;
  trend: "up" | "down";
  good: boolean;
  hint: string;
}

export function KpiCard({ kpi, icon }: { kpi: KpiData; icon?: LucideIcon }) {
  const Icon = icon;
  const deltaIsPct = kpi.key === "orders_today";
  const deltaText = deltaIsPct
    ? `${kpi.delta >= 0 ? "+" : ""}${kpi.delta}%`
    : `${kpi.delta >= 0 ? "+" : ""}${kpi.delta}`;
  const TrendIcon = kpi.trend === "up" ? ArrowUpRight : kpi.trend === "down" ? ArrowDownRight : Minus;
  return (
    <div className="glass-panel group relative overflow-hidden rounded-2xl p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</p>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-lg bg-white/60 text-primary/70 ring-1 ring-white/70">
            <Icon className="size-3.5" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{kpi.display}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
            kpi.good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
          )}
        >
          <TrendIcon className="size-3" />
          {deltaText}
        </span>
        <span className="text-[11px] text-muted-foreground">{kpi.deltaLabel}</span>
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{kpi.hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Priority score ring
// ---------------------------------------------------------------------------

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = clamped >= 75 ? "stroke-emerald-500" : clamped >= 50 ? "stroke-sky-500" : clamped >= 30 ? "stroke-amber-500" : "stroke-red-500";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(0.9 0.02 240 / 0.6)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-slate-800">{clamped}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fulfillment tracker
// ---------------------------------------------------------------------------

export const FULFILLMENT_STAGES = ["Created", "Allocated", "Picking", "Packing", "QC", "Dispatch", "Delivered"];

export function FulfillmentTracker({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-1">
      {FULFILLMENT_STAGES.map((label, i) => {
        const done = i <= stage;
        const current = i === stage;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <div className={cn("h-0.5 flex-1 rounded-full", i === 0 ? "opacity-0" : done ? "bg-sky-500/70" : "bg-slate-200")} />
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done ? "border-sky-500 bg-sky-500 text-white" : current ? "border-sky-400 bg-white text-sky-500" : "border-slate-200 bg-white text-slate-300",
                )}
              >
                {done && i < FULFILLMENT_STAGES.length - 1 ? <CheckCircle2 className="size-3" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
              </div>
              <div className={cn("h-0.5 flex-1 rounded-full", i === FULFILLMENT_STAGES.length - 1 ? "opacity-0" : done ? "bg-sky-500/70" : "bg-slate-200")} />
            </div>
            <span className={cn("text-[10px] font-medium", done ? "text-slate-700" : "text-slate-400")}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small widgets
// ---------------------------------------------------------------------------

export function StatusPill({ children, tone }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "info" }) {
  const styles = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    warn: "bg-amber-50 text-amber-700 border-amber-200/80",
    bad: "bg-red-50 text-red-700 border-red-200/80",
    info: "bg-sky-50 text-sky-700 border-sky-200/80",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", styles[tone ?? "info"])}>{children}</span>;
}

export function LiveDot({ color = "bg-emerald-500" }: { color?: string }) {
  return (
    <span className="relative flex size-2">
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

export function SlaChip({ minsLeft }: { minsLeft: number }) {
  const overdue = minsLeft < 0;
  const urgent = minsLeft >= 0 && minsLeft <= 180;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        overdue ? "border-red-200 bg-red-50 text-red-700" : urgent ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {overdue ? "SLA breached" : `${fmtDuration(minsLeft)} left`}
    </span>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="glass-panel flex items-center justify-center gap-3 rounded-2xl px-6 py-16 text-sm text-muted-foreground">
      <span className="size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      {label}
    </div>
  );
}

export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export { Button };
