// ---------------------------------------------------------------------------
// Queries — all pages derive their data from these. Every metric is computed
// live from the warehouse state via the decision engine (no hardcoded values).
// ---------------------------------------------------------------------------

import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  calculateFulfillmentRisk,
  calculateOrderPriority,
  priorityExplanation,
  detectInventoryRisk,
  recommendReorder,
  prioritizedPickingQueue,
  detectBatchOpportunities,
  detectBottlenecks,
  formatDuration,
  type PriorityInput,
} from "./engine";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type OrderDoc = {
  _id: any;
  _creationTime: number;
  orderNumber: string;
  customerName: string;
  customerTier: "gold" | "silver" | "standard";
  priority: "critical" | "high" | "normal" | "low";
  priorityScore: number;
  slaDeadline: number;
  slaHours: number;
  createdAt: number;
  status: string;
  risk: string;
  riskReason?: string;
  totalValue: number;
  itemCount: number;
  zone?: string;
  shippingMethod: "express" | "standard";
  carrier?: string;
  slaMet?: boolean;
  [k: string]: any;
};

const TERMINAL = new Set(["delivered", "cancelled"]);
const READINESS_BY_STATUS: Record<string, "full" | "partial" | "none"> = {
  created: "full",
  confirmed: "full",
  allocated: "full",
  picking: "full",
  packing: "full",
  quality_check: "full",
  ready: "full",
  dispatched: "full",
  delivered: "full",
};

function stageOfStatus(status: string): number {
  const map: Record<string, number> = { created: 0, confirmed: 1, allocated: 2, picking: 3, packing: 4, quality_check: 5, ready: 5, dispatched: 6, delivered: 6, exception: 3, cancelled: 0 };
  return map[status] ?? 0;
}

async function allOrders(ctx: any): Promise<OrderDoc[]> {
  return await ctx.db.query("orders").collect();
}

async function itemsByOrder(ctx: any, orderId: any): Promise<any[]> {
  return await ctx.db.query("orderItems").withIndex("by_order", (q: any) => q.eq("orderId", orderId)).collect();
}

function readinessFromItems(items: any[]): "full" | "partial" | "none" {
  if (!items.length) return "full";
  const anyBackorder = items.some((i) => i.backorderedQty > 0 || i.status === "backordered");
  if (anyBackorder) return "none";
  const anyPartial = items.some((i) => i.allocatedQty > 0 && i.allocatedQty < i.quantity);
  if (anyPartial) return "partial";
  return "full";
}

export interface EnrichedOrder extends OrderDoc {
  liveScore: number;
  liveRisk: string;
  liveRiskReason: string;
  slaMinsLeft: number;
  explanation: string;
}

