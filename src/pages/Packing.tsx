import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, SectionTitle, TaskStatusBadge, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, CircleX, PackageCheck, Play, ShieldCheck, Weight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Packing() {
  const data = useQuery(api.queries.packingList);
  const startPacking = useMutation(api.warehouse.startPacking);
  const completePacking = useMutation(api.warehouse.completePacking);
  const passQC = useMutation(api.warehouse.passQC);
  const failQC = useMutation(api.warehouse.failQC);
  const [reason, setReason] = useState("");
  const [failOrder, setFailOrder] = useState<string | null>(null);

  // QC queue: orders currently in quality_check
  const qcQueue = useQuery(api.queries.ordersList, { status: "quality_check" });

  if (!data) return <LoadingBlock label="Loading packing queue…" />;

  const qcOrders = qcQueue ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Packing Operations"
        subtitle="Pack stations, packaging types and the mandatory quality check before dispatch."
        icon={PackageCheck}
        actions={
          <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
            <span className="text-slate-500">Waiting:</span>
            <span className="font-bold text-slate-800">{data.summary.waiting}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">Packing:</span>
            <span className="font-bold text-violet-700">{data.summary.packing}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">QC required:</span>
            <span className="font-bold text-amber-600">{data.summary.failedQc + qcOrders.length}</span>
          </div>
        }
      />

      {/* QC queue */}
      <GlassPanel className="p-5">
        <SectionTitle
          title="Quality Check Queue"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 ring-1 ring-cyan-200">
              <ShieldCheck className="size-3" /> Every order must pass QC before dispatch
            </span>
          }
        />
        {qcOrders.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No orders awaiting QC" message="Packed orders appear here for verification before dispatch." />
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {qcOrders.map((o) => (
              <div key={o.id} className="rounded-xl border border-white/75 bg-white/55 p-4">
                <div className="flex items-center justify-between">
                  <Link to={`/orders/${o.orderNumber}`} className="text-[13px] font-semibold text-sky-700 hover:underline">{o.orderNumber}</Link>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">QC pending</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 sm:grid-cols-5">
                  {[
                    ["Qty verified", false],
                    ["SKU verified", false],
                    ["Damage check", false],
                    ["Packaging", false],
                    ["Address", false],
                  ].map(([label, ok]) => (
                    <span key={label as string} className="flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-1 ring-1 ring-slate-200/60">
                      {ok ? <CheckCircle2 className="size-3 text-emerald-600" /> : <span className="size-3 rounded-full border border-slate-300" />}
                      {label as string}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="gap-1.5" onClick={() => passQC({ orderNumber: o.orderNumber }).then(() => toast.success(`${o.orderNumber} passed QC — ready to dispatch`))}>
                    <CheckCircle2 className="size-3.5" /> Pass QC
                  </Button>
                  <Dialog
                    open={failOrder === o.orderNumber}
                    onOpenChange={(open) => {
                      setFailOrder(open ? o.orderNumber : null);
                      if (!open) setReason("");
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5 border-red-200 bg-white/60 text-red-600 hover:text-red-700">
                        <CircleX className="size-3.5" /> Fail QC
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-panel-strong rounded-2xl sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Fail QC for {o.orderNumber}</DialogTitle>
                        <DialogDescription>This creates an exception and moves the order to the Exception stage.</DialogDescription>
                      </DialogHeader>
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. 2 units missing from carton…" className="min-h-24" />
                      <DialogFooter>
                        <Button
                          variant="destructive"
                          disabled={!reason.trim()}
                          onClick={() => {
                            failQC({ orderNumber: o.orderNumber, reason: reason.trim() }).then(() => {
                              toast.error(`${o.orderNumber} failed QC — exception created`);
                              setFailOrder(null);
                              setReason("");
                            });
                          }}
                        >
                          Fail QC
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Packing tasks */}
      <GlassPanel className="overflow-hidden p-0" strong>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold text-slate-800">Packing queue</p>
          <span className="text-xs text-muted-foreground">{data.rows.length} packing tasks</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                <TableHead className="pl-5">Task</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Packaging</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((t) => (
                <TableRow key={t.id} className="border-white/50 transition-colors hover:bg-sky-50/40">
                  <TableCell className="pl-5 text-[13px] font-semibold text-slate-700">{t.taskNumber}</TableCell>
                  <TableCell><Link to={`/orders/${t.orderNumber}`} className="text-[13px] font-medium text-sky-700 hover:underline">{t.orderNumber}</Link></TableCell>
                  <TableCell className="text-[12px] text-slate-600">{t.station}</TableCell>
                  <TableCell className="tabular-nums text-[13px]">{t.itemCount}</TableCell>
                  <TableCell className="text-[12px] text-slate-600">{t.packagingType}</TableCell>
                  <TableCell className="flex items-center gap-1 tabular-nums text-[12px] text-slate-600"><Weight className="size-3 text-slate-400" /> {t.weightKg} kg</TableCell>
                  <TableCell><TaskStatusBadge value={t.status} className="px-1.5 py-0 text-[10px]" /></TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end">
                      {t.status === "waiting" && (
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => startPacking({ taskId: t.id }).then(() => toast.success("Packing started"))}>
                          <Play className="size-3" /> Start
                        </Button>
                      )}
                      {t.status === "packing" && (
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => completePacking({ taskId: t.id }).then(() => toast.success("Packed — QC required"))}>
                          <PackageCheck className="size-3" /> Finish packing
                        </Button>
                      )}
                      {["packed", "qc_required"].includes(t.status) && <span className={cn("text-xs font-medium", t.status === "qc_required" ? "text-amber-600" : "text-slate-500")}>Awaiting QC</span>}
                      {t.status === "ready" && <span className="text-xs font-medium text-emerald-600">Ready</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data.rows.length === 0 && <EmptyState icon={PackageCheck} title="No packing tasks" message="Completed picks move here automatically." />}
      </GlassPanel>
    </div>
  );
}
