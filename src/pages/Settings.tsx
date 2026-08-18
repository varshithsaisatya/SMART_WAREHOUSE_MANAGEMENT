import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { PageHeader, GlassPanel, SectionTitle, LoadingBlock } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { Check, Settings as SettingsIcon, ShieldCheck, UserRound, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "manager", label: "Warehouse Manager", desc: "Full access and analytics" },
  { id: "supervisor", label: "Supervisor", desc: "Approvals, exceptions, allocation decisions" },
  { id: "operator", label: "Warehouse Operator", desc: "Orders, picking, packing, inventory updates" },
  { id: "admin", label: "Admin", desc: "Settings and user management" },
] as const;

const PERMISSIONS = [
  { key: "dashboard", label: "Dashboard & KPIs" },
  { key: "orders", label: "Orders & order details" },
  { key: "inventory", label: "Inventory & reorder" },
  { key: "allocation", label: "Allocation approvals" },
  { key: "picking", label: "Picking tasks" },
  { key: "packing", label: "Packing & QC" },
  { key: "dispatch", label: "Dispatch & shipments" },
  { key: "exceptions", label: "Exception resolution" },
  { key: "analytics", label: "Analytics & insights" },
  { key: "ai", label: "AI recommendations" },
  { key: "audit", label: "Audit log" },
  { key: "settings", label: "Settings & users" },
];

const ROLE_ACCESS: Record<string, string[]> = {
  manager: ["dashboard", "orders", "inventory", "allocation", "picking", "packing", "dispatch", "exceptions", "analytics", "ai", "audit", "settings"],
  supervisor: ["dashboard", "orders", "inventory", "allocation", "picking", "packing", "dispatch", "exceptions", "ai"],
  operator: ["dashboard", "orders", "inventory", "picking", "packing", "dispatch"],
  admin: ["dashboard", "orders", "inventory", "allocation", "picking", "packing", "dispatch", "exceptions", "analytics", "ai", "audit", "settings"],
};