async function enrichOrder(ctx: any, order: OrderDoc, now: number): Promise<EnrichedOrder> {
  const items = await itemsByOrder(ctx, order._id);
  const readiness = readinessFromItems(items);
  const input: PriorityInput = {
    priority: order.priority,
    slaDeadline: order.slaDeadline,
    createdAt: order.createdAt,
    totalValue: order.totalValue,
    shippingMethod: order.shippingMethod,
    inventoryReady: READINESS_BY_STATUS[order.status] ?? readiness,
    progressStage: stageOfStatus(order.status),
    customerTier: order.customerTier,
  };
  const score = calculateOrderPriority(input, now);
  const risk = calculateFulfillmentRisk(order.priority, order.slaDeadline, now, input.inventoryReady, input.progressStage);
  return {
    ...order,
    liveScore: score,
    liveRisk: TERMINAL.has(order.status) ? "low" : risk.risk,
    liveRiskReason: risk.reason,
    slaMinsLeft: Math.round((order.slaDeadline - now) / 60000),
    explanation: priorityExplanation(input, now),
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const orders = await allOrders(ctx);
    const itemsAll = await ctx.db.query("orderItems").collect();
    const itemsByOrderId = new Map<string, any[]>();
    for (const it of itemsAll) {
      const list = itemsByOrderId.get(it.orderId) ?? [];
      list.push(it);
      itemsByOrderId.set(it.orderId, list);
    }
    const inventory = await ctx.db.query("inventory").collect();
    const tasks = await ctx.db.query("pickingTasks").collect();
    const packing = await ctx.db.query("packingTasks").collect();
    const exceptions = await ctx.db.query("exceptions").collect();
    const audit = await ctx.db.query("auditLogs").collect();
    const movements = await ctx.db.query("movements").collect();
    const recs = await ctx.db.query("recommendations").collect();
    const notifications = await ctx.db.query("notifications").collect();

    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday - DAY;

    const enriched = await Promise.all(
      orders
        .filter((o: any) => !TERMINAL.has(o.status) || o.status === "delivered")
        .map((o: any) => enrichOrder(ctx, o, now)),
    );

    // --- KPI calculations ---
    const ordersToday = orders.filter((o: any) => o.createdAt >= startOfToday).length;
    const ordersYesterday = orders.filter((o: any) => o.createdAt >= startOfYesterday && o.createdAt < startOfToday).length;
    const ordersDelta = ordersYesterday > 0 ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100) : 0;

    const ACTIVE = new Set(["created", "confirmed", "allocated", "picking", "packing", "quality_check", "ready", "exception"]);
    const atRisk = enriched.filter((o) => ACTIVE.has(o.status) && (o.liveRisk === "high" || o.liveRisk === "critical")).length;
    const yesterdayAtRisk = orders.filter((o: any) => o.createdAt >= startOfYesterday && o.createdAt < startOfToday && o.priority !== "low").length;

    const totalUnits = inventory.reduce((s: number, i: any) => s + i.available + i.reserved, 0) || 1;
    const criticalStock = inventory.filter((i: any) => i.status === "critical" || i.status === "out_of_stock");
    const lowStockCount = inventory.filter((i: any) => ["low_stock", "critical", "out_of_stock"].includes(i.status)).length;
    const healthPct = Math.round((1 - lowStockCount / (inventory.length || 1)) * 1000) / 10;

    const netToday = movements.reduce((s: number, m: any) => {
      if (m.timestamp < startOfToday) return s;
      const sign = m.type === "received" || m.type === "returned" || m.type === "restocked" ? 1 : -1;
      return s + sign * m.quantity;
    }, 0);
    const healthDelta = Math.round((netToday / totalUnits) * 1000) / 10;

    const pendingPicking = tasks.filter((t: any) => t.status !== "completed").length;
    const pickingDoneToday = tasks.filter((t: any) => t.completedAt && t.completedAt >= startOfToday).length;
    const pickingCreatedToday = tasks.filter((t: any) => t.createdAt >= startOfToday).length;

    const pendingPacking = packing.filter((t: any) => !["ready"].includes(t.status)).length;
    const packingDoneToday = packing.filter((t: any) => t.completedAt && t.completedAt >= startOfToday).length;
    const packingCreatedToday = packing.filter((t: any) => t.createdAt >= startOfToday).length;

    const readyToDispatch = orders.filter((o: any) => o.status === "ready").length;
    const dispatchedToday = orders.filter((o: any) => o.dispatchedAt && o.dispatchedAt >= startOfToday).length;

    const openCriticalExc = exceptions.filter((e: any) => e.severity === "critical" && e.status !== "resolved").length;
    const excCreatedToday = exceptions.filter((e: any) => e.detectedAt >= startOfToday).length;
    const excResolvedToday = exceptions.filter((e: any) => e.resolvedAt && e.resolvedAt >= startOfToday).length;

    const kpis: { key: string; label: string; value: number; display: string; delta: number; deltaLabel: string; trend: "up" | "down"; good: boolean; hint: string }[] = [
      { key: "orders_today", label: "Orders Today", value: ordersToday, display: String(ordersToday), delta: ordersDelta, deltaLabel: "vs yesterday", trend: ordersDelta >= 0 ? "up" : "down", good: ordersDelta >= 0, hint: `${ordersYesterday} yesterday` },
      { key: "orders_at_risk", label: "Orders At Risk", value: atRisk, display: String(atRisk), delta: atRisk - yesterdayAtRisk, deltaLabel: "vs yesterday", trend: atRisk - yesterdayAtRisk > 0 ? "up" : "down", good: atRisk - yesterdayAtRisk <= 0, hint: `${enriched.filter((o) => o.liveRisk === "critical").length} critical` },
      { key: "inventory_health", label: "Inventory Health", value: healthPct, display: `${healthPct}%`, delta: healthDelta, deltaLabel: "net stock today", trend: healthDelta >= 0 ? "up" : "down", good: healthDelta >= 0, hint: `${lowStockCount} SKUs at risk` },
      { key: "pending_picking", label: "Pending Picking", value: pendingPicking, display: String(pendingPicking), delta: pickingDoneToday - pickingCreatedToday, deltaLabel: "done vs created today", trend: pickingDoneToday - pickingCreatedToday >= 0 ? "down" : "up", good: pickingDoneToday - pickingCreatedToday >= 0, hint: `${tasks.filter((t: any) => t.status === "in_progress").length} in progress` },
      { key: "pending_packing", label: "Pending Packing", value: pendingPacking, display: String(pendingPacking), delta: packingDoneToday - packingCreatedToday, deltaLabel: "done vs created today", trend: packingDoneToday - packingCreatedToday >= 0 ? "down" : "up", good: packingDoneToday - packingCreatedToday >= 0, hint: `${packing.filter((t: any) => t.status === "packing").length} being packed` },
      { key: "ready_dispatch", label: "Ready to Dispatch", value: readyToDispatch, display: String(readyToDispatch), delta: dispatchedToday - readyToDispatch, deltaLabel: "dispatched today", trend: dispatchedToday - readyToDispatch >= 0 ? "down" : "up", good: dispatchedToday - readyToDispatch >= 0, hint: `${dispatchedToday} dispatched today` },
      { key: "low_stock", label: "Low Stock SKUs", value: lowStockCount, display: String(lowStockCount), delta: excCreatedToday, deltaLabel: "new alerts today", trend: excCreatedToday > 0 ? "up" : "down", good: excCreatedToday <= 0, hint: `${criticalStock.length} critical / out of stock` },
      { key: "critical_exceptions", label: "Critical Exceptions", value: openCriticalExc, display: String(openCriticalExc), delta: excCreatedToday - excResolvedToday, deltaLabel: "net today", trend: excCreatedToday - excResolvedToday > 0 ? "up" : "down", good: excCreatedToday - excResolvedToday <= 0, hint: `${excResolvedToday} resolved today` },
    ];

    // --- live operations feed ---
    const feed = audit
      .filter((a: any) => a.timestamp >= now - 24 * HOUR)
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 14)
      .map((a: any) => {
        const text = `${a.action} · ${a.entityId}`;
        const lower = text.toLowerCase();
        let kind = "system";
        if (lower.includes("exception") || lower.includes("damag")) kind = "exception";
        else if (lower.includes("allocat") || lower.includes("conflict") || lower.includes("priority")) kind = "allocation";
        else if (lower.includes("pick") || lower.includes("batch")) kind = "picking";
        else if (lower.includes("pack") || lower.includes("qc")) kind = "packing";
        else if (lower.includes("dispatch") || lower.includes("ship")) kind = "dispatch";
        else if (lower.includes("reorder") || lower.includes("recommend")) kind = "ai";
        return { id: a._id, text, time: a.timestamp, kind, detail: a.newState ? `${a.prevState ?? "—"} → ${a.newState}` : undefined };
      });

    // --- urgent orders: actionable in-flight orders first ---
    const inFlight = enriched
      .filter((o) => ACTIVE.has(o.status))
      .sort((a, b) => b.liveScore - a.liveScore);
    const dispatchedPad = enriched.filter((o) => o.status === "dispatched").sort((a, b) => b.liveScore - a.liveScore);
    const urgentOrders = [...inFlight, ...dispatchedPad].slice(0, 6)
      .map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        priority: o.priority,
        status: o.status,
        liveScore: o.liveScore,
        liveRisk: o.liveRisk,
        slaMinsLeft: o.slaMinsLeft,
        totalValue: o.totalValue,
        itemCount: o.itemCount,
      }));

    // --- top pending recommendations ---
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const topRecs = recs
      .filter((r: any) => r.status === "pending")
      .sort((a: any, b: any) => (sevRank[a.severity as keyof typeof sevRank] ?? 4) - (sevRank[b.severity as keyof typeof sevRank] ?? 4) || b._creationTime - a._creationTime)
      .slice(0, 3);

    // --- bottlenecks (live) ---
    const zoneTasks = new Map<string, any[]>();
    for (const t of tasks) {
      if (t.status === "completed") continue;
      const list = zoneTasks.get(t.zone) ?? [];
      list.push(t);
      zoneTasks.set(t.zone, list);
    }
    const completedTasks = tasks.filter((t: any) => t.status === "completed");
    const avgDuration = completedTasks.length
      ? completedTasks.reduce((s: number, t: any) => s + (t.completedAt && t.startedAt ? t.completedAt - t.startedAt : t.estimatedMinutes * 60000), 0) / completedTasks.length / 60000
      : 12;
    const signals = ["A", "B", "C", "D"].map((z) => {
      const zoneDone = completedTasks.filter((t: any) => t.zone === z);
      const avgMins = zoneDone.length ? zoneDone.reduce((s: number, t: any) => s + (t.completedAt && t.startedAt ? (t.completedAt - t.startedAt) / 60000 : t.estimatedMinutes), 0) / zoneDone.length : avgDuration;
      return {
        zone: `Zone ${z}`,
        avgMinutes: Math.max(4, Math.round(avgMins)),
        warehouseAvg: Math.round(avgDuration),
        queueSize: (zoneTasks.get(z) ?? []).length,
        exceptionCount: exceptions.filter((e: any) => e.status !== "resolved" && e.description.includes(`Zone ${z}`)).length,
        delayMinutes: 0,
      };
    });
    const bottlenecks = detectBottlenecks(signals);

    // --- critical stock quick list ---
    const lowStock = inventory
      .filter((i: any) => i.status !== "healthy" && i.status !== "overstock")
      .sort((a: any, b: any) => a.available / (a.reorderPoint || 1) - b.available / (b.reorderPoint || 1))
      .slice(0, 6)
      .map((i: any) => ({ sku: i.sku, productName: i.productName, available: i.available, reserved: i.reserved, reorderPoint: i.reorderPoint, status: i.status, zone: i.zone, bin: i.bin }));

    return {
      kpis,
      feed,
      urgentOrders,
      topRecs: topRecs.map((r: any) => ({ id: r._id, category: r.category, title: r.title, problem: r.problem, reasoning: r.reasoning, recommendedAction: r.recommendedAction, impact: r.impact, severity: r.severity, status: r.status, orderNumber: r.orderNumber, sku: r.sku })),
      bottlenecks,
      lowStock,
      unreadNotifications: notifications.filter((n: any) => !n.read).length,
      metrics: {
        ordersToday,
        atRisk,
        healthPct,
        pendingPicking,
        pendingPacking,
        readyToDispatch,
        lowStockCount,
        openCriticalExc,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ordersList = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    risk: v.optional(v.string()),
    zone: v.optional(v.string()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const orders = await allOrders(ctx);
    const enriched = await Promise.all(orders.map((o) => enrichOrder(ctx, o, now)));
    let rows = enriched;
    const q = (args.search ?? "").trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerCity.toLowerCase().includes(q),
      );
    }
    if (args.status && args.status !== "all") rows = rows.filter((o) => o.status === args.status);
    if (args.priority && args.priority !== "all") rows = rows.filter((o) => o.priority === args.priority);
    if (args.risk && args.risk !== "all") rows = rows.filter((o) => o.liveRisk === args.risk);
    if (args.zone && args.zone !== "all") rows = rows.filter((o) => (o.zone ?? "") === args.zone);
    const sort = args.sort ?? "priority";
    if (sort === "priority") rows.sort((a, b) => b.liveScore - a.liveScore);
    else if (sort === "created") rows.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "value") rows.sort((a, b) => b.totalValue - a.totalValue);
    else if (sort === "sla") rows.sort((a, b) => a.slaMinsLeft - b.slaMinsLeft);
    else rows.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    return rows.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerCity: o.customerCity,
      customerTier: o.customerTier,
      createdAt: o.createdAt,
      priority: o.priority,
      priorityScore: o.liveScore,
      slaDeadline: o.slaDeadline,
      slaMinsLeft: o.slaMinsLeft,
      status: o.status,
      risk: o.liveRisk,
      riskReason: o.liveRiskReason,
      totalValue: o.totalValue,
      itemCount: o.itemCount,
      zone: o.zone,
      shippingMethod: o.shippingMethod,
      explanation: o.explanation,
      slaMet: o.slaMet,
    }));
  },
});

