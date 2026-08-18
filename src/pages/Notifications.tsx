import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PageHeader, GlassPanel, LoadingBlock, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  sla: "SLA",
  urgent: "Urgent",
  picking: "Picking",
  qc: "QC",
  damaged: "Damaged",
  dispatch: "Dispatch",
  ai: "AI",
  exception: "Exception",
  system: "System",
};

export default function Notifications() {
  const data = useQuery(api.queries.notificationsList);
  const markRead = useMutation(api.warehouse.markNotificationRead);
  const markAll = useMutation(api.warehouse.markAllNotificationsRead);
  const navigate = useNavigate();

  if (!data) return <LoadingBlock label="Loading notifications…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle="Operational alerts from the decision engine — critical stock, SLA risk, QC failures, dispatch delays and AI recommendations."
        icon={BellRing}
        actions={
          <div className="flex items-center gap-2">
            <span className="glass-chip rounded-xl px-3 py-1.5 text-xs font-medium">
              <span className="text-slate-500">Unread:</span> <span className="font-bold text-slate-800">{data.unreadCount}</span>
            </span>
            <Button variant="outline" size="sm" className="gap-1.5 border-white/70 bg-white/60" onClick={() => markAll().then(() => toast.success("All notifications marked as read"))}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          </div>
        }
      />

      <GlassPanel className="overflow-hidden p-0" strong>
        {data.rows.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" message="Alerts from the engine will appear here." />
        ) : (
          <div className="divide-y divide-white/60">
            {data.rows.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead({ id: n.id });
                  if (n.link) navigate(n.link);
                }}
                className={cn("flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-sky-50/40", !n.read && "bg-sky-50/30")}
              >
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", n.severity === "critical" ? "bg-red-500" : n.severity === "high" ? "bg-amber-500" : n.severity === "medium" ? "bg-orange-400" : "bg-sky-400")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-[13px]", n.read ? "font-medium text-slate-600" : "font-semibold text-slate-900")}>{n.title}</p>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/70">{TYPE_LABELS[n.type] ?? n.type}</span>
                    {n.orderNumber && <span className="text-[11px] font-medium text-sky-700">{n.orderNumber}</span>}
                    {n.sku && <span className="text-[11px] font-medium text-sky-700">{n.sku}</span>}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{n.message}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  {!n.read && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">NEW</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
