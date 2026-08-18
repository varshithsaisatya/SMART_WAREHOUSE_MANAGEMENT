import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, ExcTypeBadge, ExcStatusBadge, SeverityDot, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowDown, CheckCircle2, ChevronUp, Lightbulb, Siren, UserRound } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = ["all", "damaged", "missing", "mismatch", "picking_delay", "packing_error", "qc_failure", "dispatch_delay", "stockout", "sla_risk"];
const STATUS_OPTIONS = ["all", "open", "investigating", "action_required", "resolved", "escalated"];

export default function Exceptions() {
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const data = useQuery(api.queries.exceptionsList, { status, type });
  const resolveExc = useMutation(api.warehouse.resolveException);
  const escalateExc = useMutation(api.warehouse.escalateException);

  if (!data) return <LoadingBlock label="Loading exceptions…" />;

  const openCount = data.filter((e) => e.status !== "resolved").length;
  const criticalCount = data.filter((e) => e.severity === "critical" && e.status !== "resolved").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exception Center"
        subtitle="Every exception flows through Exception → Decision → Resolution, with an audit trail at each step."
        icon={Siren}
        actions={
          <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
            <span className="text-slate-500">Open:</span>
            <span className="font-bold text-slate-800">{openCount}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">Critical:</span>
            <span className="font-bold text-red-600">{criticalCount}</span>
          </div>
        }
      />

      <GlassPanel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="glass-chip h-9 w-[170px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="glass-chip h-9 w-[190px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t === "all" ? "All types" : t.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassPanel>

      <div className="space-y-3">
        {data.map((e) => {
          const isOpen = expanded === e.id;
          const sevCls =
            e.severity === "critical" ? "border-red-200/70" : e.severity === "high" ? "border-amber-200/70" : e.severity === "medium" ? "border-orange-200/60" : "border-white/75";
          return (
            <GlassPanel key={e.id} className={cn("p-0", sevCls)}>
              <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpanded(isOpen ? null : e.id)}>
                <SeverityDot value={e.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900">{e.exceptionNumber}</span>
                    <ExcTypeBadge value={e.type} />
                    <ExcStatusBadge value={e.status} className="px-1.5 py-0 text-[10px]" />
                    {e.orderNumber && <Link to={`/orders/${e.orderNumber}`} onClick={(ev) => ev.stopPropagation()} className="text-[12px] font-medium text-sky-700 hover:underline">{e.orderNumber}</Link>}
                    {e.sku && <Link to={`/inventory/${e.sku}`} onClick={(ev) => ev.stopPropagation()} className="text-[12px] font-medium text-sky-700 hover:underline">{e.sku}</Link>}
                  </div>
                  <p className="mt-1 truncate text-[12px] text-slate-600">{e.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden text-[11px] text-muted-foreground sm:block">{timeAgo(e.detectedAt)}</span>
                  {e.assignedUser && <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex"><UserRound className="size-3" /> {e.assignedUser}</span>}
                  {isOpen ? <ChevronUp className="size-4 text-slate-400" /> : <ArrowDown className="size-4 text-slate-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/60 px-4 pb-4 pt-3">
                  {/* 3-step workflow */}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/75 bg-white/55 p-3.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <AlertTriangle className="size-3.5 text-red-500" /> 1 · Exception
                      </p>
                      <p className="mt-1.5 text-[12px] leading-4 text-slate-700">{e.description}</p>
                      {e.sku && <p className="mt-1 text-[11px] text-muted-foreground">SKU {e.sku}</p>}
                    </div>
                    <div className="rounded-xl border border-white/75 bg-white/55 p-3.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Lightbulb className="size-3.5 text-amber-500" /> 2 · Decision
                      </p>
                      <p className="mt-1.5 text-[12px] leading-4 text-slate-700">{e.decision ?? "Pending approval"}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Suggested: {e.suggestedResolution}</p>
                    </div>
                    <div className="rounded-xl border border-white/75 bg-white/55 p-3.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <CheckCircle2 className="size-3.5 text-emerald-500" /> 3 · Resolution
                      </p>
                      <p className="mt-1.5 text-[12px] leading-4 text-slate-700">{e.resolution ?? "Awaiting approval of decision"}</p>
                      {e.resolvedAt && <p className="mt-1 text-[11px] text-muted-foreground">Resolved {timeAgo(e.resolvedAt)}</p>}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">Suggested resolution: {e.suggestedResolution}</p>
                    <div className="flex gap-2">
                      {e.status !== "resolved" && e.status !== "escalated" && (
                        <Button size="sm" className="gap-1.5" onClick={() => resolveExc({ excId: e.id }).then(() => toast.success(`${e.exceptionNumber} resolved — resolution recorded`))}>
                          <CheckCircle2 className="size-3.5" /> Approve resolution
                        </Button>
                      )}
                      {e.status !== "escalated" && e.status !== "resolved" && (
                        <Button size="sm" variant="outline" className="border-white/70 bg-white/60" onClick={() => escalateExc({ excId: e.id }).then(() => toast("Exception escalated"))}>
                          Escalate
                        </Button>
                      )}
                      {e.resolutionNote && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">{e.resolutionNote}</span>}
                    </div>
                  </div>
                </div>
              )}
            </GlassPanel>
          );
        })}
        {data.length === 0 && <EmptyState icon={AlertTriangle} title="No exceptions" message="The warehouse is running clean. Filter by type or status to explore." />}
      </div>
    </div>
  );
}
