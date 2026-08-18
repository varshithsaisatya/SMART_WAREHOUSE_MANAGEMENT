import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Split,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Zap, title: "Intelligent prioritization", desc: "Every order is scored on SLA urgency, customer tier, value, stock readiness and progress — then the queue is sorted automatically." },
  { icon: Split, title: "Allocation engine", desc: "When inventory runs short, the engine decides who gets stock, what gets backordered, and when reserved units should be reallocated." },
  { icon: PackageSearch, title: "Optimized picking", desc: "The system recommends the next pick, batches orders by zone, and flags bottlenecks before they delay shipments." },
  { icon: ShieldCheck, title: "Quality gate", desc: "Every order passes a 5-point quality check before dispatch. Failures become exceptions with a tracked resolution path." },
  { icon: AlertTriangle, title: "Exception center", desc: "Exception → Decision → Resolution. Every incident carries a suggested decision, an audit trail and an approval flow." },
  { icon: Boxes, title: "Replenishment signals", desc: "Demand forecasts, reorder points and stockout horizons keep the shelves full — with one-click reorder recommendations." },
  { icon: Truck, title: "Dispatch intelligence", desc: "Carrier queues, scheduled vs actual times and delay alerts keep shipments moving and customers informed." },
  { icon: ClipboardList, title: "Full audit trail", desc: "Every allocation, pick, QC pass, dispatch and AI decision is recorded with user, timestamp and state transition." },
];

const FLOW = ["Order Created", "Priority Determined", "Inventory Checked", "Allocation", "Picking", "Packing", "Quality Check", "Dispatch", "Inventory Updated"];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30">
              <Warehouse className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900">SmartFulfill AI</p>
              <p className="text-[10px] font-medium text-muted-foreground">Warehouse operations platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden text-slate-600 sm:inline-flex" onClick={() => navigate("/auth")}>
              Sign in
            </Button>
            <Button size="sm" className="gap-1.5 shadow-md shadow-sky-500/25" onClick={() => navigate("/auth?returnTo=/dashboard")}>
              Open Command Center <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="outline" className="glass-chip gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-sky-700">
              <Sparkles className="size-3 text-purple-600" />
              Smart Decision Engine · not just a dashboard
            </Badge>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl">
              The warehouse that
              <span className="text-glow-blue bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent"> decides </span>
              what happens next
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              SmartFulfill AI runs the full fulfillment lifecycle — from order creation to dispatch — and continuously recommends what operators should do:
              which order first, which stock to allocate, which pick is next, and which bottleneck to fix.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="gap-2 rounded-xl px-6 shadow-lg shadow-sky-500/30" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                <Zap className="size-4" /> Launch demo
              </Button>
              <Button size="lg" variant="outline" className="gap-2 rounded-xl border-white/70 bg-white/60 backdrop-blur-md" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
                How it decides
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["100+", "SKUs tracked"],
              ["60+", "orders in flight"],
              ["9", "fulfillment stages"],
              ["24/7", "engine watching"],
            ].map(([v, l]) => (
              <div key={l} className="glass-panel rounded-2xl px-4 py-3.5">
                <p className="text-xl font-bold tabular-nums text-slate-900">{v}</p>
                <p className="text-[11px] font-medium text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Flow strip */}
        <div className="mx-auto mt-12 max-w-5xl">
          <div className="glass-panel rounded-2xl px-5 py-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">Complete fulfillment lifecycle</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              {FLOW.map((f, i) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="glass-chip rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">{f}</span>
                  {i < FLOW.length - 1 && <ArrowRight className="size-3 text-sky-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-600">Observe → Analyze → Decide → Act → Measure</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            SmartFulfill AI doesn't just tell you what's happening — it recommends what to do next
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: (i % 4) * 0.06 }} className="glass-panel group rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 text-sky-600 ring-1 ring-sky-200/60 transition-colors group-hover:from-sky-500 group-hover:to-indigo-600 group-hover:text-white">
                <f.icon className="size-5" />
              </div>
              <p className="mt-3.5 text-[14px] font-semibold text-slate-900">{f.title}</p>
              <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Demo scenario */}
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <div className="glass-panel-strong overflow-hidden rounded-3xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-7 sm:p-10">
              <Badge variant="outline" className="gap-1.5 rounded-full border-red-200 bg-red-50/70 px-3 py-1 text-[11px] font-semibold text-red-700">
                <AlertTriangle className="size-3" /> Hackathon scenario included
              </Badge>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">7 units left, 10 required — watch the system decide</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                An urgent order needs <b>10 units</b> of a product. Only <b>7</b> are available — and another order wants 5. SmartFulfill AI detects the conflict
                and walks the whole resolution: prioritize the urgent order → allocate the 7 units → backorder 3 → block the lower-priority order from consuming
                the stock → raise a replenishment recommendation → create an operational alert → track the resolution to completion.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Priority scoring & SLA reasoning on every order",
                  "Allocation decisions with approve / modify / reject",
                  "Exception → Decision → Resolution workflow",
                  "5 one-click demo scenarios for the presentation",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button className="gap-2 shadow-lg shadow-sky-500/30" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                  <ClipboardCheck className="size-4" /> Try the demo
                </Button>
                <Button variant="outline" className="gap-2 border-white/70 bg-white/60" onClick={() => navigate("/auth?returnTo=/recommendations")}>
                  <Sparkles className="size-4 text-purple-600" /> See the AI advisor
                </Button>
              </div>
            </div>
            {/* Scenario visual */}
            <div className="relative flex flex-col justify-center gap-3 bg-gradient-to-br from-sky-500/10 via-white/30 to-indigo-500/10 p-7 sm:p-10">
              {[
                { icon: AlertTriangle, label: "Conflict detected", detail: "WH-204 · 7 available vs 10 required", tone: "border-red-200/80 bg-red-50/70 text-red-700" },
                { icon: Zap, label: "AI decision", detail: "Allocate 7 units to ORD-1052 (Critical)", tone: "border-purple-200/80 bg-purple-50/70 text-purple-700" },
                { icon: Split, label: "User approval", detail: "Approve allocation · backorder 3 units", tone: "border-sky-200/80 bg-sky-50/70 text-sky-700" },
                { icon: Boxes, label: "Resolution", detail: "Reorder 50 units · exception tracked", tone: "border-emerald-200/80 bg-emerald-50/70 text-emerald-700" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.12 }} className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-md", s.tone)}>
                  <s.icon className="size-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{s.label}</p>
                    <p className="truncate text-[11px] opacity-80">{s.detail}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-500">Step {i + 1}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <div className="glass-panel rounded-3xl px-6 py-12 text-center">
          <h3 className="mx-auto max-w-xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">See the warehouse run itself — for the judges</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Open the Command Center, run the Inventory Shortage scenario, approve the allocation, watch the exception resolve, and show the audit trail that
            proves every decision was made — not just displayed.
          </p>
          <Button size="lg" className="mt-6 gap-2 rounded-xl px-8 shadow-lg shadow-sky-500/30" onClick={() => navigate("/auth?returnTo=/dashboard")}>
            Enter SmartFulfill AI <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/50 bg-white/30 py-6 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-[11px] text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-1.5">
            <Warehouse className="size-3.5" /> SmartFulfill AI — decision-first warehouse operations
          </p>
          <p>Demo data · deterministic seed · built for the hackathon</p>
        </div>
      </footer>
    </div>
  );
}