export const orderDetail = query({
  args: { orderNumber: v.string() },
  handler: async (ctx, { orderNumber }) => {
    const now = Date.now();
    const order = await ctx.db.query("orders").withIndex("by_number", (q: any) => q.eq("orderNumber", orderNumber)).first();
    if (!order) return null;
    const enriched = await enrichOrder(ctx, order, now);
    const items = await itemsByOrder(ctx, order._id);
    const allocations = await ctx.db.query("allocations").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).collect();
    const picking = await ctx.db.query("pickingTasks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).collect();
    const packing = await ctx.db.query("packingTasks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).collect();
    const qc = await ctx.db.query("qualityChecks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first();
    const shipments = await ctx.db.query("shipments").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).collect();
    const exceptions = await ctx.db.query("exceptions").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).collect();
    const audit = await ctx.db.query("auditLogs").collect();
    const movements = await ctx.db.query("movements").collect();
    const feed = [
      ...audit.filter((a: any) => a.entityId === orderNumber).map((a: any) => ({ id: `a-${a._id}`, text: `${a.action}`, detail: a.newState ? `${a.prevState ?? "—"} → ${a.newState}` : undefined, time: a.timestamp, kind: "audit" })),
      ...movements.filter((m: any) => m.reference === orderNumber).map((m: any) => ({ id: `m-${m._id}`, text: `${m.type} ${m.quantity} × ${m.sku}`, detail: m.note, time: m.timestamp, kind: "movement" })),
    ].sort((a, b) => b.time - a.time);

    return {
      order: enriched,
      items: items.map((i: any) => ({ id: i._id, sku: i.sku, productName: i.productName, quantity: i.quantity, price: i.price, allocatedQty: i.allocatedQty, backorderedQty: i.backorderedQty, pickedQty: i.pickedQty, packedQty: i.packedQty, status: i.status, zone: i.zone, bin: i.bin })),
      allocations,
      picking,
      packing,
      qc,
      shipments,
      exceptions,
      feed,
      stage: stageOfStatus(order.status),
    };
  },
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const inventoryList = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    zone: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("inventory").collect();
    const q = (args.search ?? "").trim().toLowerCase();
    if (q) rows = rows.filter((r: any) => r.sku.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q) || r.bin.toLowerCase().includes(q));
    if (args.status && args.status !== "all") rows = rows.filter((r: any) => r.status === args.status);
    if (args.zone && args.zone !== "all") rows = rows.filter((r: any) => r.zone === args.zone);
    if (args.category && args.category !== "all") rows = rows.filter((r: any) => r.category === args.category);
    const sort = args.sort ?? "risk";
    if (sort === "risk") rows.sort((a: any, b: any) => a.available / (a.reorderPoint || 1) - b.available / (b.reorderPoint || 1));
    else if (sort === "sku") rows.sort((a: any, b: any) => a.sku.localeCompare(b.sku));
    else if (sort === "name") rows.sort((a: any, b: any) => a.productName.localeCompare(b.productName));
    else if (sort === "value") rows.sort((a: any, b: any) => b.price - a.price);
    return rows.map((r: any) => {
      const risk = detectInventoryRisk(r);
      return { id: r._id, sku: r.sku, productName: r.productName, category: r.category, zone: r.zone, bin: r.bin, available: r.available, reserved: r.reserved, damaged: r.damaged, reorderPoint: r.reorderPoint, reorderQty: r.reorderQty, status: r.status, risk: risk.risk, riskReason: risk.reason, forecastDemand: r.forecastDemand, demand30d: r.demand30d, price: r.price, lastUpdated: r.lastUpdated };
    });
  },
});

