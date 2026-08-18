import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, GlassPanel, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Search } from "lucide-react";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function AuditLog() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const data = useQuery(api.queries.auditLogList, { limit });

  if (!data) return <LoadingBlock label="Loading audit trail…" />;

  const needle = q.trim().toLowerCase();
  const rows = needle ? data.filter((a) => (a.action + " " + (a.entityId ?? "") + " " + a.user + " " + (a.newState ?? "")).toLowerCase().includes(needle)) : data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        subtitle="Every important action — allocations, picks, QC, exceptions, dispatches and AI decisions — is recorded with the user, timestamp and state transition."
        icon={History}
        actions={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter audit trail…" className="glass-chip h-9 border-0 pl-9 shadow-none" />
          </div>
        }
      />

      <GlassPanel className="overflow-hidden p-0" strong>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="No audit entries" message="Operations are logged as they happen." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/60 bg-white/40 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Timestamp</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">User</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Action</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entity</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Transition</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-white/50 transition-colors hover:bg-sky-50/30">
                      <td className="whitespace-nowrap px-5 py-2.5 text-[11px] tabular-nums text-muted-foreground">{dateTime(a.timestamp)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[12px] font-medium text-slate-700">{a.user}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-700">{a.action}</td>
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-sky-700">{a.entityId}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500 ring-1 ring-slate-200/70">{a.prevState ?? "—"}</span>
                          <span className="text-slate-300">→</span>
                          <span className={cn("rounded-md px-2 py-0.5 font-medium ring-1", a.newState?.toLowerCase().includes("resolved") || a.newState?.toLowerCase().includes("approved") || a.newState?.toLowerCase().includes("passed") || a.newState?.toLowerCase().includes("completed") ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-sky-50 text-sky-700 ring-sky-200")}>{a.newState ?? "—"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-white/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">{rows.length} entries shown</p>
              <Button size="sm" variant="outline" className="h-7 border-white/70 bg-white/60 text-xs" onClick={() => setLimit((l) => l + 40)}>
                Load more
              </Button>
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
