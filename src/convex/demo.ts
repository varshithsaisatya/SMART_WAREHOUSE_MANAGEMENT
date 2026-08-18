// ---------------------------------------------------------------------------
// Demo Mode — five predefined operational scenarios for the hackathon
// presentation. Each scenario follows the same arc:
//   Problem → AI Decision → User Approval → Operational Resolution
// Scenarios are idempotent: running the same one twice does not duplicate
// exceptions, recommendations, or notifications.
// ---------------------------------------------------------------------------

import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const HOUR = 3_600_000;

async function getOrCreateDemo(ctx: MutationCtx) {
  const demo = await ctx.db.query("demo").first();
  if (demo) return demo._id;
  return await ctx.db.insert("demo", { demoMode: false });
}

async function audit(ctx: MutationCtx, action: string, entity: string, prev: string, next: string) {
  await ctx.db.insert("auditLogs", {
    user: "Demo Mode",
    action,
    entityType: "warehouse",
    entityId: entity,
    prevState: prev,
    newState: next,
    timestamp: Date.now(),
  });
}

async function notify(ctx: MutationCtx, n: { title: string; message: string; type: any; severity: any; sku?: string; orderNumber?: string; link?: string }) {
  await ctx.db.insert("notifications", {
    title: n.title,
    message: n.message,
    type: n.type,
    severity: n.severity,
    sku: n.sku,
    orderNumber: n.orderNumber,
    link: n.link,
    read: false,
    createdAt: Date.now(),
  });
}

export const setDemoMode = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const demo = await getOrCreateDemo(ctx);
    await ctx.db.patch(demo, { demoMode: enabled, lastRunAt: Date.now() });
    return { ok: true };
  },
});

async function ensureException(ctx: MutationCtx, number: string, fields: any) {
  const existing = await ctx.db.query("exceptions").filter((q: any) => q.eq(q.field("exceptionNumber"), number)).first();
  if (existing) {
    await ctx.db.patch(existing._id, { ...fields, status: fields.status ?? existing.status });
    return existing._id;
  }
  return await ctx.db.insert("exceptions", { exceptionNumber: number, ...fields });
}

async function ensureRecommendation(ctx: MutationCtx, title: string, fields: any) {
  const existing = await ctx.db.query("recommendations").filter((q: any) => q.eq(q.field("title"), title)).first();
  if (existing) {
    if (existing.status === "ignored" || existing.status === "applied") {
      await ctx.db.patch(existing._id, { status: "pending", resolvedAt: undefined });
    }
    return existing._id;
  }
  return await ctx.db.insert("recommendations", { title, ...fields, createdAt: Date.now() });
}

async function resetDemoDoc(ctx: MutationCtx, scenario: string) {
  const demo = await getOrCreateDemo(ctx);
  await ctx.db.patch(demo, { demoMode: true, activeScenario: scenario, lastRunAt: Date.now() });
}

async function findOrder(ctx: MutationCtx, number: string) {
  return await ctx.db.query("orders").withIndex("by_number", (q: any) => q.eq("orderNumber", number)).first();
}

async function findInv(ctx: MutationCtx, sku: string) {
  return await ctx.db.query("inventory").withIndex("by_sku", (q: any) => q.eq("sku", sku)).first();
}

// ---------------------------------------------------------------------------

