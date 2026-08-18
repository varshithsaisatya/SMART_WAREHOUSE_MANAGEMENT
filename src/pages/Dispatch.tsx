import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, ShipStatusBadge, RiskBadge, PriorityBadge, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Send, Truck } from "lucide-react";
import { clock, dateShort } from "@/lib/format";

export default function Dispatch() {
  const data = useQuery(api.queries.dispatchList);
  const dispatch = useMutation(api.warehouse.dispatchShipment);
  const deliver = useMutation(api.warehouse.markDelivered);

  if (!data) return <LoadingBlock label="Loading dispatch queue…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dispatch Management"
        subtitle="Shipment queue across carriers, scheduled vs actual times, and delay risk."
        icon={Truck}
        actions={
          data.delayed.length > 0 ? (
            <span className="glass-chip flex items-center gap-2 rounded-xl bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="size-3.5" /> {data.delayed.length} delayed shipment{data.delayed.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" /> No delays
            </span>
          )
        }
      />

      {/* Delayed banner */}
      {data.delayed.length > 0 && (
        <GlassPanel className="border-red-200/60 p-4">
          <p className="text-sm font-bold text-red-700">Delayed shipments — action needed</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.delayed.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/60 px-3.5 py-2 ring-1 ring-red-100">
                <span className="text-[13px] font-semibold text-slate-800">{s.shipmentNumber}</span>
                <span className="text-[12px] text-slate-600">{s.carrier} · {s.destination}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">+{s.delayMinutes ?? 45}m</span>
                <Button size="sm" variant="outline" className="h-7 border-red-200 bg-white/60 text-xs text-red-700" onClick={() => dispatch({ shipmentId: s.id }).then(() => toast.success(`${s.shipmentNumber} dispatched`))}>
                  Dispatch now
                </Button>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      <GlassPanel className="overflow-hidden p-0" strong>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold text-slate-800">Dispatch queue</p>
          <span className="text-xs text-muted-foreground">{data.rows.length} shipments</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                <TableHead className="pl-5">Shipment</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Delay risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((s) => (
                <TableRow key={s.id} className="border-white/50 transition-colors hover:bg-sky-50/40">
                  <TableCell className="pl-5">
                    <span className="block text-[13px] font-semibold text-slate-700">{s.shipmentNumber}</span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">{s.trackingNumber}</span>
                  </TableCell>
                  <TableCell>
                    <Link to={`/orders/${s.orderNumber}`} className="text-[13px] font-medium text-sky-700 hover:underline">{s.orderNumber}</Link>
                    <PriorityBadge value={s.orderPriority} className="ml-1.5 px-1.5 py-0 text-[9px]" />
                  </TableCell>
                  <TableCell className="text-[12px] text-slate-600">{s.carrier}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-[12px] text-slate-600">{s.destination}</TableCell>
                  <TableCell className="tabular-nums text-[12px] text-slate-600">{dateShort(s.scheduledAt)} {clock(s.scheduledAt)}</TableCell>
                  <TableCell className="tabular-nums text-[12px] text-slate-600">{s.dispatchedAt ? `${dateShort(s.dispatchedAt)} ${clock(s.dispatchedAt)}` : "—"}</TableCell>
                  <TableCell><RiskBadge value={s.risk} className="px-1.5 py-0 text-[10px]" /></TableCell>
                  <TableCell><ShipStatusBadge value={s.status} className="px-1.5 py-0 text-[10px]" /></TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end">
                      {s.status === "ready" && (
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => dispatch({ shipmentId: s.id }).then(() => toast.success(`${s.shipmentNumber} dispatched via ${s.carrier}`))}>
                          <Send className="size-3" /> Dispatch now
                        </Button>
                      )}
                      {s.status === "dispatched" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 border-white/70 bg-white/60 text-xs" onClick={() => deliver({ shipmentId: s.id }).then(() => toast.success("Marked delivered"))}>
                          <CheckCircle2 className="size-3" /> Mark delivered
                        </Button>
                      )}
                      {s.status === "delayed" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 border-red-200 bg-white/60 text-xs text-red-700" onClick={() => dispatch({ shipmentId: s.id }).then(() => toast.success(`${s.shipmentNumber} dispatched after delay`))}>
                          <Send className="size-3" /> Dispatch now
                        </Button>
                      )}
                      {s.status === "delivered" && <span className="text-xs font-medium text-emerald-600">Delivered</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data.rows.length === 0 && <EmptyState icon={Truck} title="No shipments" message="Shipments are created when orders pass quality check." />}
      </GlassPanel>
    </div>
  );
}
