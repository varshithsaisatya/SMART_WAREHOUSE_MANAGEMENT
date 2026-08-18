import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { PageHeader, GlassPanel, InvStatusBadge, RiskBadge, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, Search } from "lucide-react";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["all", "healthy", "low_stock", "critical", "out_of_stock", "overstock", "damaged"];
const ZONE_OPTIONS = ["all", "A", "B", "C", "D"];
const CATEGORY_OPTIONS = ["all", "Electronics", "Mobile Accessories", "Home & Kitchen", "Office", "Apparel", "Grocery & FMCG", "Sports & Fitness", "Stationery", "Tools & Hardware", "Pet Supplies"];
const SORT_OPTIONS = [
  { value: "risk", label: "Risk (low stock first)" },
  { value: "sku", label: "SKU" },
  { value: "name", label: "Product name" },
  { value: "value", label: "Unit price" },
];

const PAGE_SIZE = 16;

function StockBar({ available, reserved, reorderPoint }: { available: number; reserved: number; reorderPoint: number }) {
  const total = Math.max(available + reserved, reorderPoint, 1);
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/70">
        <div className="absolute inset-y-0 left-0 rounded-full bg-sky-400/80" style={{ width: pct(available) }} />
        <div className="absolute inset-y-0 rounded-full bg-indigo-300/70" style={{ left: pct(available), width: pct(reserved) }} />
        <div className="absolute inset-y-0 w-0.5 bg-amber-500/80" style={{ left: `${Math.min(100, (reorderPoint / total) * 100)}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">RP {reorderPoint}</span>
    </div>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [zone, setZone] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("risk");
  const [page, setPage] = useState(0);

  const rows = useQuery(api.queries.inventoryList, { search, status, zone, category, sort });
  const paged = useMemo(() => (rows ?? []).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [rows, page]);

  const summary = useMemo(() => {
    if (!rows) return null;
    return {
      critical: rows.filter((r) => r.status === "critical" || r.status === "out_of_stock").length,
      low: rows.filter((r) => r.status === "low_stock").length,
      damaged: rows.filter((r) => r.damaged > 0).length,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory Management"
        subtitle="Live stock positions per SKU with reorder points, risk flags and replenishment signals."
        icon={Boxes}
        actions={
          summary && (
            <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium">
              <span className="text-slate-500">Critical:</span>
              <span className="font-bold text-red-600">{summary.critical}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span className="text-slate-500">Low:</span>
              <span className="font-bold text-amber-600">{summary.low}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span className="text-slate-500">Damaged:</span>
              <span className="font-bold text-rose-600">{summary.damaged}</span>
            </div>
          )
        }
      />

      <GlassPanel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search SKU, product, bin…" className="glass-chip h-9 border-0 pl-9 shadow-none" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[150px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={zone} onValueChange={(v) => { setZone(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[110px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {ZONE_OPTIONS.map((z) => <SelectItem key={z} value={z} className="capitalize">{z === "all" ? "All zones" : `Zone ${z}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0); }}>
            <SelectTrigger className="glass-chip h-9 w-[170px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="glass-chip h-9 w-[190px] border-0 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-panel-strong rounded-xl">
              {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0" strong>
        {!rows ? (
          <LoadingBlock label="Loading inventory…" />
        ) : paged.length === 0 ? (
          <EmptyState icon={Boxes} title="No SKUs match" message="Adjust the filters to see more inventory." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                    <TableHead className="pl-5">SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Damaged</TableHead>
                    <TableHead>Stock level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="pr-5 text-right">Unit price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.id} className="group border-white/50 transition-colors hover:bg-sky-50/40">
                      <TableCell className="pl-5">
                        <Link to={`/inventory/${r.sku}`} className="text-[13px] font-semibold text-sky-700 group-hover:underline">{r.sku}</Link>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="block truncate text-[13px] text-slate-700">{r.productName}</span>
                        <span className="block text-[10px] text-muted-foreground">{r.category}</span>
                      </TableCell>
                      <TableCell className="text-[12px] text-slate-600">Zone {r.zone} · {r.bin}</TableCell>
                      <TableCell className={cn("text-right text-[13px] font-semibold tabular-nums", r.available <= r.reorderPoint ? "text-red-600" : "text-slate-800")}>{r.available}</TableCell>
                      <TableCell className="text-right tabular-nums text-[13px] text-slate-600">{r.reserved}</TableCell>
                      <TableCell className="text-right tabular-nums text-[13px] text-rose-500">{r.damaged > 0 ? r.damaged : "—"}</TableCell>
                      <TableCell><StockBar available={r.available} reserved={r.reserved} reorderPoint={r.reorderPoint} /></TableCell>
                      <TableCell><InvStatusBadge value={r.status} className="px-1.5 py-0 text-[10px]" /></TableCell>
                      <TableCell><RiskBadge value={r.risk} className="px-1.5 py-0 text-[10px]" /></TableCell>
                      <TableCell className="pr-5 text-right tabular-nums text-[13px] text-slate-700">{inr(r.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-white/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">Showing {paged.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + paged.length} of {rows.length} SKUs</p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 border-white/70 bg-white/60 text-xs" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                <Button size="sm" variant="outline" className="h-7 border-white/70 bg-white/60 text-xs" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