export const runScenario = mutation({
  args: { scenario: v.string() },
  handler: async (ctx, { scenario }) => {
    const now = Date.now();
    const scenarios = ["inventory_shortage", "picking_bottleneck", "damaged_item", "sla_risk", "stockout_risk"];
    if (!scenarios.includes(scenario)) return { ok: false, error: "Unknown scenario" };
    await resetDemoDoc(ctx, scenario);

    if (scenario === "inventory_shortage") {
      // --- Scenario 1: Inventory Shortage (flagship) ---
      const inv = await findInv(ctx, "WH-204");
      if (inv) {
        await ctx.db.patch(inv._id, { available: 7, reserved: 12, damaged: 0, status: "critical", lastUpdated: now });
      }
      const o52 = await findOrder(ctx, "ORD-1052");
      if (o52) {
        await ctx.db.patch(o52._id, { status: "confirmed", slaDeadline: now + 2 * HOUR, priority: "critical", allocatedAt: undefined });
      }
      const o56 = await findOrder(ctx, "ORD-1056");
      if (o56) {
        await ctx.db.patch(o56._id, { status: "confirmed", slaDeadline: now + 20 * HOUR, priority: "normal" });
      }
      // reset allocations to proposed
      const allocs = await ctx.db.query("allocations").collect();
      for (const a of allocs) {
        if (a.sku === "WH-204" && (a.orderNumber === "ORD-1052" || a.orderNumber === "ORD-1056")) {
          await ctx.db.patch(a._id, { status: "proposed", approvedAt: undefined });
        }
      }
      // exception + recommendation + notification
      await ensureException(ctx, "EXC-1008", {
        type: "stockout", severity: "critical", orderNumber: "ORD-1052", sku: "WH-204",
        description: "Only 7 units of WH-204 available but urgent order ORD-1052 requires 10 units.",
        detectedAt: now, status: "action_required", assignedUser: "Anita D.",
        suggestedResolution: "Allocate 7 units to the urgent order, backorder 3 units, trigger replenishment.",
        decision: "Allocate 7 units to urgent order ORD-1052.",
        resolution: "Backorder remaining 3 units and trigger replenishment recommendation for WH-204.",
      });
      await ensureRecommendation(ctx, "Allocate 7 of 10 units to ORD-1052", {
        category: "inventory", problem: "Only 7 units of WH-204 are available while critical order ORD-1052 requires 10.",
        reasoning: "ORD-1052 is Critical (Gold tier, express) with a 2h SLA. Allocating all 7 keeps the order moving; 3 units are backordered and ORD-1056 is blocked from consuming the stock.",
        recommendedAction: "Approve partial allocation — 7 units to ORD-1052, 3 units backordered.",
        impact: "SLA preserved for the urgent order; only 3 units delayed.", severity: "critical", status: "pending", orderNumber: "ORD-1052", sku: "WH-204",
      });
      await ensureRecommendation(ctx, "Backorder ORD-1056 (WH-204)", {
        category: "inventory", problem: "ORD-1056 (Normal) requires 5 units of WH-204 which is reserved for critical orders.",
        reasoning: "Stock must be protected for critical ORD-1052. ORD-1056 is backordered rather than consuming critical inventory.",
        recommendedAction: "Approve backorder of 5 units for ORD-1056.",
        impact: "Critical order protected; ORD-1056 ships when stock arrives.", severity: "medium", status: "pending", orderNumber: "ORD-1056", sku: "WH-204",
      });
      await ensureRecommendation(ctx, "Reorder 50 units of WH-204", {
        category: "replenishment", problem: "WH-204 (Wireless Keyboard) has 7 available units; projected demand exceeds stock within 3 days.",
        reasoning: "Available (7) is below reorder point (15). Forecast demand of 140 units/30d implies stockout in ~2 days at current consumption.",
        recommendedAction: "Create a replenishment order for 50 units.",
        impact: "Reduces projected stockout risk by ~82%.", severity: "high", status: "pending", sku: "WH-204",
      });
      await notify(ctx, { title: "Scenario: Inventory shortage", message: "WH-204 has 7 units; urgent ORD-1052 needs 10. AI recommends allocate 7 + backorder 3.", type: "urgent", severity: "critical", sku: "WH-204", orderNumber: "ORD-1052", link: "/allocation" });
      await audit(ctx, "Demo scenario activated", "Inventory Shortage", "—", "Conflict detected: 7 available vs 10 required");
      return { ok: true, scenario, message: "Conflict re-created: 7 units available vs 10 required by ORD-1052. Review the AI decision in Allocation." };
    }

    if (scenario === "picking_bottleneck") {
      const orders = await ctx.db.query("orders").collect();
      const candidates = orders.filter((o: any) => ["picking", "allocated"].includes(o.status) && o.orderNumber !== "ORD-1046").slice(0, 3);
      const pickCount = (await ctx.db.query("pickingTasks").collect()).length;
      for (let i = 0; i < candidates.length; i++) {
        const o = candidates[i];
        const existingTask = await ctx.db.query("pickingTasks").withIndex("by_order", (q: any) => q.eq("orderId", o._id)).first();
        if (existingTask) {
          await ctx.db.patch(existingTask._id, { status: "waiting", zone: "B" });
        } else {
          await ctx.db.insert("pickingTasks", {
            taskNumber: `PICK-${101 + pickCount + i}`,
            orderId: o._id,
            orderNumber: o.orderNumber,
            picker: "Unassigned",
            zone: "B",
            itemCount: o.itemCount,
            priority: o.priority,
            estimatedMinutes: 9 + i * 2,
            status: "waiting",
            createdAt: now,
          });
        }
      }
      await ensureException(ctx, "EXC-1013", {
        type: "picking_delay", severity: "high",
        description: "Picking queue in Zone B is overloaded — 5+ tasks waiting, average wait 15+ minutes.",
        detectedAt: now, status: "action_required", assignedUser: "Anita D.",
        suggestedResolution: "Rebalance 2 picking tasks from Zone B to Zone A.",
        decision: "Rebalance 2 picking tasks from Zone B to Zone A.",
      });
      await ensureRecommendation(ctx, "Zone B picking is 23% slower than average", {
        category: "bottleneck", problem: "Zone B has an overloaded picking queue with 5 waiting tasks.",
        reasoning: "Zone B average picking duration is 23% above the warehouse average and the queue keeps growing.",
        recommendedAction: "Rebalance 2 picking tasks from Zone B to Zone A.",
        impact: "Normalizes queue latency and reduces average delay by ~18 minutes.", severity: "high", status: "pending",
      });
      await notify(ctx, { title: "Scenario: Picking bottleneck", message: "Zone B queue overloaded — AI recommends rebalancing 2 tasks to Zone A.", type: "picking", severity: "high", link: "/picking" });
      await audit(ctx, "Demo scenario activated", "Picking Bottleneck", "Normal load", "Zone B overloaded");
      return { ok: true, scenario, message: "Zone B is now overloaded. See the bottleneck card on Picking / Analytics." };
    }

    if (scenario === "damaged_item") {
      const inv = await findInv(ctx, "WH-408");
      if (inv) {
        await ctx.db.patch(inv._id, { available: Math.max(0, inv.available - 1), damaged: inv.damaged + 1, status: "damaged", lastUpdated: now });
      }
      await ctx.db.insert("movements", {
        sku: "WH-408", productName: inv?.productName ?? "WH-408", type: "damaged", quantity: 1,
        reference: "DEMO", note: "Picked item reported damaged at packing station", timestamp: now, by: "Demo Mode",
      });
      await ensureException(ctx, "EXC-1014", {
        type: "damaged", severity: "high", sku: "WH-408",
        description: "A picked unit of WH-408 (Smart Wi-Fi Plug) was reported damaged at packing.",
        detectedAt: now, status: "open", assignedUser: "Ravi K.",
        suggestedResolution: "Quarantine the damaged unit, re-pick 1 unit, and file a claim with the supplier.",
      });
      await ensureRecommendation(ctx, "Re-pick damaged WH-408", {
        category: "exception", problem: "A picked unit of WH-408 was damaged during packing.",
        reasoning: "Re-picking 1 unit keeps the affected order on schedule; the damaged unit is quarantined for a supplier claim.",
        recommendedAction: "Quarantine damaged unit and re-pick 1 unit of WH-408.",
        impact: "Order stays on SLA; supplier claim recovers cost.", severity: "high", status: "pending", sku: "WH-408",
      });
      await notify(ctx, { title: "Scenario: Damaged item", message: "WH-408 picked unit reported damaged — exception created, re-pick recommended.", type: "damaged", severity: "high", sku: "WH-408", link: "/exceptions" });
      await audit(ctx, "Demo scenario activated", "Damaged Item", "1 healthy", "1 damaged (WH-408)");
      return { ok: true, scenario, message: "WH-408 flagged damaged with exception EXC-1014. Resolve it in the Exception Center." };
    }

    if (scenario === "sla_risk") {
      const o = await findOrder(ctx, "ORD-1046");
      if (o) {
        await ctx.db.patch(o._id, { slaDeadline: now + 45 * 60000, status: "picking" });
      }
      await ensureException(ctx, "EXC-1015", {
        type: "sla_risk", severity: "critical", orderNumber: "ORD-1046",
        description: "ORD-1046 (express, Silver tier) is at risk — only 45 minutes remain on its SLA.",
        detectedAt: now, status: "action_required", assignedUser: "Anita D.",
        suggestedResolution: "Prioritize the picking task and move ORD-1046 to the front of the queue.",
        decision: "Prioritize ORD-1046 and assign the best picker.",
      });
      await ensureRecommendation(ctx, "Watch SLA risk on ORD-1046", {
        category: "order_priority", problem: "ORD-1046 has 45 minutes left on its express SLA.",
        reasoning: "Picking is in progress but Zone B contention may breach the SLA. Front-loading this order protects the deadline.",
        recommendedAction: "Assign top picker and expedite ORD-1046 through picking → packing.",
        impact: "Maintains 100% SLA compliance for express orders.", severity: "critical", status: "pending", orderNumber: "ORD-1046",
      });
      await notify(ctx, { title: "Scenario: SLA risk", message: "ORD-1046 has 45 minutes left on its SLA — priority escalation recommended.", type: "sla", severity: "critical", orderNumber: "ORD-1046", link: "/orders/ORD-1046" });
      await audit(ctx, "Demo scenario activated", "SLA Risk", "3h remaining", "45m remaining (ORD-1046)");
      return { ok: true, scenario, message: "ORD-1046 now has 45 minutes left on its SLA. See the critical banner on Orders." };
    }

    // stockout_risk
    const inv = await findInv(ctx, "WH-813");
    if (inv) {
      await ctx.db.patch(inv._id, { available: 0, status: "out_of_stock", lastUpdated: now });
    }
    await ensureException(ctx, "EXC-1016", {
      type: "stockout", severity: "high", sku: "WH-813",
      description: "Demand forecast indicates WH-813 (Running Shoes) will stock out within 48 hours.",
      detectedAt: now, status: "open",
      suggestedResolution: "Place a replenishment order for 75 units.",
    });
    await ensureRecommendation(ctx, "Reorder 75 units of WH-813", {
      category: "replenishment", problem: "WH-813 (Running Shoes) may stock out within 48 hours.",
      reasoning: "Forecast demand (260 units/30d) with 0 available units points to an imminent stockout.",
      recommendedAction: "Reorder 75 units.",
      impact: "Reduces projected stockout risk by 82%.", severity: "high", status: "pending", sku: "WH-813",
    });
    await notify(ctx, { title: "Scenario: Stockout risk", message: "WH-813 projected to stock out within 48h — reorder 75 units.", type: "stock", severity: "high", sku: "WH-813", link: "/inventory/WH-813" });
    await audit(ctx, "Demo scenario activated", "Stockout Risk", "Healthy", "0 available (WH-813)");
    return { ok: true, scenario, message: "WH-813 flagged for stockout within 48h. Approve the replenishment recommendation." };
  },
});
