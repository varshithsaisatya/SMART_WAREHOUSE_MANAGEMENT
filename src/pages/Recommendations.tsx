import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, SeverityDot, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Eye, Lightbulb, Sparkles, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "order_priority", label: "Order Priority" },
  { value: "inventory", label: "Inventory" },
  { value: "picking", label: "Picking" },
  { value: "replenishment", label: "Replenishment" },
  { value: "exception", label: "Exceptions" },
  { value: "dispatch", label: "Dispatch" },
  { value: "bottleneck", label: "Bottlenecks" },
];

const CATEGORY_LABELS: Record<string, string> = {
  order_priority: "Order Priority",
  inventory: "Inventory",
  picking: "Picking",
  replenishment: "Replenishment",
  exception: "Exceptions",
  dispatch: "Dispatch",
  bottleneck: "Bottlenecks",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  applied: "Applied",
  ignored: "Ignored",
};

export default function Recommendations() {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("pending");
  const data = useQuery(api.queries.recommendationsList, { category, status });
  const approve = useMutation(api.warehouse.approveRecommendation);
  const ignore = useMutation(api.warehouse.ignoreRecommendation);
  const navigate = useNavigate();

  if (!data) return <LoadingBlock label="Loading AI recommendations…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Operations Advisor"
        subtitle="Every recommendation is computed from live warehouse data by the Smart Decision Engine — problem, reasoning, decision, impact."
        icon={Sparkles}
        actions={
          <span className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
            <Lightbulb className="size-3.5 text-purple-600" />
            <span className="text-slate-500">Pending:</span>
            <span className="font-bold text-slate-800">{data.filter((r) => r.status === "pending").length}</span>
          </span>
        }
      />

      <GlassPanel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="glass-chip h-9 w-[180px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="glass-chip h-9 w-[140px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {["pending", "approved", "applied", "ignored"].map((s) => <SelectItem key={s} value={s} className="capitalize">{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-2">
        {data.map((r) => (
          <GlassPanel key={r.id} className={cn("flex flex-col p-5", r.status === "pending" ? "border-purple-200/50" : "border-white/70")}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200/70">
                <Sparkles className="size-3" /> {CATEGORY_LABELS[r.category] ?? r.category}
              </span>
              <div className="flex items-center gap-2">
                <SeverityDot value={r.severity} />
                <Badge variant="outline" className={cn("font-medium", r.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200/80" : r.status === "applied" ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" : r.status === "approved" ? "bg-sky-50 text-sky-700 border-sky-200/80" : "bg-slate-100 text-slate-500 border-slate-200/80")}>
                  {STATUS_LABELS[r.status]}
                </Badge>
              </div>
            </div>

            <p className="mt-3 text-[15px] font-bold text-slate-900">{r.title}</p>

            <div className="mt-3 space-y-2.5 text-[13px] leading-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Problem</p>
                <p className="mt-0.5 text-slate-700">{r.problem}</p>
              </div>
              <div className="rounded-lg bg-sky-50/70 px-3 py-2 ring-1 ring-sky-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Why it matters</p>
                <p className="mt-0.5 text-[12px] leading-4 text-sky-800">{r.reasoning}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recommended decision</p>
                <p className="mt-0.5 font-medium text-slate-800">{r.recommendedAction}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Expected impact</p>
                <p className="mt-0.5 text-emerald-800">{r.impact}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3">
              {r.status === "pending" ? (
                <>
                  <Button size="sm" className="gap-1.5" onClick={() => approve({ recId: r.id }).then((res) => (res.ok ? toast.success(res.applied ? "Approved — decision applied to operations" : "Recommendation approved") : toast.error(res.error ?? "Failed")))}>
                    <CheckCircle2 className="size-3.5" /> Approve
                  </Button>
                  {r.orderNumber && (
                    <Button size="sm" variant="outline" className="gap-1.5 border-white/70 bg-white/60" onClick={() => navigate(`/orders/${r.orderNumber}`)}>
                      <Eye className="size-3.5" /> View order
                    </Button>
                  )}
                  {r.sku && (
                    <Button size="sm" variant="outline" className="gap-1.5 border-white/70 bg-white/60" onClick={() => navigate(`/inventory/${r.sku}`)}>
                      <Eye className="size-3.5" /> View SKU
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 text-slate-500" onClick={() => ignore({ recId: r.id }).then(() => toast("Recommendation ignored"))}>
                    <X className="size-3.5" /> Ignore
                  </Button>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Processed {r.resolvedAt ? timeAgo(r.resolvedAt) : ""}</span>
              )}
            </div>
          </GlassPanel>
        ))}
      </div>

      {data.length === 0 && (
        <GlassPanel className="p-5">
          <EmptyState icon={Sparkles} title="No recommendations in this view" message="The engine raises recommendations when it detects real operational risks. Try the Inventory Shortage demo." />
        </GlassPanel>
      )}
    </div>
  );
}