export default function Settings() {
  const meta = useQuery(api.queries.meta);
  const myRole = useQuery(api.queries.myRole) as string | undefined;
  const setRole = useMutation(api.warehouse.setDemoRole);
  const updateSettings = useMutation(api.warehouse.updateSettings);
  const { user } = useAuth();

  const [form, setForm] = useState({ warehouseName: "", defaultSlaHours: "24", lowStockThresholdPct: "20", reorderMultiplier: "1.2", slaUrgencyWindowMinutes: "180" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meta?.settings) {
      setForm({
        warehouseName: meta.settings.warehouseName,
        defaultSlaHours: String(meta.settings.defaultSlaHours),
        lowStockThresholdPct: String(meta.settings.lowStockThresholdPct),
        reorderMultiplier: String(meta.settings.reorderMultiplier),
        slaUrgencyWindowMinutes: String(meta.settings.slaUrgencyWindowMinutes),
      });
    }
  }, [meta]);

  if (!meta || !meta.settings) return <LoadingBlock label="Loading settings…" />;

  const save = async () => {
    setSaving(true);
    const res = await updateSettings({
      warehouseName: form.warehouseName,
      defaultSlaHours: Number(form.defaultSlaHours) || 24,
      lowStockThresholdPct: Number(form.lowStockThresholdPct) || 20,
      reorderMultiplier: Number(form.reorderMultiplier) || 1.2,
      slaUrgencyWindowMinutes: Number(form.slaUrgencyWindowMinutes) || 180,
    });
    setSaving(false);
    if (res.ok) toast.success("Settings saved and logged to audit");
    else toast.error(res.error ?? "Failed to save");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Warehouse configuration, priority/SLA rules, and role-based access for the demo." icon={SettingsIcon} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Warehouse settings */}
        <GlassPanel className="p-5">
          <SectionTitle title="Warehouse settings" action={<Warehouse className="size-4 text-slate-400" />} />
          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-xs font-medium text-slate-600">Warehouse name</Label>
              <Input value={form.warehouseName} onChange={(e) => setForm({ ...form, warehouseName: e.target.value })} className="glass-chip mt-1.5 h-9 border-0 shadow-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">Default SLA (hours)</Label>
                <Input type="number" value={form.defaultSlaHours} onChange={(e) => setForm({ ...form, defaultSlaHours: e.target.value })} className="glass-chip mt-1.5 h-9 border-0 shadow-none" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">SLA urgency window (min)</Label>
                <Input type="number" value={form.slaUrgencyWindowMinutes} onChange={(e) => setForm({ ...form, slaUrgencyWindowMinutes: e.target.value })} className="glass-chip mt-1.5 h-9 border-0 shadow-none" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Low stock threshold (%)</Label>
                <Input type="number" value={form.lowStockThresholdPct} onChange={(e) => setForm({ ...form, lowStockThresholdPct: e.target.value })} className="glass-chip mt-1.5 h-9 border-0 shadow-none" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Reorder safety multiplier</Label>
                <Input type="number" step="0.1" value={form.reorderMultiplier} onChange={(e) => setForm({ ...form, reorderMultiplier: e.target.value })} className="glass-chip mt-1.5 h-9 border-0 shadow-none" />
              </div>
            </div>
            <Button className="gap-1.5 shadow-md shadow-sky-500/25" disabled={saving} onClick={save}>
              {saving ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="size-4" />}
              Save settings
            </Button>
          </div>
        </GlassPanel>

        {/* Role permissions */}
        <GlassPanel className="p-5">
          <SectionTitle title="Role permissions" action={<ShieldCheck className="size-4 text-slate-400" />} />
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/60 bg-white/40 hover:bg-white/40">
                  <TableHead className="pl-3 text-[11px]">Permission</TableHead>
                  {ROLES.map((r) => (
                    <TableHead key={r.id} className="text-center text-[10px] uppercase tracking-wide">{r.label.split(" ")[0]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSIONS.map((p) => (
                  <TableRow key={p.key} className="border-white/50">
                    <TableCell className="pl-3 text-[12px] text-slate-700">{p.label}</TableCell>
                    {ROLES.map((r) => (
                      <TableCell key={r.id} className="text-center">
                        <span className={cn("mx-auto inline-flex size-5 items-center justify-center rounded-full", ROLE_ACCESS[r.id].includes(p.key) ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-300 ring-1 ring-slate-200/60")}>
                          {ROLE_ACCESS[r.id].includes(p.key) && <Check className="size-3" />}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassPanel>
      </div>

      {/* User management */}
      <GlassPanel className="p-5">
        <SectionTitle title="User management (demo)" action={<UserRound className="size-4 text-slate-400" />} />
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/75 bg-white/55 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-bold text-white">
                {(user?.displayName || user?.name || "U").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800">{user?.displayName || user?.name || "Signed-in user"}</p>
                <p className="text-[11px] text-muted-foreground">{user?.email ?? "Guest session"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Current demo role:</span>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200">
                {ROLES.find((r) => r.id === myRole)?.label ?? "Warehouse Manager"}
              </span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole({ role: r.id }).then(() => toast.success(`Role switched to ${r.label}`))}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  myRole === r.id ? "border-sky-300 bg-sky-50/70 shadow-sm ring-1 ring-sky-200" : "border-white/75 bg-white/50 hover:bg-white/75",
                )}
              >
                <span className={cn("mt-0.5 size-2.5 rounded-full", myRole === r.id ? "bg-sky-500" : "bg-slate-300")} />
                <span>
                  <span className="block text-[13px] font-semibold text-slate-800">{r.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{r.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Role changes update the sidebar navigation and page access instantly. In production this maps to real RBAC on the users table.
          </p>
        </div>
      </GlassPanel>
    </div>
  );
}
