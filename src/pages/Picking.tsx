import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, SectionTitle, PriorityBadge, TaskStatusBadge, SlaChip, LoadingBlock, EmptyState, LiveDot } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch, Play, CheckCircle2, Layers, MapPin, Timer, UserCheck, Sparkles } from "lucide-react";
import { fmtDuration, timeAgo } from "@/lib/format";

const PICKERS = ["Priya N.", "Ravi K.", "Sameer J.", "Anita D.", "Kiran P.", "Deepa M.", "Manoj S.", "Neha R."];

export default function Picking() {
  const data = useQuery(api.queries.pickingList);
  const startPicking = useMutation(api.warehouse.startPicking);
  const completePicking = useMutation(api.warehouse.completePicking);
  const assignPicker = useMutation(api.warehouse.assignPicker);
  const createBatch = useMutation(api.warehouse.createPickingBatch);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);

  if (!data) return <LoadingBlock label="Loading picking queue…" />;

  const next = data.nextPick;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Picking Operations"
        subtitle="The engine sorts the queue by order priority, SLA urgency and zone proximity, and recommends the next task."
        icon={PackageSearch}
        actions={
          <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
            <span className="text-slate-500">Queue:</span>
            <span className="font-bold text-slate-800">{data.summary.waiting + data.summary.assigned}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">In progress:</span>
            <span className="font-bold text-sky-700">{data.summary.inProgress}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">Blocked:</span>
            <span className="font-bold text-red-600">{data.summary.blocked}</span>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recommended next pick */}
        <GlassPanel className="border-sky-200/70 p-5 lg:col-span-2">
          <SectionTitle
            title="Recommended Next Pick"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200/70">
                <Sparkles className="size-3" /> Engine decision
              </span>
            }
          />
          {next ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="glass-chip flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <PackageSearch className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link to={`/orders/${next.orderNumber}`} className="text-base font-bold text-slate-900 hover:underline">{next.orderNumber}</Link>
                      <PriorityBadge value={next.priority} className="px-1.5 py-0 text-[10px]" />
                      <TaskStatusBadge value={next.status} className="px-1.5 py-0 text-[10px]" />
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {next.taskNumber} · {next.itemCount} item{next.itemCount > 1 ? "s" : ""} · picker {next.picker}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-slate-600">
                  <span className="flex items-center gap-1"><Timer className="size-3.5 text-sky-600" /> Est. travel <b>{next.estimatedMinutes} min</b></span>
                  <SlaChip minsLeft={next.slaMinsLeft} />
                </div>
              </div>
              {next.route && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50/70 px-3.5 py-2.5 text-[12px] font-medium text-sky-800 ring-1 ring-sky-100">
                  <MapPin className="size-3.5" /> Route: {next.route}
                </div>
              )}
              <p className="mt-2 text-[12px] text-muted-foreground">
                Why this task: highest priority score ({next.orderPriorityScore}/100) with {fmtDuration(next.slaMinsLeft)} remaining on its SLA.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {next.status === "waiting" && (
                  <Button size="sm" className="gap-1.5" onClick={() => assignPicker({ taskId: next.id, picker: "You" }).then(() => toast.success("Assigned to you — start when ready"))}>
                    <UserCheck className="size-3.5" /> Assign to me
                  </Button>
                )}
                {next.status === "assigned" && (
                  <Button size="sm" className="gap-1.5" onClick={() => startPicking({ taskId: next.id }).then(() => toast.success("Picking started"))}>
                    <Play className="size-3.5" /> Start picking
                  </Button>
                )}
                {next.status === "in_progress" && (
                  <Button size="sm" className="gap-1.5" onClick={() => completePicking({ taskId: next.id }).then(() => toast.success("Pick completed — order moved to packing"))}>
                    <CheckCircle2 className="size-3.5" /> Complete pick
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon={PackageSearch} title="Queue is clear" message="No waiting or assigned tasks. The engine will surface the next pick as orders arrive." />
          )}
        </GlassPanel>

        {/* Batch opportunities */}
        <GlassPanel className="p-5">
          <SectionTitle title="Batch Picking Opportunities" action={<LiveDot color="bg-sky-400" />} />
          {data.batches.length === 0 ? (
            <EmptyState icon={Layers} title="No batches right now" message="When 3+ orders share a zone, the engine proposes a batch to cut travel time." />
          ) : (
            <div className="mt-3 space-y-3">
              {data.batches.map((b) => (
                <div key={b.zone} className="rounded-xl border border-white/75 bg-white/55 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-slate-800">{b.orderCount} orders · Zone {b.zone}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">−{b.travelReductionPct}% travel</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.orders.map((o) => (
                      <span key={o.id} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/70">{o.orderNumber}</span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2.5 h-7 gap-1 border-white/70 bg-white/60 text-xs"
                    disabled={batchBusy === b.zone}
                    onClick={async () => {
                      setBatchBusy(b.zone);
                      const res = await createBatch({ zone: b.zone, orderNumbers: b.orders.map((o) => o.orderNumber) });
                      if (res.ok) toast.success(`Batch ${res.batch} created — tasks assigned`);
                      else toast.error(res.error ?? "Failed");
                      setBatchBusy(null);
                    }}
                  >
                    <Layers className="size-3" /> Create Picking Batch
                  </Button>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Task table */}
      <GlassPanel className="overflow-hidden p-0" strong>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold text-slate-800">Picking queue</p>
          <span className="text-xs text-muted-foreground">Sorted by engine priority — SLA urgency first</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                <TableHead className="pl-5">Task</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Picker</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Est. time</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((t) => (
                <TableRow key={t.id} className="border-white/50 transition-colors hover:bg-sky-50/40">
                  <TableCell className="pl-5 text-[13px] font-semibold text-slate-700">{t.taskNumber}{t.batchGroup && <span className="ml-1.5 rounded bg-purple-50 px-1 py-0.5 text-[9px] font-bold text-purple-600 ring-1 ring-purple-200">{t.batchGroup}</span>}</TableCell>
                  <TableCell><Link to={`/orders/${t.orderNumber}`} className="text-[13px] font-medium text-sky-700 hover:underline">{t.orderNumber}</Link></TableCell>
                  <TableCell className="text-[12px] text-slate-600">{t.picker}</TableCell>
                  <TableCell className="text-[12px] text-slate-600">Zone {t.zone}</TableCell>
                  <TableCell className="tabular-nums text-[13px]">{t.itemCount}</TableCell>
                  <TableCell><PriorityBadge value={t.priority} className="px-1.5 py-0 text-[10px]" /></TableCell>
                  <TableCell className="tabular-nums text-[12px] text-slate-600">{t.estimatedMinutes}m</TableCell>
                  <TableCell><SlaChip minsLeft={t.slaMinsLeft} /></TableCell>
                  <TableCell><TaskStatusBadge value={t.status} className="px-1.5 py-0 text-[10px]" /></TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1.5">
                      {t.status === "waiting" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 border-white/70 bg-white/60 text-xs" onClick={() => assignPicker({ taskId: t.id, picker: PICKERS[(t.id as string).length % PICKERS.length] }).then(() => toast.success("Picker assigned"))}>
                          <UserCheck className="size-3" /> Assign
                        </Button>
                      )}
                      {t.status === "assigned" && (
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => startPicking({ taskId: t.id }).then(() => toast.success("Started"))}>
                          <Play className="size-3" /> Start
                        </Button>
                      )}
                      {t.status === "in_progress" && (
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => completePicking({ taskId: t.id }).then(() => toast.success("Completed"))}>
                          <CheckCircle2 className="size-3" /> Complete
                        </Button>
                      )}
                      {t.status === "completed" && <span className="text-xs font-medium text-emerald-600">Done {timeAgo(t.completedAt ?? 0)}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data.rows.length === 0 && <EmptyState icon={PackageSearch} title="No picking tasks" message="Tasks are created when orders reach the picking stage." />}
      </GlassPanel>
    </div>
  );
}
