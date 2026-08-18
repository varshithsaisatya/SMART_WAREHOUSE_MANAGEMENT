import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  KpiCard,
  PageHeader,
  GlassPanel,
  SectionTitle,
  PriorityBadge,
  StatusBadge,
  RiskBadge,
  InvStatusBadge,
  SlaChip,
  ScoreRing,
  LoadingBlock,
  LiveDot,
  SeverityDot,
  EmptyState,
} from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { timeAgo, fmtDuration } from "@/lib/format";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  PackageCheck,
  PackageSearch,
  ShieldAlert,
  Sparkles,
  Split,
  Truck,
  LayoutDashboard,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

const KPI_ICONS: Record<string, LucideIcon> = {
  orders_today: ClipboardList,
  orders_at_risk: ShieldAlert,
  inventory_health: Boxes,
  pending_picking: PackageSearch,
  pending_packing: PackageCheck,
  ready_dispatch: Truck,
  low_stock: AlertTriangle,
  critical_exceptions: AlertTriangle,
};

const FEED_ICONS: Record<string, LucideIcon> = {
  allocation: Split,
  picking: PackageSearch,
  packing: PackageCheck,
  dispatch: Truck,
  exception: AlertTriangle,
  ai: Sparkles,
  system: Activity,
};

const CATEGORY_LABELS: Record<string, string> = {
  order_priority: "Order Priority",
  inventory: "Inventory",
  picking: "Picking",
  replenishment: "Replenishment",
  exception: "Exception",
  dispatch: "Dispatch",
  bottleneck: "Bottleneck",
};