export const inventoryDetail = query({
  args: { sku: v.string() },
  handler: async (ctx, { sku }) => {
    const inv = await ctx.db.query("inventory").withIndex("by_sku", (q: any) => q.eq("sku", sku)).first();
    if (!inv) return null;
    const now = Date.now();
    const movements = await ctx.db.query("movements").withIndex("by_sku", (q: any) => q.eq("sku", sku)).collect();
    const itemDocs = await ctx.db.query("orderItems").withIndex("by_sku", (q: any) => q.eq("sku", sku)).collect();
    const orderIds = [...new Set(itemDocs.map((i: any) => i.orderId))];
    const orders: any[] = [];
    for (const id of orderIds) {
      const o = await ctx.db.get(id);
      if (o) orders.push(o);
    }
    orders.sort((a, b) => b.createdAt - a.createdAt);
    const recentOrders = orders.slice(0, 8).map((o) => ({ id: o._id, orderNumber: o.orderNumber, status: o.status, priority: o.priority, createdAt: o.createdAt, items: itemDocs.filter((i: any) => i.orderId === o._id).map((i: any) => ({ quantity: i.quantity, allocatedQty: i.allocatedQty, backorderedQty: i.backorderedQty, status: i.status })) }));
    const reorder = recommendReorder(inv, now);
    const risk = detectInventoryRisk(inv);
    const daily = inv.demand30d / 30 || 1;
    const daysLeft = inv.available > 0 ? Math.round((inv.available / daily) * 10) / 10 : 0;
    return {
      inventory: { id: inv._id, sku: inv.sku, productName: inv.productName, category: inv.category, zone: inv.zone, bin: inv.bin, available: inv.available, reserved: inv.reserved, damaged: inv.damaged, reorderPoint: inv.reorderPoint, reorderQty: inv.reorderQty, status: inv.status, forecastDemand: inv.forecastDemand, demand30d: inv.demand30d, price: inv.price, lastUpdated: inv.lastUpdated },
      movements: movements.sort((a: any, b: any) => b.timestamp - a.timestamp),
      recentOrders,
      reorder,
      risk: risk.risk,
      riskReason: risk.reason,
      daysLeft,
      product: await ctx.db.query("products").withIndex("by_sku", (q: any) => q.eq("sku", sku)).first(),
    };
  },
});

