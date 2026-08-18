import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { initials, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { LiveDot, StatusPill } from "@/components/ui-parts";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  ChevronsLeft,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  PackageSearch,
  Play,
  Search,
  Settings,
  Sparkles,
  Split,
  Truck,
  Warehouse,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type Role = "manager" | "operator" | "supervisor" | "admin";

const ROLE_LABELS: Record<Role, string> = {
  manager: "Warehouse Manager",
  operator: "Warehouse Operator",
  supervisor: "Supervisor",
  admin: "Admin",
};

const ALL_ROLES: Role[] = ["manager", "operator", "supervisor", "admin"];

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: string;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES, section: "Operations" },
  { to: "/orders", label: "Orders", icon: ClipboardList, roles: ALL_ROLES, section: "Operations" },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: ALL_ROLES, section: "Operations" },
  { to: "/allocation", label: "Allocation", icon: Split, roles: ["manager", "supervisor", "admin"], section: "Operations" },
  { to: "/picking", label: "Picking", icon: PackageSearch, roles: ALL_ROLES, section: "Operations" },
  { to: "/packing", label: "Packing", icon: PackageCheck, roles: ALL_ROLES, section: "Operations" },
  { to: "/dispatch", label: "Dispatch", icon: Truck, roles: ALL_ROLES, section: "Operations" },
  { to: "/exceptions", label: "Exceptions", icon: AlertTriangle, roles: ["manager", "supervisor", "admin"], section: "Operations" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["manager", "admin"], section: "Intelligence" },
  { to: "/recommendations", label: "AI Recommendations", icon: Sparkles, roles: ["manager", "supervisor", "admin"], section: "Intelligence" },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ALL_ROLES, section: "System" },
  { to: "/audit", label: "Audit Log", icon: History, roles: ["manager", "admin"], section: "System" },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["manager", "admin"], section: "System" },
];

