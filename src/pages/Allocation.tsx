import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, SectionTitle, PriorityBadge, LoadingBlock, EmptyState, SeverityDot } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Handshake, PackageX, RefreshCcw, Split, X } from "lucide-react";
import { fmtDuration, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const DECISION_META: Record<string, { label: string; cls: string; icon: any }> = {
  full: { label: "Fully allocate", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  partial: { label: "Partial allocation", cls: "bg-amber-50 text-amber-700 ring-amber-200", icon: Handshake },
  backorder: { label: "Backorder", cls: "bg-red-50 text-red-700 ring-red-200", icon: PackageX },
  reallocate: { label: "Reallocate", cls: "bg-orange-50 text-orange-600 ring-orange-200", icon: RefreshCcw },
};

export default function Allocation() {
  const data = useQuery(api.queries.allocationsList);
  const approve = useMutation(api.warehouse.approveAllocation);
  const reject = useMutation(api.warehouse.rejectAllocation);
  const modify = useMutation(api.warehouse.modifyAllocation);
  const [qty, setQty] = useState("");

  if (!data) return <LoadingBlock label="Running allocation engine…" />;

  const flagship = data.rows.find((r) => r.sku === "WH-204" && r.orderNumber === "ORD-1052" && r.status === "proposed");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory Allocation Engine"
        subtitle="The engine analyzes incoming orders against available stock and proposes a decision for every allocation."
        icon={Split}
        actions={
          <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
            <span className="text-slate-500">Proposed:</span>
            <span className="font-bold text-slate-800">{data.summary.proposed}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">Approved:</span>
            <span className="font-bold text-emerald-600">{data.summary.approved}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">Critical pending:</span>
            <span className="font-bold text-red-600">{data.summary.critical}</span>
          </div>
        }
      />

      {/* Flagship conflict */}
      {flagship && (
        <GlassPanel className="border-red-200/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Stock conflict detected — {flagship.sku}</p>
                <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-600">
                  Order <b>{flagship.orderNumber}</b> requires <b>{flagship.requiredQty} units</b>. Only <b>{flagship.availableQty} units</b> are available.
                  The system recommends allocating all {flagship.availableQty} units because the order is <b>Critical</b> and delaying it would breach the SLA.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => approve({ allocId: flagship.id }).then((r) => (r.ok ? toast.success("Allocated 7 units to ORD-1052 — 3 backordered") : toast.error(r.error ?? "Failed")))}>
                <CheckCircle2 className="size-3.5" /> Approve allocation
              </Button>
              <Button size="sm" variant="outline" className="border-white/70 bg-white/60" onClick={() => reject({ allocId: flagship.id }).then(() => toast("Allocation rejected"))}>
                Reject
              </Button>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Decision queue */}
      <GlassPanel className="p-5">
        <SectionTitle title="Allocation decisions" action={<span className="text-xs text-muted-foreground">{data.summary.total} lines reviewed</span>} />
        <div className="mt-4 space-y-3">
          {data.rows.map((r) => {
            const meta = DECISION_META[r.decision] ?? DECISION_META.backorder;
            const Icon = meta.icon;
            const allocPct = Math.round((r.allocatedQty / Math.max(1, r.requiredQty)) * 100);
            return (
              <div key={r.id} className={cn("rounded-xl border bg-white/55 p-4 transition-shadow hover:shadow-sm", r.status === "approved" ? "border-emerald-200/70" : r.decision === "backorder" ? "border-red-200/60" : r.decision === "partial" ? "border-amber-200/70" : "border-white/75")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link to={`/orders/${r.orderNumber}`} className="text-[13px] font-semibold text-sky-700 hover:underline">{r.orderNumber}</Link>
                    <PriorityBadge value={r.priority} className="px-1.5 py-0 text-[10px]" />
                    <Badge variant="outline" className={cn("gap-1 font-medium", meta.cls)}>
                      <Icon className="size-3" /> {meta.label}
                    </Badge>
                    {r.status === "proposed" ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Awaiting approval</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Approved</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {r.slaMinsLeft < 9999 ? `${fmtDuration(r.slaMinsLeft)} to SLA · ` : ""}{timeAgo(r.createdAt)}
                  </span>
                </div>

                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-slate-600">
                      <span>SKU <b className="text-slate-800">{r.sku}</b> · {r.productName}</span>
                      <span>Required <b className="tabular-nums">{r.requiredQty}</b></span>
                      <span>Available <b className={cn("tabular-nums", r.stockAvailable === 0 ? "text-red-600" : "text-emerald-700")}>{r.stockAvailable}</b></span>
                      <span>Allocate <b className="tabular-nums text-sky-700">{r.allocatedQty}</b></span>
                      <span>Backorder <b className="tabular-nums text-amber-600">{r.backorderedQty}</b></span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/70">
                        <div className={cn("h-full rounded-full", r.decision === "full" ? "bg-emerald-400" : r.decision === "partial" ? "bg-amber-400" : "bg-red-300")} style={{ width: `${allocPct}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-600">{allocPct}%</span>
                    </div>
                    <p className="mt-2 max-w-2xl text-[12px] leading-4 text-slate-600">
                      <span className="font-semibold text-slate-800">Why:</span> {r.reason}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {r.status === "proposed" ? (
                      <>
                        <Button size="sm" className="gap-1.5" onClick={() => approve({ allocId: r.id }).then((res) => (res.ok ? toast.success("Allocation approved") : toast.error(res.error ?? "Failed")))}>
                          <CheckCircle2 className="size-3.5" /> Approve
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="border-white/70 bg-white/60">Modify</Button>
                          </DialogTrigger>
                          <DialogContent className="glass-panel-strong rounded-2xl sm:max-w-sm">
                            <DialogHeader>
                              <DialogTitle>Modify allocation</DialogTitle>
                              <DialogDescription>
                                Adjust how many units of {r.sku} to allocate to {r.orderNumber} (0–{r.requiredQty}). The rest becomes backordered.
                              </DialogDescription>
                            </DialogHeader>
                            <Input type="number" min={0} max={r.requiredQty} value={qty || r.allocatedQty} onChange={(e) => setQty(e.target.value)} />
                            <DialogFooter>
                              <Button
                                onClick={() => {
                                  modify({ allocId: r.id, allocatedQty: Number(qty) }).then((res) => {
                                    if (res.ok) toast.success(`Allocation set to ${res.allocatedQty} units`);
                                    else toast.error(res.error ?? "Failed");
                                    setQty("");
                                  });
                                }}
                              >
                                Apply
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => reject({ allocId: r.id }).then(() => toast("Allocation rejected"))}>
                          <X className="size-3.5" /> Reject
                        </Button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 className="size-3" /> Applied to inventory
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {data.rows.length === 0 && <EmptyState icon={Split} title="No allocations to review" message="All inventory is allocated cleanly. Run the Inventory Shortage demo to create a conflict." />}
      </GlassPanel>

      {/* How the engine decides */}
      <GlassPanel className="p-5">
        <SectionTitle title="How the allocation engine decides" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Fully allocate", d: "Enough inventory exists to cover the full quantity.", icon: CheckCircle2, cls: "text-emerald-600" },
            { t: "Partial allocation", d: "Some stock exists — the engine allocates everything available to the highest-priority order and backorders the rest.", icon: Handshake, cls: "text-amber-600" },
            { t: "Backorder", d: "No inventory available, or stock is reserved for higher-priority orders. The order waits for replenishment.", icon: PackageX, cls: "text-red-600" },
            { t: "Reallocate", d: "Reserved stock held by lower-priority orders can be reassigned to protect a critical SLA.", icon: RefreshCcw, cls: "text-orange-600" },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-white/70 bg-white/50 p-3.5">
              <c.icon className={cn("size-4", c.cls)} />
              <p className="mt-1.5 text-[13px] font-semibold text-slate-800">{c.t}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