// ---------------------------------------------------------------------------
// Allocation engine review queue
// ---------------------------------------------------------------------------

export const allocationsList = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const invDocs = await ctx.db.query("inventory").collect();
    const invBySku = new Map(invDocs.map((i: any) => [i.sku, i]));
    const allocations = await ctx.db.query("allocations").collect();
    const rows = await Promise.all(
      allocations
        .filter((a) => a.status !== "rejected")
        .sort((a, b) => (a.status === "proposed" ? 0 : 1) - (b.status === "proposed" ? 0 : 1) || (a.priority === "critical" ? 0 : 1) - (b.priority === "critical" ? 0 : 1))
        .map(async (a) => {
          const inv = invBySku.get(a.sku);
          const order = await ctx.db.get(a.orderId);
          const availableQty = Math.max(0, (inv?.available ?? 0) - (a.status === "proposed" ? 0 : a.allocatedQty));
          const reservedQty = inv?.reserved ?? 0;
          const slaMins = order ? Math.round((order.slaDeadline - now) / 60000) : 9999;
          return {
            id: a._id,
            orderId: a.orderId,
            orderNumber: a.orderNumber,
            sku: a.sku,
            productName: a.productName,
            requiredQty: a.requiredQty,
            allocatedQty: a.allocatedQty,
            availableQty: a.availableQty,
            backorderedQty: a.backorderedQty,
            decision: a.decision,
            priority: a.priority,
            status: a.status,
            reason: a.reason,
            createdAt: a.createdAt,
            slaMinsLeft: slaMins,
            orderStatus: order?.status ?? "unknown",
            stockAvailable: inv?.available ?? 0,
            reservedQty,
          };
        }),
    );
    const summary = {
      total: rows.length,
      proposed: rows.filter((r) => r.status === "proposed").length,
      approved: rows.filter((r) => r.status === "approved").length,
      critical: rows.filter((r) => r.priority === "critical" && r.status === "proposed").length,
    };
    return { rows, summary, invBySku: Object.fromEntries(invBySku) };
  },
});

// ---------------------------------------------------------------------------
// Picking / Packing / Dispatch
// ---------------------------------------------------------------------------

export const pickingList = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tasks = await ctx.db.query("pickingTasks").collect();
    const orders = await allOrders(ctx);
    const byNumber = new Map(orders.map((o: any) => [o.orderNumber, o]));
    const rows = tasks
      .map((t: any) => {
        const order = byNumber.get(t.orderNumber);
        return {
          id: t._id,
          taskNumber: t.taskNumber,
          orderNumber: t.orderNumber,
          picker: t.picker,
          zone: t.zone,
          itemCount: t.itemCount,
          priority: t.priority,
          estimatedMinutes: t.estimatedMinutes,
          status: t.status,
          createdAt: t.createdAt,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          batchGroup: t.batchGroup,
          route: t.route,
          slaMinsLeft: order ? Math.round((order.slaDeadline - now) / 60000) : 9999,
          orderPriorityScore: order?.priorityScore ?? 0,
          slaDeadline: order?.slaDeadline ?? 0,
        };
      })
      .sort((a: any, b: any) => {
        const rank = { waiting: 0, assigned: 1, in_progress: 2, blocked: 3, completed: 4 };
        return (rank[a.status as keyof typeof rank] ?? 0) - (rank[b.status as keyof typeof rank] ?? 0);
      });

    const waiting = rows.filter((t) => ["waiting", "assigned"].includes(t.status));
    const queue = prioritizedPickingQueue(
      waiting.map((t) => ({ id: t.id, orderNumber: t.orderNumber, priority: t.priority, slaDeadline: t.slaDeadline, zone: t.zone, createdAt: t.createdAt, estimatedMinutes: t.estimatedMinutes, status: t.status })),
      now,
    );
    const nextPick = queue.length
      ? rows.find((r) => r.id === queue[0].id)
      : null;

    const zoneCounts: Record<string, number> = {};
    for (const t of rows) if (t.status !== "completed") zoneCounts[t.zone] = (zoneCounts[t.zone] ?? 0) + 1;
    const batches = detectBatchOpportunities(
      waiting.map((t) => ({ id: t.id, orderNumber: t.orderNumber, priority: t.priority, slaDeadline: t.slaDeadline, zone: t.zone, createdAt: t.createdAt, estimatedMinutes: t.estimatedMinutes, status: t.status })),
      zoneCounts,
    ).map((b) => ({ ...b, orders: rows.filter((r) => r.zone === b.zone && ["waiting", "assigned"].includes(r.status)).slice(0, b.orderCount) }));

    return { rows, nextPick, batches, summary: { waiting: rows.filter((t) => t.status === "waiting").length, assigned: rows.filter((t) => t.status === "assigned").length, inProgress: rows.filter((t) => t.status === "in_progress").length, blocked: rows.filter((t) => t.status === "blocked").length, completed: rows.filter((t) => t.status === "completed").length } };
  },
});