const SCENARIOS: { id: string; title: string; desc: string; color: string }[] = [
  { id: "inventory_shortage", title: "Inventory Shortage", desc: "Urgent order exceeds available inventory (WH-204: 7 vs 10)", color: "text-red-600" },
  { id: "picking_bottleneck", title: "Picking Bottleneck", desc: "Zone B becomes overloaded with picking tasks", color: "text-amber-600" },
  { id: "damaged_item", title: "Damaged Item", desc: "A picked item is reported damaged at packing", color: "text-rose-600" },
  { id: "sla_risk", title: "SLA Risk", desc: "ORD-1046 is approaching its deadline (45m left)", color: "text-orange-600" },
  { id: "stockout_risk", title: "Stockout Risk", desc: "Demand forecast indicates an upcoming stockout (WH-813)", color: "text-purple-600" },
];

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useQuery(api.queries.globalSearch, q.length >= 2 ? { q } : "skip");
  const navigate = useNavigate();

  const go = (path: string) => {
    setOpen(false);
    setQ("");
    navigate(path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="glass-chip group flex w-full max-w-sm items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-slate-700 sm:w-72 lg:w-96">
          <Search className="size-4 text-slate-400" />
          <span className="flex-1 text-left">Search orders, SKUs, shipments…</span>
          <kbd className="hidden rounded-md border border-white/70 bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">⌘K</kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="glass-panel-strong w-[min(92vw,480px)] rounded-2xl p-0">
        <div className="flex items-center gap-2 border-b border-white/60 px-3">
          <Search className="size-4 text-slate-400" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try ORD-1048, WH-204, BlueDart…"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {q.length < 2 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Type at least 2 characters to search across orders, inventory, exceptions, picking tasks and shipments.</p>}
          {q.length >= 2 && results && (
            <div className="space-y-3">
              {results.orders.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Orders</p>
                  {results.orders.map((o) => (
                    <button key={o.orderNumber} onClick={() => go(`/orders/${o.orderNumber}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-sky-50/70">
                      <span className="text-sm font-medium text-slate-700">{o.orderNumber} · {o.customerName}</span>
                      <span className="text-xs text-muted-foreground capitalize">{o.status}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.inventory.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Inventory</p>
                  {results.inventory.map((i) => (
                    <button key={i.sku} onClick={() => go(`/inventory/${i.sku}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-sky-50/70">
                      <span className="text-sm font-medium text-slate-700">{i.sku} · {i.productName}</span>
                      <span className="text-xs text-muted-foreground capitalize">{i.status.replace("_", " ")}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.exceptions.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Exceptions</p>
                  {results.exceptions.map((e) => (
                    <button key={e.exceptionNumber} onClick={() => go("/exceptions")} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-sky-50/70">
                      <span className="text-sm font-medium text-slate-700">{e.exceptionNumber} · {e.type.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground capitalize">{e.status.replace("_", " ")}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.picking.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Picking</p>
                  {results.picking.map((t) => (
                    <button key={t.taskNumber} onClick={() => go("/picking")} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-sky-50/70">
                      <span className="text-sm font-medium text-slate-700">{t.taskNumber} · {t.orderNumber}</span>
                      <span className="text-xs text-muted-foreground">{t.zone}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.shipments.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Shipments</p>
                  {results.shipments.map((s) => (
                    <button key={s.shipmentNumber} onClick={() => go("/dispatch")} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-sky-50/70">
                      <span className="text-sm font-medium text-slate-700">{s.shipmentNumber} · {s.carrier}</span>
                      <span className="text-xs text-muted-foreground">{s.destination}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.customers.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customers</p>
                  {results.customers.map((c) => (
                    <button key={c.name} onClick={() => go("/orders")} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-sky-50/70">
                      <span className="text-sm font-medium text-slate-700">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.orderCount} orders</span>
                    </button>
                  ))}
                </div>
              )}
              {results.orders.length === 0 && results.inventory.length === 0 && results.exceptions.length === 0 && results.picking.length === 0 && results.shipments.length === 0 && results.customers.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matches for “{q}”.</p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationsBell() {
  const data = useQuery(api.queries.notificationsList);
  const markRead = useMutation(api.warehouse.markNotificationRead);
  const markAll = useMutation(api.warehouse.markAllNotificationsRead);
  const navigate = useNavigate();
  const unread = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="glass-chip relative flex size-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:text-slate-800">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white/80">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="glass-panel-strong w-[min(92vw,380px)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-white/60 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Notifications</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAll().then(() => toast.success("All notifications marked as read"))}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[380px]">
          {data?.rows.length === 0 && <p className="px-4 py-10 text-center text-xs text-muted-foreground">No notifications yet.</p>}
          {data?.rows.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) markRead({ id: n.id });
                if (n.link) navigate(n.link);
              }}
              className={cn("flex w-full items-start gap-3 border-b border-white/50 px-4 py-3 text-left transition-colors hover:bg-sky-50/50", !n.read && "bg-sky-50/40")}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.severity === "critical" ? "bg-red-500" : n.severity === "high" ? "bg-amber-500" : n.severity === "medium" ? "bg-orange-400" : "bg-sky-400")} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", n.read ? "font-medium text-slate-600" : "font-semibold text-slate-800")}>{n.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{n.message}</span>
              </span>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function DemoModeDialog() {
  const meta = useQuery(api.queries.meta);
  const runScenario = useMutation(api.demo.runScenario);
  const setDemoMode = useMutation(api.demo.setDemoMode);
  const [busy, setBusy] = useState<string | null>(null);
  const enabled = meta?.demo?.demoMode ?? false;
  const active = meta?.demo?.activeScenario;

  const run = async (id: string) => {
    setBusy(id);
    try {
      const res = await runScenario({ scenario: id });
      toast.success(res.ok ? `Scenario loaded — ${res.message ?? "review the AI decision."}` : res.error);
    } catch {
      toast.error("Failed to run scenario");
    }
    setBusy(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 border-white/70 bg-white/60 backdrop-blur-md", enabled && "border-purple-200 bg-purple-50 text-purple-700")}>
          <Zap className={cn("size-3.5", enabled ? "text-purple-600" : "text-slate-400")} />
          Demo Mode
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel-strong rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Sparkles className="size-5 text-purple-600" />
            Demo Mode
          </DialogTitle>
          <DialogDescription>
            Run a predefined operational scenario. Each one follows the same arc: <b>Problem → AI Decision → User Approval → Resolution</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border border-white/70 bg-white/50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Scenario mode</p>
            <p className="text-xs text-muted-foreground">{enabled ? `Active: ${SCENARIOS.find((s) => s.id === active)?.title ?? "none"} — data restored & ready` : "Disabled — warehouse data is live"}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => setDemoMode({ enabled: v }).then(() => toast(v ? "Demo mode enabled" : "Demo mode disabled"))} />
        </div>

        <div className="space-y-2">
          {SCENARIOS.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/50 px-4 py-3">
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", s.color)}>{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Button size="sm" variant={active === s.id ? "secondary" : "default"} disabled={busy !== null} onClick={() => run(s.id)}>
                {busy === s.id ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Play className="size-3.5" />}
                {active === s.id ? "Re-run" : "Run"}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Tip: run <b>Inventory Shortage</b> first — it recreates the flagship conflict (ORD-1052 needs 10 × WH-204, only 7 available) and sets up the full
          exception → decision → resolution workflow across Dashboard, Allocation, Exceptions and AI Recommendations.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ProfileMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const myRole = useQuery(api.queries.myRole) as Role | undefined;
  const setRole = useMutation(api.warehouse.setDemoRole);
  const displayName = user?.displayName || user?.name || user?.email?.split("@")[0] || "Operator";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-white/60">
          <Avatar className="size-8 border border-white/80 bg-gradient-to-br from-sky-400 to-indigo-500">
            <AvatarFallback className="bg-transparent text-[11px] font-bold text-white">{initials(displayName)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left lg:block">
            <span className="block max-w-[120px] truncate text-xs font-semibold text-slate-800">{displayName}</span>
            <span className="block text-[10px] text-muted-foreground">{ROLE_LABELS[myRole ?? "manager"]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-panel-strong w-60 rounded-2xl">
        <DropdownMenuLabel className="text-slate-900">{displayName}</DropdownMenuLabel>
        <DropdownMenuLabel className="pt-0 text-[11px] font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-medium text-slate-500">Demo role — changes the UI</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={myRole ?? "manager"}
          onValueChange={(v) => setRole({ role: v as Role }).then(() => toast.success(`Switched to ${ROLE_LABELS[v as Role]}`))}
        >
          {ALL_ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r} className="cursor-pointer">
              {ROLE_LABELS[r]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
          <Settings className="mr-2 size-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [zone, setZone] = useState("Zone A");
  const { user } = useAuth();
  const myRole = (useQuery(api.queries.myRole) as Role | undefined) ?? "manager";
  const meta = useQuery(api.queries.meta);
  const zones = useQuery(api.queries.warehouseZones);
  const dash = useQuery(api.queries.dashboardStats);
  const seed = useMutation(api.seed.seedEverything);
  const bootstrap = useMutation(api.warehouse.bootstrapUser);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current || !user) return;
    bootstrapped.current = true;
    bootstrap().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (meta && meta.counts.orders === 0 && user) {
      toast.info("Seeding demo warehouse data…");
      seed({}).then((res) => {
        if (res.seeded) toast.success(`Seeded ${res.products} SKUs and ${res.orders} orders`);
        else toast.success("Warehouse data ready");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, user]);

  const atRisk = dash?.metrics.atRisk ?? 0;
  const criticalExc = dash?.metrics.openCriticalExc ?? 0;
  const needsAttention = atRisk > 0 || criticalExc > 0;

  const visibleNav = useMemo(() => NAV.filter((n) => n.roles.includes(myRole)), [myRole]);
  const sections = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of visibleNav) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return [...map.entries()];
  }, [visibleNav]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn("glass-nav relative z-20 flex shrink-0 flex-col transition-all duration-300", collapsed ? "w-[72px]" : "w-64")}>
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30">
            <Warehouse className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-slate-900">SmartFulfill AI</p>
              <p className="truncate text-[10px] font-medium text-muted-foreground">{meta?.settings?.warehouseName ?? "Fulfilment Hub"}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
          {sections.map(([section, items]) => (
            <div key={section}>
              {!collapsed && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section}</p>}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all",
                          collapsed && "justify-center px-0",
                          isActive
                            ? "bg-white/80 text-sky-700 shadow-sm ring-1 ring-white/80"
                            : "text-slate-600 hover:bg-white/55 hover:text-slate-900",
                        )
                      }
                      title={item.label}
                    >
                      <Icon className={cn("size-4 shrink-0", collapsed && "size-5")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/50 p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-800"
          >
            <ChevronsLeft className={cn("size-4 transition-transform duration-300", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass-nav flex h-16 shrink-0 items-center gap-3 border-b border-white/50 px-4 sm:px-6">
          <GlobalSearch />
          <div className="flex-1" />
          <DemoModeDialog />
          <div className="hidden items-center gap-2 xl:flex">
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="glass-chip h-9 gap-2 border-0 shadow-none">
                <Warehouse className="size-3.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-panel-strong rounded-xl">
                {zones?.map((z) => (
                  <SelectItem key={z.zone} value={z.zone}>
                    {z.zone} · {z.skus} SKUs
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <StatusPill tone={needsAttention ? "warn" : "good"}>
            <LiveDot color={needsAttention ? "bg-amber-500" : "bg-emerald-500"} />
            <span className="hidden sm:inline">{needsAttention ? `${atRisk} orders need attention` : "All systems nominal"}</span>
          </StatusPill>
          <NotificationsBell />
          <ProfileMenu />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