export default function Dashboard() {
  const data = useQuery(api.queries.dashboardStats);
  const approve = useMutation(api.warehouse.approveRecommendation);
  const ignore = useMutation(api.warehouse.ignoreRecommendation);
  const navigate = useNavigate();

  if (!data) return <LoadingBlock label="Loading warehouse command center…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Command Center"
        subtitle="Real-time operational overview and intelligent fulfillment decisions."
        icon={LayoutDashboard}
        actions={
          <>
            <Button variant="outline" className="gap-2 border-white/70 bg-white/60 backdrop-blur-md" onClick={() => navigate("/recommendations")}>
              <Sparkles className="size-4 text-purple-600" />
              AI Operations Advisor
            </Button>
            <Button className="gap-2 shadow-md shadow-sky-500/25" onClick={() => navigate("/orders")}>
              View all orders
              <ArrowRight className="size-4" />
            </Button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key]} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Live operations */}
        <GlassPanel className="p-5 lg:col-span-2">
          <SectionTitle title="Live Warehouse Operations" action={<LiveDot />} />
          <div className="mt-4 space-y-1">
            {data.feed.map((f) => {
              const Icon = FEED_ICONS[f.kind] ?? Activity;
              return (
                <div key={f.id} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/55">
                  <div className="glass-chip mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-500">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-700">{f.text}</p>
                    {f.detail && <p className="truncate text-[11px] text-muted-foreground">{f.detail}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeAgo(f.time)}</span>
                </div>
              );
            })}
            {data.feed.length === 0 && <EmptyState title="No activity yet" message="Operations events will appear here as the warehouse works." />}
          </div>
        </GlassPanel>

        {/* AI Decision Center */}
        <GlassPanel className="p-5 lg:col-span-3">
          <SectionTitle
            title="AI Decision Center"
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-purple-700" onClick={() => navigate("/recommendations")}>
                <Sparkles className="size-3.5" /> All recommendations
              </Button>
            }
          />
          {data.topRecs.length === 0 && <EmptyState icon={CheckCircle2} title="All clear" message="No pending decisions. The engine is watching for the next conflict." />}
          <div className="mt-4 space-y-4">
            {data.topRecs.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/75 bg-white/55 p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200/70">
                    <Sparkles className="size-3" /> {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  <SeverityDot value={r.severity} />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{r.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-slate-600">{r.problem}</p>
                <p className="mt-2 rounded-lg bg-sky-50/70 px-3 py-2 text-[12px] leading-4 text-sky-800 ring-1 ring-sky-100">
                  <span className="font-semibold">Why:</span> {r.reasoning}
                </p>
                <p className="mt-2 text-[12px] text-slate-600">
                  <span className="font-semibold text-slate-800">Recommended:</span> {r.recommendedAction}
                </p>
                <p className="mt-0.5 text-[12px] text-emerald-700">
                  <span className="font-semibold">Impact:</span> {r.impact}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      approve({ recId: r.id }).then((res) => {
                        if (res.ok) toast.success(res.applied ? "Decision approved and applied to operations" : "Recommendation approved");
                        else toast.error(res.error ?? "Failed to approve");
                      })
                    }
                  >
                    <CheckCircle2 className="size-3.5" /> Approve
                  </Button>
                  {r.orderNumber && (
                    <Button size="sm" variant="outline" className="border-white/70 bg-white/60" onClick={() => navigate(`/orders/${r.orderNumber}`)}>
                      View Order
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-500"
                    onClick={() => ignore({ recId: r.id }).then(() => toast("Recommendation ignored"))}
                  >
                    Ignore
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottlenecks */}
          {data.bottlenecks.length > 0 && (
            <div className="mt-5">
              <SectionTitle title="Detected Bottlenecks" />
              <div className="mt-2 space-y-2">
                {data.bottlenecks.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-amber-800">
                        Bottleneck · {b.kind} in {b.zone}
                      </p>
                      <p className="text-[12px] text-amber-700/80">
                        Impact: {b.impact} · Avg delay ~{b.avgDelay} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-white/70 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">{b.suggestedAction}</span>
                      <Button size="sm" variant="outline" className="border-amber-200 bg-white/60 text-amber-800" onClick={() => navigate("/picking")}>
                        View tasks
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most urgent orders */}
        <GlassPanel className="p-5">
          <SectionTitle
            title="Most Urgent Orders"
            action={
              <Link to="/orders" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                View all →
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {data.urgentOrders.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.orderNumber}`}
                className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/50 px-3.5 py-2.5 transition-all hover:bg-white/80 hover:shadow-sm"
              >
                <ScoreRing score={o.liveScore} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">{o.orderNumber}</p>
                    <PriorityBadge value={o.priority} className="px-1.5 py-0 text-[10px]" />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {o.customerName} · {o.itemCount} item{o.itemCount > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="hidden flex-col items-end gap-1 sm:flex">
                  <StatusBadge value={o.status} className="px-1.5 py-0 text-[10px]" />
                  <SlaChip minsLeft={o.slaMinsLeft} />
                </div>
                <RiskBadge value={o.liveRisk} className="px-1.5 py-0 text-[10px]" />
              </Link>
            ))}
          </div>
        </GlassPanel>

        {/* Critical stock */}
        <GlassPanel className="p-5">
          <SectionTitle
            title="Inventory at Risk"
            action={
              <Link to="/inventory" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                View inventory →
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {data.lowStock.map((i) => (
              <Link
                key={i.sku}
                to={`/inventory/${i.sku}`}
                className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/50 px-3.5 py-2.5 transition-all hover:bg-white/80 hover:shadow-sm"
              >
                <div className="glass-chip flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500">
                  <Boxes className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">{i.sku}</p>
                    <InvStatusBadge value={i.status} className="px-1.5 py-0 text-[10px]" />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {i.productName} · {i.zone} · {i.bin}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-slate-800">{i.available}</p>
                  <p className="text-[10px] text-muted-foreground">avail / reorder {i.reorderPoint}</p>
                </div>
              </Link>
            ))}
            {data.lowStock.length === 0 && <EmptyState icon={Boxes} title="No stock alerts" message="All SKUs are above their reorder points." />}
          </div>
        </GlassPanel>
      </div>

      {/* Operational pulse strip */}
      <GlassPanel className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="glass-chip flex size-9 items-center justify-center rounded-xl text-sky-600">
            <Activity className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Operational pulse</p>
            <p className="text-xs text-muted-foreground">
              {data.metrics.ordersToday} orders today · {data.metrics.pendingPicking} picking · {data.metrics.pendingPacking} packing · {data.metrics.readyToDispatch} ready to dispatch
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="glass-chip rounded-full px-3 py-1.5 font-medium text-emerald-700">{data.metrics.healthPct}% inventory health</span>
          <span className={data.metrics.atRisk > 0 ? "glass-chip rounded-full px-3 py-1.5 font-medium text-amber-700" : "glass-chip rounded-full px-3 py-1.5 font-medium text-emerald-700"}>
            {data.metrics.atRisk} orders at risk
          </span>
          <span className={data.metrics.openCriticalExc > 0 ? "glass-chip rounded-full px-3 py-1.5 font-medium text-red-700" : "glass-chip rounded-full px-3 py-1.5 font-medium text-emerald-700"}>
            {data.metrics.openCriticalExc} critical exceptions
          </span>
        </div>
      </GlassPanel>
    </div>
  );
}
