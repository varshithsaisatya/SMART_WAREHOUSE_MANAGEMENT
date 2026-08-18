import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  GlassPanel,
  PageHeader,
  SectionTitle,
  PriorityBadge,
  StatusBadge,
  RiskBadge,
  SlaChip,
  ScoreRing,
  FulfillmentTracker,
  TaskStatusBadge,
  ShipStatusBadge,
  ExcTypeBadge,
  ExcStatusBadge,
  LoadingBlock,
  EmptyState,
  LiveDot,
} from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo, dateTime, inr, fmtDuration, clock } from "@/lib/format";
import { ArrowLeft, CheckCircle2, CircleX, PackageCheck, PackageSearch, Play, Send, Truck, UserCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const navigate = useNavigate();
  const data = useQuery(api.queries.orderDetail, { orderNumber });

  const approveAllocation = useMutation(api.warehouse.approveAllocation);
  const rejectAllocation = useMutation(api.warehouse.rejectAllocation);
  const assignPicker = useMutation(api.warehouse.assignPicker);
  const startPicking = useMutation(api.warehouse.startPicking);
  const completePicking = useMutation(api.warehouse.completePicking);
  const startPacking = useMutation(api.warehouse.startPacking);
  const completePacking = useMutation(api.warehouse.completePacking);
  const passQC = useMutation(api.warehouse.passQC);
  const failQC = useMutation(api.warehouse.failQC);
  const dispatch = useMutation(api.warehouse.dispatchShipment);
  const deliver = useMutation(api.warehouse.markDelivered);
  const [qcReason, setQcReason] = useState("");
  const [qcDialogOpen, setQcDialogOpen] = useState(false);

  if (!data) return <LoadingBlock label="Loading order…" />;

  const o = data.order;
  const pendingAllocs = data.allocations.filter((a: any) => a.status === "proposed");
  const activePick = data.picking[0];
  const activePack = data.packing[0];
  const shipment = data.shipments[0];

  const run = (fn: () => Promise<any>, okMsg: string) =>
    fn().then((res) => {
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Action failed");
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" className="gap-1 text-slate-500" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>

      {/* Header */}
      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <ScoreRing score={o.liveScore} size={64} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{o.orderNumber}</h1>
                <PriorityBadge value={o.priority} />
                <StatusBadge value={o.status} />
                <RiskBadge value={o.risk} />
              </div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-600">
                <span className="font-semibold text-slate-800">Priority {o.liveScore}/100.</span> {o.explanation}.
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">SLA window: {fmtDuration(o.slaHours * 60)} · ordered {dateTime(o.createdAt)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SlaChip minsLeft={o.slaMinsLeft} />
            <span className="text-[11px] text-muted-foreground">SLA deadline {dateTime(o.slaDeadline)}</span>
          </div>
        </div>

        <div className="mt-6">
          <FulfillmentTracker stage={data.stage} />
        </div>
      </GlassPanel>

      {/* Pending decisions banner */}
      {pendingAllocs.length > 0 && (
        <GlassPanel className="border-amber-200/70 p-4">
          <p className="text-sm font-semibold text-amber-800">Pending allocation decision</p>
          {pendingAllocs.map((a: any) => (
            <div key={a._id} className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/60 px-3.5 py-2.5">
              <p className="max-w-xl text-[13px] text-slate-700">
                <span className="font-semibold">{a.sku}</span> — {a.requiredQty} required, {a.allocatedQty} to allocate ({a.decision}). {a.reason}
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => run(() => approveAllocation({ allocId: a._id }), "Allocation approved — inventory updated")}>
                  <CheckCircle2 className="size-3.5" /> Approve allocation
                </Button>
                <Button size="sm" variant="outline" className="border-white/70 bg-white/60" onClick={() => run(() => rejectAllocation({ allocId: a._id }), "Allocation rejected")}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </GlassPanel>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: details + items */}
        <div className="space-y-5 lg:col-span-2">
          <GlassPanel className="p-5">
            <SectionTitle title="Order Items & Allocation" />
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                    <TableHead className="pl-3">SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Backorder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-3 text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((it) => (
                    <TableRow key={it.id} className="border-white/50">
                      <TableCell className="pl-3">
                        <Link to={`/inventory/${it.sku}`} className="text-[13px] font-semibold text-sky-700 hover:underline">{it.sku}</Link>
                        <span className="block text-[10px] text-muted-foreground">{it.zone} · {it.bin}</span>
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-700">{it.productName}</TableCell>
                      <TableCell className="text-right tabular-nums text-[13px]">{it.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums text-[13px] text-emerald-700">{it.allocatedQty}</TableCell>
                      <TableCell className="text-right tabular-nums text-[13px] text-amber-600">{it.backorderedQty}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", it.status === "backordered" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : it.status === "partial" ? "bg-orange-50 text-orange-600 ring-1 ring-orange-200" : it.status === "packed" || it.status === "picked" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200")}>{it.status}</span>
                      </TableCell>
                      <TableCell className="pr-3 text-right tabular-nums text-[13px] font-medium">{inr(it.price * it.quantity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassPanel>

          {/* Fulfillment tasks */}
          <GlassPanel className="p-5">
            <SectionTitle title="Fulfillment Tasks" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {/* Picking */}
              <div className="rounded-xl border border-white/75 bg-white/50 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><PackageSearch className="size-3.5 text-blue-600" /> Picking</p>
                  {activePick && <TaskStatusBadge value={activePick.status} className="px-1.5 py-0 text-[10px]" />}
                </div>
                {activePick ? (
                  <div className="mt-2 space-y-1 text-[12px] text-slate-600">
                    <p><span className="text-muted-foreground">Task:</span> {activePick.taskNumber} · {activePick.zone}</p>
                    <p><span className="text-muted-foreground">Picker:</span> {activePick.picker} · ~{activePick.estimatedMinutes} min</p>
                    {activePick.route && <p className="text-[11px] text-sky-700">Route: {activePick.route}</p>}
                    <div className="mt-2 flex gap-1.5">
                      {activePick.status === "waiting" && <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => run(() => assignPicker({ taskId: activePick._id, picker: "You" }), "Task assigned to you")}><UserCheck className="size-3" /> Assign to me</Button>}
                      {activePick.status === "assigned" && <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => run(() => startPicking({ taskId: activePick._id }), "Picking started")}><Play className="size-3" /> Start picking</Button>}
                      {activePick.status === "in_progress" && <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => run(() => completePicking({ taskId: activePick._id }), "Picking completed — moved to packing")}><CheckCircle2 className="size-3" /> Complete pick</Button>}
                      {activePick.status === "completed" && <span className="text-xs font-medium text-emerald-700">Completed</span>}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-muted-foreground">No picking task for this order.</p>
                )}
              </div>

              {/* Packing */}
              <div className="rounded-xl border border-white/75 bg-white/50 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><PackageCheck className="size-3.5 text-violet-600" /> Packing</p>
                  {activePack && <TaskStatusBadge value={activePack.status} className="px-1.5 py-0 text-[10px]" />}
                </div>
                {activePack ? (
                  <div className="mt-2 space-y-1 text-[12px] text-slate-600">
                    <p><span className="text-muted-foreground">Task:</span> {activePack.taskNumber} · {activePack.station}</p>
                    <p><span className="text-muted-foreground">Package:</span> {activePack.packagingType} · {activePack.weightKg} kg</p>
                    <div className="mt-2 flex gap-1.5">
                      {activePack.status === "waiting" && <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => run(() => startPacking({ taskId: activePack._id }), "Packing started")}><Play className="size-3" /> Start packing</Button>}
                      {activePack.status === "packing" && <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => run(() => completePacking({ taskId: activePack._id }), "Packed — QC required")}><CheckCircle2 className="size-3" /> Finish packing</Button>}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-muted-foreground">No packing task yet.</p>
                )}
              </div>
            </div>

            {/* QC */}
            {(o.status === "quality_check" || o.status === "ready" || o.status === "exception") && data.qc && (
              <div className="mt-3 rounded-xl border border-white/75 bg-white/50 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><CheckCircle2 className="size-3.5 text-cyan-600" /> Quality Check</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", data.qc.status === "passed" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : data.qc.status === "failed" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200")}>{data.qc.status}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-600 sm:grid-cols-5">
                  {[["Quantity verified", data.qc.itemQuantityVerified], ["SKU verified", data.qc.skuVerified], ["Damage check", data.qc.damageCheck], ["Packaging", data.qc.packagingVerified], ["Address", data.qc.addressVerified]].map(([label, ok]) => (
                    <span key={label as string} className="flex items-center gap-1">
                      {ok ? <CheckCircle2 className="size-3 text-emerald-600" /> : <XCircle className="size-3 text-red-500" />}
                      {label as string}
                    </span>
                  ))}
                </div>
                {o.status === "quality_check" && (
                  <div className="mt-2.5 flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => run(() => passQC({ orderNumber }), "QC passed — ready to dispatch")}>
                      <CheckCircle2 className="size-3.5" /> Pass QC
                    </Button>
                    <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5 border-red-200 bg-white/60 text-red-600 hover:text-red-700">
                          <CircleX className="size-3.5" /> Fail QC
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-panel-strong rounded-2xl sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Fail quality check</DialogTitle>
                          <DialogDescription>This creates an exception and moves the order to the Exception stage.</DialogDescription>
                        </DialogHeader>
                        <Textarea value={qcReason} onChange={(e) => setQcReason(e.target.value)} placeholder="Reason, e.g. 2 units missing from carton…" className="min-h-24" />
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            disabled={!qcReason.trim()}
                            onClick={() => {
                              run(() => failQC({ orderNumber, reason: qcReason.trim() }), "QC failed — exception created");
                              setQcDialogOpen(false);
                              setQcReason("");
                            }}
                          >
                            Fail QC
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                {data.qc.status === "failed" && data.qc.failedReason && <p className="mt-2 text-[12px] text-red-600">Reason: {data.qc.failedReason}</p>}
              </div>
            )}

            {/* Dispatch */}
            {shipment && (
              <div className="mt-3 rounded-xl border border-white/75 bg-white/50 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><Truck className="size-3.5 text-teal-600" /> Dispatch · {shipment.shipmentNumber}</p>
                  <ShipStatusBadge value={shipment.status} className="px-1.5 py-0 text-[10px]" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-slate-600">
                  <span>Carrier: <b>{shipment.carrier}</b></span>
                  <span>Tracking: <b className="tabular-nums">{shipment.trackingNumber}</b></span>
                  <span>{shipment.destination}</span>
                  {shipment.delayMinutes ? <span className="font-semibold text-red-600">Delayed {shipment.delayMinutes}m</span> : null}
                </div>
                {o.status === "ready" && (
                  <Button size="sm" className="mt-2.5 gap-1.5" onClick={() => run(() => dispatch({ shipmentId: shipment._id }), "Shipment dispatched")}>
                    <Send className="size-3.5" /> Dispatch now
                  </Button>
                )}
                {o.status === "dispatched" && (
                  <Button size="sm" variant="outline" className="mt-2.5 gap-1.5 border-white/70 bg-white/60" onClick={() => run(() => deliver({ shipmentId: shipment._id }), "Marked delivered")}>
                    <CheckCircle2 className="size-3.5" /> Mark delivered
                  </Button>
                )}
              </div>
            )}
          </GlassPanel>

          {/* Timeline */}
          <GlassPanel className="p-5">
            <SectionTitle title="Order Timeline" action={<LiveDot />} />
            <div className="mt-3 space-y-0">
              {data.feed.map((f, idx) => (
                <div key={f.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {idx < data.feed.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" />}
                  <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white/70", f.kind === "movement" ? "bg-sky-400" : "bg-indigo-400")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium capitalize text-slate-700">{f.text}</p>
                    {f.detail && <p className="text-[11px] text-muted-foreground">{f.detail}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeAgo(f.time)}</span>
                </div>
              ))}
              {data.feed.length === 0 && <EmptyState title="No events yet" message="Timeline updates as the order moves through fulfillment." />}
            </div>
          </GlassPanel>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <GlassPanel className="p-5">
            <SectionTitle title="Order Information" />
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ["Order number", o.orderNumber],
                ["Placed", dateTime(o.createdAt)],
                ["Priority", o.priority],
                ["Priority score", `${o.liveScore}/100`],
                ["Shipping", o.shippingMethod === "express" ? "Express" : "Standard"],
                ["Carrier", o.carrier ?? "—"],
                ["Zone", o.zone ? `Zone ${o.zone}` : "—"],
                ["Total value", inr(o.totalValue)],
                ["SLA", `${fmtDuration(o.slaHours * 60)} window`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium capitalize text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </GlassPanel>

          <GlassPanel className="p-5">
            <SectionTitle title="Customer" />
            <div className="mt-3 space-y-2 text-[13px]">
              <p className="font-semibold text-slate-800">{o.customerName}</p>
              <p className="text-muted-foreground">{o.customerCity}, India</p>
              <p className="text-muted-foreground">{o.customerEmail}</p>
              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">{o.customerTier} customer</span>
            </div>
          </GlassPanel>

          {data.exceptions.length > 0 && (
            <GlassPanel className="p-5">
              <SectionTitle title="Linked Exceptions" />
              <div className="mt-3 space-y-2">
                {data.exceptions.map((e: any) => (
                  <Link key={e._id} to="/exceptions" className="block rounded-xl border border-white/70 bg-white/50 px-3 py-2.5 transition-colors hover:bg-white/75">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-800">{e.exceptionNumber}</p>
                      <ExcStatusBadge value={e.status} className="px-1.5 py-0 text-[10px]" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{e.description}</p>
                    <div className="mt-1"><ExcTypeBadge value={e.type} /></div>
                  </Link>
                ))}
              </div>
            </GlassPanel>
          )}

          <GlassPanel className="p-5">
            <SectionTitle title="Key timestamps" />
            <dl className="mt-3 space-y-2 text-[12px]">
              {[
                ["Allocated", o.allocatedAt],
                ["Picked", o.pickedAt],
                ["Packed", o.packedAt],
                ["QC passed", o.qcAt],
                ["Dispatched", o.dispatchedAt],
                ["Delivered", o.deliveredAt],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{k as string}</dt>
                  <dd className="tabular-nums text-slate-700">{v ? clock(v as number) : "—"}</dd>
                </div>
              ))}
            </dl>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
