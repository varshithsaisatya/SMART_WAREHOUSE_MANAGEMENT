import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import {
  PageHeader,
  GlassPanel,
  PriorityBadge,
  StatusBadge,
  RiskBadge,
  SlaChip,
  ScoreRing,
  LoadingBlock,
  EmptyState,
  STATUS_LABELS,
} from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Search, ArrowUpDown } from "lucide-react";
import { dateShort, inr } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["all", "created", "confirmed", "allocated", "picking", "packing", "quality_check", "ready", "dispatched", "delivered", "exception", "cancelled"];
const PRIORITY_OPTIONS = ["all", "critical", "high", "normal", "low"];
const RISK_OPTIONS = ["all", "critical", "high", "medium", "low"];
const ZONE_OPTIONS = ["all", "A", "B", "C", "D"];
const SORT_OPTIONS = [
  { value: "priority", label: "Priority score" },
  { value: "created", label: "Newest first" },
  { value: "value", label: "Order value" },
  { value: "sla", label: "SLA urgency" },
  { value: "number", label: "Order number" },
];

const PAGE_SIZE = 14;

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [risk, setRisk] = useState("all");
  const [zone, setZone] = useState("all");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(0);

  const rows = useQuery(api.queries.ordersList, { search, status, priority, risk, zone, sort });

  const paged = useMemo(() => {
    if (!rows) return [];
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const counts = useMemo(() => {
    if (!rows) return { critical: 0, high: 0, atRisk: 0 };
    return {
      critical: rows.filter((r) => r.risk === "critical").length,
      high: rows.filter((r) => r.risk === "high").length,
      atRisk: rows.filter((r) => r.risk === "high" || r.risk === "critical").length,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Order Management"
        subtitle="Every order is prioritized by the decision engine — SLA urgency, customer tier, value, stock readiness and progress."
        icon={ClipboardList}
        actions={
          <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
            <span className="text-slate-500">At risk:</span>
            <span className="font-bold text-amber-600">{counts.atRisk}</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-slate-500">Critical:</span>
            <span className="font-bold text-red-600">{counts.critical}</span>
          </div>
        }
      />

      {/* Filters */}
      <GlassPanel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search order #, customer, city…" className="glass-chip h-9 border-0 pl-9 shadow-none" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[150px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : (STATUS_LABELS[s] ?? s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[130px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p === "all" ? "All priorities" : p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={risk} onValueChange={(v) => { setRisk(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[120px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {RISK_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r === "all" ? "All risks" : r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={zone} onValueChange={(v) => { setZone(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[110px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {ZONE_OPTIONS.map((z) => <SelectItem key={z} value={z} className="capitalize">{z === "all" ? "All zones" : `Zone ${z}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="glass-chip h-9 w-[160px] border-0 shadow-none">
              <ArrowUpDown className="size-3.5 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassPanel>

      {/* Table */}
      <GlassPanel className="overflow-hidden p-0" strong>
        {!rows ? (
          <LoadingBlock label="Loading orders…" />
        ) : paged.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No orders match" message="Try clearing filters or searching for a different order number." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                    <TableHead className="pl-5">Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((o) => (
                    <TableRow key={o.id} className="group border-white/50 transition-colors hover:bg-sky-50/40">
                      <TableCell className="pl-5">
                        <Link to={`/orders/${o.orderNumber}`} className="flex items-center gap-2.5">
                          <ScoreRing score={o.priorityScore} size={34} />
                          <span>
                            <span className="block text-[13px] font-semibold text-sky-700 group-hover:underline">{o.orderNumber}</span>
                            <span className="block text-[11px] text-muted-foreground">{dateShort(o.createdAt)} · {o.customerTier} tier</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="block text-[13px] font-medium text-slate-700">{o.customerName}</span>
                        <span className="block text-[11px] text-muted-foreground">{o.customerCity}{o.zone ? ` · Zone ${o.zone}` : ""}</span>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge value={o.priority} className="px-1.5 py-0 text-[10px]" />
                      </TableCell>
                      <TableCell>
                        <SlaChip minsLeft={o.slaMinsLeft} />
                      </TableCell>
                      <TableCell className="tabular-nums text-[13px] text-slate-600">{o.itemCount}</TableCell>
                      <TableCell className="tabular-nums text-[13px] font-semibold text-slate-800">{inr(o.totalValue)}</TableCell>
                      <TableCell><StatusBadge value={o.status} className="px-1.5 py-0 text-[10px]" /></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <RiskBadge value={o.risk} className="px-1.5 py-0 text-[10px]" />
                          <span className={cn("max-w-[150px] truncate text-[10px]", o.risk === "low" ? "text-slate-400" : "text-slate-500")}>{o.riskReason}</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button asChild size="sm" variant="outline" className="h-7 border-white/70 bg-white/60 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                          <Link to={`/orders/${o.orderNumber}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-white/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {paged.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + paged.length} of {rows.length} orders
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 border-white/70 bg-white/60 text-xs" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" className="h-7 border-white/70 bg-white/60 text-xs" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
