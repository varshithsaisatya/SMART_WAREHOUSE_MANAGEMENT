import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { PageHeader, GlassPanel, SectionTitle, LoadingBlock } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Activity, BarChart3, CheckCircle2, Clock3, PackageCheck, Siren, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["oklch(0.55 0.16 252)", "oklch(0.62 0.12 190)", "oklch(0.52 0.11 320)", "oklch(0.72 0.13 84)", "oklch(0.64 0.18 32)"];

export default function Analytics() {
  const [range, setRange] = useState("30");
  const data = useQuery(api.queries.analyticsData, { range });
  const navigate = useNavigate();

  if (!data) return <LoadingBlock label="Crunching operational analytics…" />;

  const stats = [
    { label: "SLA compliance", value: `${data.slaCompliance}%`, icon: CheckCircle2, cls: "text-emerald-600" },
    { label: "Avg picking time", value: `${data.pickingMinutes}m`, icon: Clock3, cls: "text-sky-600" },
    { label: "Avg packing time", value: `${data.packingMinutes}m`, icon: PackageCheck, cls: "text-violet-600" },
    { label: "Dispatch on-time", value: `${data.onTimeDispatchPct}%`, icon: Activity, cls: "text-teal-600" },
    { label: "Inventory turnover", value: `${data.turnover}×`, icon: TrendingUp, cls: "text-indigo-600" },
    { label: "Stockout events", value: String(data.stockoutCount), icon: Siren, cls: data.stockoutCount > 0 ? "text-red-600" : "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operational Analytics"
        subtitle="Fulfillment performance, inventory turnover and automatic bottleneck detection."
        icon={BarChart3}
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="glass-chip h-9 rounded-xl p-1">
              <TabsTrigger value="today" className="rounded-lg text-xs">Today</TabsTrigger>
              <TabsTrigger value="7" className="rounded-lg text-xs">7 Days</TabsTrigger>
              <TabsTrigger value="30" className="rounded-lg text-xs">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <GlassPanel key={s.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <s.icon className={cn("size-4", s.cls)} />
              <p className="text-2xl font-bold tabular-nums text-slate-900">{s.value}</p>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <SectionTitle title="Orders processed per day" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ordersPerDay} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: "oklch(0.55 0.16 252 / 0.06)" }} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="orders" name="Orders" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="fulfilled" name="Fulfilled" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle title="Exceptions by type" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.excByType} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 10, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "oklch(0.55 0.16 252 / 0.06)" }} />
                <Bar dataKey="count" name="Exceptions" radius={[0, 4, 4, 0]}>
                  {data.excByType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-5 lg:grid-cols-3">
        <GlassPanel className="p-5">
          <SectionTitle title="Picking productivity (per picker)" />
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.productivity} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="picker" tick={{ fontSize: 9, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} width={26} />
                <Tooltip cursor={{ fill: "oklch(0.55 0.16 252 / 0.06)" }} />
                <Bar dataKey="tasks" name="Completed tasks" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle title="Dispatch performance by carrier" />
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dispatchPerf} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="carrier" tick={{ fontSize: 9, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} width={26} />
                <Tooltip cursor={{ fill: "oklch(0.55 0.16 252 / 0.06)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Shipments" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="delayed" name="Delayed" fill="oklch(0.577 0.22 27)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle title="Fulfillment time (minutes)" />
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{ label: "Picking", minutes: data.pickingMinutes }, { label: "Packing", minutes: data.packingMinutes }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.03 258)" }} axisLine={false} tickLine={false} width={26} />
                <Tooltip />
                <Line type="monotone" dataKey="minutes" name="Avg minutes" stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Bottlenecks */}
        <GlassPanel className="p-5">
          <SectionTitle title="Detected Bottlenecks" />
          {data.bottlenecks.length === 0 ? (
            <div className="mt-3 rounded-xl bg-emerald-50/70 px-4 py-5 text-center ring-1 ring-emerald-100">
              <p className="text-sm font-semibold text-emerald-700">No bottlenecks detected</p>
              <p className="mt-1 text-[12px] text-emerald-700/70">All zones are performing within the warehouse average.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              {data.bottlenecks.map((b) => (
                <div key={b.id} className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3.5">
                  <p className="flex items-center gap-2 text-[13px] font-bold text-amber-800">
                    <TrendingDown className="size-4" /> Bottleneck · {b.kind} in {b.zone}
                  </p>
                  <p className="mt-1 text-[12px] text-amber-700/90">Impact: {b.impact} · Avg delay ~{b.avgDelay} min</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">{b.suggestedAction}</span>
                    <Button size="sm" variant="outline" className="h-7 border-amber-200 bg-white/60 text-xs text-amber-800" onClick={() => navigate("/picking")}>
                      View tasks
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        {/* Insights */}
        <GlassPanel className="p-5">
          <SectionTitle title="Operational insights" />
          <div className="mt-3 space-y-2.5">
            {data.insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3",
                  ins.severity === "warning" ? "border-amber-200/70 bg-amber-50/50" : ins.severity === "success" ? "border-emerald-200/70 bg-emerald-50/50" : "border-white/75 bg-white/55",
                )}
              >
                {ins.severity === "warning" ? <TrendingDown className="mt-0.5 size-4 shrink-0 text-amber-600" /> : ins.severity === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Activity className="mt-0.5 size-4 shrink-0 text-sky-600" />}
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{ins.title}</p>
                  <p className="mt-0.5 text-[12px] leading-4 text-slate-600">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