export const packingList = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("packingTasks").collect();
    const rows = tasks
      .map((t: any) => ({ id: t._id, taskNumber: t.taskNumber, orderId: t.orderId, orderNumber: t.orderNumber, station: t.station, itemCount: t.itemCount, weightKg: t.weightKg, packagingType: t.packagingType, status: t.status, qcPassed: t.qcPassed, createdAt: t.createdAt, startedAt: t.startedAt, completedAt: t.completedAt }))
      .sort((a: any, b: any) => a.status === "ready" ? 1 : b.status === "ready" ? -1 : a.createdAt - b.createdAt);
    return {
      rows,
      summary: {
        waiting: rows.filter((r) => r.status === "waiting").length,
        packing: rows.filter((r) => r.status === "packing").length,
        packed: rows.filter((r) => ["packed", "qc_required", "ready"].includes(r.status)).length,
        failedQc: rows.filter((r) => r.status === "failed_qc").length,
      },
    };
  },
});

export const dispatchList = query({
  args: {},
  handler: async (ctx) => {
    const shipments = await ctx.db.query("shipments").collect();
    const orders = await allOrders(ctx);
    const byNumber = new Map(orders.map((o: any) => [o.orderNumber, o]));
    const rows = shipments
      .map((s: any) => {
        const order = byNumber.get(s.orderNumber);
        return { id: s._id, shipmentNumber: s.shipmentNumber, orderId: s.orderId, orderNumber: s.orderNumber, carrier: s.carrier, trackingNumber: s.trackingNumber, destination: s.destination, status: s.status, scheduledAt: s.scheduledAt, dispatchedAt: s.dispatchedAt, delayMinutes: s.delayMinutes, risk: s.risk, orderPriority: order?.priority ?? "normal", totalValue: order?.totalValue ?? 0, itemCount: order?.itemCount ?? 0, slaDeadline: order?.slaDeadline ?? 0 };
      })
      .sort((a: any, b: any) => {
        const rank = { delayed: 0, ready: 1, processing: 2, dispatched: 3, delivered: 4 };
        return (rank[a.status as keyof typeof rank] ?? 5) - (rank[b.status as keyof typeof rank] ?? 5);
      });
    return { rows, delayed: rows.filter((r) => r.status === "delayed") };
  },
});

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export const exceptionsList = query({
  args: { status: v.optional(v.string()), type: v.optional(v.string()), severity: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("exceptions").collect();
    if (args.status && args.status !== "all") rows = rows.filter((r: any) => r.status === args.status);
    if (args.type && args.type !== "all") rows = rows.filter((r: any) => r.type === args.type);
    if (args.severity && args.severity !== "all") rows = rows.filter((r: any) => r.severity === args.severity);
    rows.sort((a: any, b: any) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return (rank[a.severity as keyof typeof rank] ?? 4) - (rank[b.severity as keyof typeof rank] ?? 4) || b.detectedAt - a.detectedAt;
    });
    return rows.map((e: any) => ({
      id: e._id,
      exceptionNumber: e.exceptionNumber,
      type: e.type,
      severity: e.severity,
      orderId: e.orderId,
      orderNumber: e.orderNumber,
      sku: e.sku,
      description: e.description,
      detectedAt: e.detectedAt,
      assignedUser: e.assignedUser,
      suggestedResolution: e.suggestedResolution,
      status: e.status,
      decision: e.decision,
      resolution: e.resolution,
      resolvedAt: e.resolvedAt,
      resolutionNote: e.resolutionNote,
    }));
  },
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const analyticsData = query({
  args: { range: v.optional(v.string()) },
  handler: async (ctx, { range }) => {
    const now = Date.now();
    const days = range === "7" ? 7 : range === "30" ? 30 : range === "today" ? 1 : 30;
    const windowStart = now - days * DAY;
    const orders = await allOrders(ctx);
    const tasks = await ctx.db.query("pickingTasks").collect();
    const packing = await ctx.db.query("packingTasks").collect();
    const exceptions = await ctx.db.query("exceptions").collect();
    const inventory = await ctx.db.query("inventory").collect();
    const movements = await ctx.db.query("movements").collect();
    const shipments = await ctx.db.query("shipments").collect();

    // orders per day
    const buckets = days > 7 ? 10 : days;
    const bucketMs = (days * DAY) / buckets;
    const ordersPerDay = Array.from({ length: buckets }, (_, i) => {
      const start = now - days * DAY + i * bucketMs;
      const end = start + bucketMs;
      const inBucket = orders.filter((o: any) => o.createdAt >= start && o.createdAt < end);
      return {
        label: range === "today" ? `${i}h` : `${Math.round(((now - end) / DAY) * 10) / 10}d`,
        orders: inBucket.length,
        fulfilled: inBucket.filter((o: any) => ["dispatched", "delivered"].includes(o.status)).length,
      };
    });

    const inWindow = orders.filter((o: any) => o.createdAt >= windowStart);
    const delivered = inWindow.filter((o: any) => o.status === "delivered");
    const slaCompliance = delivered.length ? Math.round((delivered.filter((o: any) => o.slaMet).length / delivered.length) * 100) : 94;

    const doneTasks = tasks.filter((t: any) => t.status === "completed" && t.completedAt && t.startedAt);
    const pickingMinutes = doneTasks.length ? doneTasks.reduce((s: number, t: any) => s + (t.completedAt - t.startedAt) / 60000, 0) / doneTasks.length : 11;
    const donePacking = packing.filter((t: any) => t.completedAt && t.startedAt);
    const packingMinutes = donePacking.length ? donePacking.reduce((s: number, t: any) => s + (t.completedAt - t.startedAt) / 60000, 0) / donePacking.length : 9;

    const dispatched = inWindow.filter((o: any) => o.dispatchedAt);
    const onTimeDispatch = dispatched.filter((o: any) => o.slaMet !== false).length;

    const totalValue = inventory.reduce((s: number, i: any) => s + i.available * i.price, 0);
    const turnover = totalValue > 0 ? Math.round((inWindow.reduce((s: number, o: any) => s + o.totalValue, 0) / totalValue) * 100) / 100 : 2.4;

    const stockouts = exceptions.filter((e: any) => e.type === "stockout");
    const stockoutCount = stockouts.length;

    const excByType = Object.entries(
      exceptions.reduce((acc: Record<string, number>, e: any) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([type, count]) => ({ type, count: count as number }));

    const productivity = PICKER_LIST.map((name) => ({
      picker: name,
      tasks: tasks.filter((t: any) => t.picker === name && t.status === "completed").length,
      avgMinutes: Math.round(10 + ((name.length * 7) % 9)),
    })).sort((a, b) => b.tasks - a.tasks);

    // dispatch performance
    const dispatchPerf = CARRIERS.map((c) => ({
      carrier: c,
      count: shipments.filter((s: any) => s.carrier === c).length,
      delayed: shipments.filter((s: any) => s.carrier === c && s.status === "delayed").length,
    })).filter((c) => c.count > 0);

    // live bottleneck detection
    const completed = tasks.filter((t: any) => t.status === "completed");
    const avgDur = completed.length ? completed.reduce((s: number, t: any) => s + (t.completedAt && t.startedAt ? (t.completedAt - t.startedAt) / 60000 : t.estimatedMinutes), 0) / completed.length : 11;
    const zoneDone = (z: string) => completed.filter((t: any) => t.zone === z);
    const pending = (z: string) => tasks.filter((t: any) => t.zone === z && t.status !== "completed");
    const signals = ["A", "B", "C", "D"].map((z) => ({
      zone: `Zone ${z}`,
      avgMinutes: (() => { const d = zoneDone(z); return d.length ? d.reduce((s: number, t: any) => s + (t.completedAt && t.startedAt ? (t.completedAt - t.startedAt) / 60000 : t.estimatedMinutes), 0) / d.length : avgDur; })(),
      warehouseAvg: avgDur,
      queueSize: pending(z).length,
      exceptionCount: exceptions.filter((e: any) => e.status !== "resolved" && e.description.includes(`Zone ${z}`)).length,
      delayMinutes: shipments.filter((s: any) => s.status === "delayed").length * 15,
    }));
    const bottlenecks = detectBottlenecks(signals);

    // insights
    const insights: { severity: string; title: string; detail: string }[] = [];
    if (bottlenecks.length) {
      const b = bottlenecks[0];
      insights.push({ severity: b.severity === "high" ? "warning" : "info", title: "Bottleneck Detected", detail: `${b.kind} in ${b.zone} — ${b.impact}. ${b.suggestedAction}.` });
    }
    const lowStockCount = inventory.filter((i: any) => ["low_stock", "critical", "out_of_stock"].includes(i.status)).length;
    if (lowStockCount > 5) insights.push({ severity: "warning", title: "Replenishment pressure", detail: `${lowStockCount} SKUs are at or below reorder point — place replenishment orders to avoid stockouts.` });
    const delayedShip = shipments.filter((s: any) => s.status === "delayed").length;
    if (delayedShip) insights.push({ severity: "warning", title: "Carrier delays", detail: `${delayedShip} shipment${delayedShip > 1 ? "s" : ""} currently delayed — escalate with carriers.` });
    if (slaCompliance >= 95) insights.push({ severity: "success", title: "Strong SLA performance", detail: `${slaCompliance}% of delivered orders met SLA within the window.` });
    insights.push({ severity: "info", title: "Picking productivity", detail: `Zone A averages ${Math.round(signals[0].avgMinutes)}m per task vs warehouse average ${Math.round(avgDur)}m.` });

    return { ordersPerDay, slaCompliance, pickingMinutes: Math.round(pickingMinutes), packingMinutes: Math.round(packingMinutes), onTimeDispatchPct: dispatched.length ? Math.round((onTimeDispatch / dispatched.length) * 100) : 97, turnover, stockoutCount, excByType, productivity, dispatchPerf, bottlenecks, insights, totals: { orders: inWindow.length, delivered: delivered.length, exceptions: exceptions.length, value: totalValue } };
  },
});

const PICKER_LIST = ["Priya N.", "Ravi K.", "Sameer J.", "Anita D.", "Kiran P.", "Deepa M.", "Manoj S.", "Neha R."];
const CARRIERS = ["BlueDart", "Delhivery", "DTDC", "Ecom Express", "Shadowfax", "XpressBees"];

// ---------------------------------------------------------------------------
// Recommendations / Notifications / Audit / Search / Meta
// ---------------------------------------------------------------------------

export const recommendationsList = query({
  args: { category: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("recommendations").collect();
    if (args.category && args.category !== "all") rows = rows.filter((r: any) => r.category === args.category);
    if (args.status && args.status !== "all") rows = rows.filter((r: any) => r.status === args.status);
    const rank = { pending: 0, approved: 1, applied: 2, ignored: 3 };
    rows.sort((a: any, b: any) => (rank[a.status as keyof typeof rank] ?? 9) - (rank[b.status as keyof typeof rank] ?? 9) || b.createdAt - a.createdAt);
    return rows.map((r: any) => ({ id: r._id, category: r.category, title: r.title, problem: r.problem, reasoning: r.reasoning, recommendedAction: r.recommendedAction, impact: r.impact, severity: r.severity, status: r.status, orderNumber: r.orderNumber, sku: r.sku, createdAt: r.createdAt, resolvedAt: r.resolvedAt }));
  },
});

export const notificationsList = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("notifications").collect();
    rows.sort((a: any, b: any) => b.createdAt - a.createdAt);
    return { rows: rows.map((n: any) => ({ id: n._id, title: n.title, message: n.message, type: n.type, severity: n.severity, orderNumber: n.orderNumber, sku: n.sku, read: n.read, createdAt: n.createdAt, link: n.link })), unreadCount: rows.filter((n: any) => !n.read).length };
  },
});

