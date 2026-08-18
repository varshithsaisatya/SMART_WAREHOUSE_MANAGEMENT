import { useParams, Link, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { GlassPanel, PageHeader, SectionTitle, InvStatusBadge, RiskBadge, LoadingBlock, EmptyState, SeverityDot } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Boxes, PackagePlus, Sparkles, TrendingUp, Warehouse } from "lucide-react";
import { timeAgo, dateShort, inr, fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const MOVEMENT_COLORS: Record<string, string> = {
  received: "text-emerald-700 bg-emerald-50",
  restocked: "text-emerald-700 bg-emerald-50",
  ordered: "text-sky-700 bg-sky-50",
  allocated: "text-indigo-700 bg-indigo-50",
  picked: "text-blue-700 bg-blue-50",
  backordered: "text-amber-700 bg-amber-50",
  damaged: "text-rose-700 bg-rose-50",
  adjusted: "text-orange-700 bg-orange-50",
  returned: "text-teal-700 bg-teal-50",
};

export default function InventoryDetail() {
  const { sku = "" } = useParams();
  const navigate = useNavigate();
  const data = useQuery(api.queries.inventoryDetail, { sku });
  const createReorder = useMutation(api.warehouse.createReorderOrder);

  if (!data) return <LoadingBlock label="Loading SKU…" />;
  const inv = data.inventory;
  const total = inv.available + inv.reserved;
  const availablePct = (inv.available / Math.max(1, total)) * 100;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="gap-1 text-slate-500" onClick={() => navigate(-1)}>
        <ArrowLeft className="size-4" /> Back to inventory
      </Button>

      <PageHeader
        title={`${inv.sku} · ${inv.productName}`}
        subtitle={`${inv.category} · ${data.product?.color ?? ""} · ${inr(inv.price)}`}
        icon={Boxes}
        actions={
          <>
            <InvStatusBadge value={inv.status} />
            <RiskBadge value={data.risk} />
          </>
        }
      />

      {/* Stock levels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Available", value: inv.available, cls: "text-slate-900", sub: "ready to fulfill" },
          { label: "Reserved", value: inv.reserved, cls: "text-indigo-600", sub: "held for orders" },
          { label: "Damaged", value: inv.damaged, cls: "text-rose-600", sub: "awaiting disposition" },
          { label: "Reorder point", value: inv.reorderPoint, cls: "text-amber-600", sub: `reorder qty ${inv.reorderQty}` },
        ].map((s) => (
          <GlassPanel key={s.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={cn("mt-1 text-3xl font-bold tabular-nums", s.cls)}>{s.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</p>
          </GlassPanel>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Stock position visual */}
          <GlassPanel className="p-5">
            <SectionTitle title="Stock position" />
            <div className="mt-4 flex h-4 overflow-hidden rounded-full ring-1 ring-inset ring-slate-200/70">
              <div className="bg-sky-400/85" style={{ width: `${availablePct}%` }} />
              <div className="bg-indigo-300/80" style={{ width: `${(inv.reserved / Math.max(1, total)) * 100}%` }} />
              <div className="bg-rose-300/80" style={{ width: `${(inv.damaged / Math.max(1, total)) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" /> Available ({inv.available})</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-300" /> Reserved ({inv.reserved})</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-300" /> Damaged ({inv.damaged})</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-amber-500" /> Reorder point ({inv.reorderPoint})</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/70 bg-white/50 p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700"><TrendingUp className="size-3.5 text-sky-600" /> Demand</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">{inv.demand30d} <span className="text-xs font-medium text-muted-foreground">units / 30d</span></p>
                <p className="text-[11px] text-muted-foreground">Forecast next 30d: <b>{inv.forecastDemand}</b> units</p>
                <p className={cn("mt-1 text-[11px] font-medium", data.daysLeft <= 3 ? "text-red-600" : "text-slate-600")}>Est. days of cover: {data.daysLeft}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/50 p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700"><Warehouse className="size-3.5 text-teal-600" /> Location</p>
                <p className="mt-1 text-lg font-bold text-slate-800">Zone {inv.zone}</p>
                <p className="text-[11px] text-muted-foreground">Bin {inv.bin} · last updated {timeAgo(inv.lastUpdated)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Risk: <b className="capitalize">{data.risk}</b> — {data.riskReason}</p>
              </div>
            </div>
          </GlassPanel>

          {/* Movements */}
          <GlassPanel className="p-5">
            <SectionTitle title="Stock movement history" />
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                    <TableHead className="pl-3">Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="pr-3 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.movements.slice(0, 12).map((m: any) => (
                    <TableRow key={m._id} className="border-white/50">
                      <TableCell className="pl-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", MOVEMENT_COLORS[m.type] ?? "bg-slate-100 text-slate-600")}>{m.type}</span>
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums text-[13px] font-semibold", m.type === "received" || m.type === "restocked" || m.type === "returned" ? "text-emerald-600" : m.type === "damaged" || m.type === "allocated" || m.type === "picked" || m.type === "backordered" ? "text-rose-500" : "text-slate-700")}>{m.type === "received" || m.type === "restocked" || m.type === "returned" ? "+" : "−"}{m.quantity}</TableCell>
                      <TableCell className="text-[12px] text-slate-600">{m.reference}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-[12px] text-muted-foreground">{m.note ?? "—"}</TableCell>
                      <TableCell className="pr-3 text-right text-[11px] tabular-nums text-muted-foreground">{timeAgo(m.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassPanel>

          {/* Recent orders */}
          <GlassPanel className="p-5">
            <SectionTitle title="Recent orders touching this SKU" />
            {data.recentOrders.length === 0 ? (
              <EmptyState icon={Boxes} title="No orders yet" />
            ) : (
              <div className="mt-3 space-y-2">
                {data.recentOrders.map((o) => (
                  <Link key={o.id} to={`/orders/${o.orderNumber}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/50 px-3.5 py-2.5 transition-colors hover:bg-white/75">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{o.orderNumber}</p>
                      <p className="text-[11px] text-muted-foreground">{dateShort(o.createdAt)} · {o.items.length} line{o.items.length > 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.items.map((it: any, idx: number) => (
                        <span key={idx} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", it.backorderedQty > 0 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")}>
                          {it.quantity}u{it.backorderedQty > 0 ? ` · ${it.backorderedQty} back` : ""}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>

        {/* Right: AI recommendation */}
        <div className="space-y-5">
          <GlassPanel className="border-purple-200/60 p-5">
            <SectionTitle title="AI Replenishment Advisor" action={<Sparkles className="size-4 text-purple-600" />} />
            {data.reorder ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200/70">
                    <Sparkles className="size-3" /> Reorder recommended
                  </span>
                  <SeverityDot value="high" />
                </div>
                <p className="mt-2.5 text-[13px] leading-5 text-slate-700">{data.reorder.rationale}</p>
                <div className="mt-3 rounded-xl bg-sky-50/70 px-3.5 py-3 ring-1 ring-sky-100">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700">Recommended reorder quantity</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{data.reorder.quantity} units</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Covers forecasted demand with a {Math.round((1.2 - 1) * 100)}% safety margin</p>
                </div>
                {data.reorder.daysToStockout !== null && data.reorder.daysToStockout <= 3 && (
                  <p className="mt-2 text-[11px] font-medium text-red-600">Stockout projected in ~{Math.ceil(data.reorder.daysToStockout)} day{data.reorder.daysToStockout >= 2 ? "s" : ""}</p>
                )}
                <Button
                  className="mt-3 w-full gap-1.5 shadow-md shadow-purple-500/20"
                  onClick={() => createReorder({ sku }).then((res) => (res.ok ? toast.success(`Reorder placed for ${res.quantity} units — ETA 3 days`) : toast.error(res.error ?? "Failed")))}
                >
                  <PackagePlus className="size-4" /> Create Reorder Recommendation
                </Button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-emerald-50/70 px-3.5 py-4 text-center ring-1 ring-emerald-100">
                <p className="text-sm font-semibold text-emerald-700">Stock looks healthy</p>
                <p className="mt-1 text-[12px] text-emerald-700/70">Projected demand is covered. No replenishment needed right now.</p>
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="p-5">
            <SectionTitle title="SKU facts" />
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ["Supplier", data.product?.supplier ?? "—"],
                ["Unit weight", data.product ? `${data.product.weightGrams} g` : "—"],
                ["Bin", inv.bin],
                ["Zone", `Zone ${inv.zone}`],
                ["30-day demand", `${inv.demand30d} units`],
                ["Forecast", `${inv.forecastDemand} units`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