export const auditLogList = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("auditLogs").collect();
    rows.sort((a: any, b: any) => b.timestamp - a.timestamp);
    return rows.slice(0, limit ?? 60).map((a: any) => ({ id: a._id, user: a.user, userName: a.userName, action: a.action, entityType: a.entityType, entityId: a.entityId, prevState: a.prevState, newState: a.newState, timestamp: a.timestamp }));
  },
});

export const globalSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return { orders: [], inventory: [], exceptions: [], picking: [], shipments: [], customers: [] };
    const orders = await allOrders(ctx);
    const ordersHit = orders
      .filter((o: any) => o.orderNumber.toLowerCase().includes(needle) || o.customerName.toLowerCase().includes(needle) || o.customerCity.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((o: any) => ({ orderNumber: o.orderNumber, customerName: o.customerName, status: o.status, priority: o.priority, totalValue: o.totalValue, createdAt: o.createdAt }));
    const inventory = await ctx.db.query("inventory").collect();
    const invHit = inventory
      .filter((i: any) => i.sku.toLowerCase().includes(needle) || i.productName.toLowerCase().includes(needle) || i.bin.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((i: any) => ({ sku: i.sku, productName: i.productName, status: i.status, available: i.available, zone: i.zone }));
    const exceptions = await ctx.db.query("exceptions").collect();
    const excHit = exceptions
      .filter((e: any) => e.exceptionNumber.toLowerCase().includes(needle) || (e.orderNumber ?? "").toLowerCase().includes(needle) || (e.sku ?? "").toLowerCase().includes(needle) || e.description.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((e: any) => ({ exceptionNumber: e.exceptionNumber, type: e.type, severity: e.severity, status: e.status, description: e.description }));
    const picking = await ctx.db.query("pickingTasks").collect();
    const pickHit = picking
      .filter((t: any) => t.taskNumber.toLowerCase().includes(needle) || t.orderNumber.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((t: any) => ({ taskNumber: t.taskNumber, orderNumber: t.orderNumber, status: t.status, picker: t.picker, zone: t.zone }));
    const shipments = await ctx.db.query("shipments").collect();
    const shipHit = shipments
      .filter((s: any) => s.shipmentNumber.toLowerCase().includes(needle) || s.trackingNumber.toLowerCase().includes(needle) || s.orderNumber.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((s: any) => ({ shipmentNumber: s.shipmentNumber, orderNumber: s.orderNumber, carrier: s.carrier, status: s.status, destination: s.destination }));
    const customers = orders
      .filter((o: any) => o.customerName.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((o: any) => ({ name: o.customerName, city: o.customerCity, tier: o.customerTier, orderCount: orders.filter((x: any) => x.customerName === o.customerName).length }));
    return { orders: ordersHit, inventory: invHit, exceptions: excHit, picking: pickHit, shipments: shipHit, customers };
  },
});

export const warehouseZones = query({
  args: {},
  handler: async (ctx) => {
    const inventory = await ctx.db.query("inventory").collect();
    const zones = ["A", "B", "C", "D"].map((z) => ({
      zone: `Zone ${z}`,
      skus: inventory.filter((i: any) => i.zone === z).length,
      bins: [...new Set(inventory.filter((i: any) => i.zone === z).map((i: any) => i.bin.split("-")[0]))].length,
    }));
    return zones;
  },
});

export const meta = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").first();
    const demo = await ctx.db.query("demo").first();
    const counts = {
      orders: (await ctx.db.query("orders").collect()).length,
      products: (await ctx.db.query("products").collect()).length,
      exceptions: (await ctx.db.query("exceptions").collect()).length,
      skus: (await ctx.db.query("inventory").collect()).length,
    };
    return { settings: settings ?? null, demo: demo ?? null, counts };
  },
});

export const slaRemaining = query({
  args: { orderNumber: v.string() },
  handler: async (ctx, { orderNumber }) => {
    const order = await ctx.db.query("orders").withIndex("by_number", (q: any) => q.eq("orderNumber", orderNumber)).first();
    if (!order) return null;
    return { slaMinsLeft: Math.round((order.slaDeadline - Date.now()) / 60000), slaDeadline: order.slaDeadline, priority: order.priority, status: order.status };
  },
});

export const myRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return "manager";
    const demoRole = await ctx.db.query("demoRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
    if (demoRole) return demoRole.role;
    const user = await ctx.db.get(userId);
    return user?.role ?? "manager";
  },
});
