// ---------------------------------------------------------------------------
// Operational mutations — every action records an audit entry and, where
// meaningful, raises a notification. Decisions the engine recommends become
// real state changes here.
// ---------------------------------------------------------------------------

import { mutation, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const HOUR = 3_600_000;

async function currentUserName(ctx: MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return "System";
  const user = await ctx.db.get(userId);
  return user?.name || user?.email || "Operator";
}

async function logAudit(ctx: MutationCtx, opts: { action: string; entity: string; prev?: string; next?: string; user?: string; entityType?: string }) {
  const user = opts.user ?? (await currentUserName(ctx));
  await ctx.db.insert("auditLogs", {
    user,
    action: opts.action,
    entityType: opts.entityType ?? "warehouse",
    entityId: opts.entity,
    prevState: opts.prev,
    newState: opts.next,
    timestamp: Date.now(),
  });
}

async function notify(ctx: MutationCtx, n: { title: string; message: string; type: any; severity: any; orderId?: any; orderNumber?: string; sku?: string; link?: string }) {
  await ctx.db.insert("notifications", {
    title: n.title,
    message: n.message,
    type: n.type,
    severity: n.severity,
    orderId: n.orderId,
    orderNumber: n.orderNumber,
    sku: n.sku,
    link: n.link,
    read: false,
    createdAt: Date.now(),
  });
}

async function findOrderByNumber(ctx: MutationCtx, orderNumber: string) {
  return await ctx.db.query("orders").withIndex("by_number", (q: any) => q.eq("orderNumber", orderNumber)).first();
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export const approveAllocation = mutation({
  args: { allocId: v.id("allocations") },
  handler: async (ctx, { allocId }) => {
    const alloc = await ctx.db.get(allocId);
    if (!alloc) return { ok: false, error: "Allocation not found" };
    if (alloc.status !== "proposed") return { ok: false, error: "Allocation already processed" };

    const order = await ctx.db.get(alloc.orderId);
    if (!order) return { ok: false, error: "Order not found" };

    const now = Date.now();
    const user = await currentUserName(ctx);

    // apply to inventory
    const inv = await ctx.db.query("inventory").withIndex("by_sku", (q: any) => q.eq("sku", alloc.sku)).first();
    if (inv) {
      await ctx.db.patch(inv._id, {
        available: Math.max(0, inv.available - alloc.allocatedQty),
        reserved: inv.reserved + alloc.allocatedQty,
        lastUpdated: now,
      });
      await ctx.db.insert("movements", {
        sku: alloc.sku,
        productName: alloc.productName,
        type: "allocated",
        quantity: alloc.allocatedQty,
        reference: alloc.orderNumber,
        note: alloc.decision === "partial" ? "Partial allocation to critical order" : "Order allocation approved",
        timestamp: now,
        by: user,
      });
    }

    // update order items
    const items = await ctx.db.query("orderItems").withIndex("by_order", (q: any) => q.eq("orderId", alloc.orderId)).collect();
    for (const it of items) {
      if (it.sku === alloc.sku) {
        await ctx.db.patch(it._id, {
          allocatedQty: alloc.allocatedQty,
          backorderedQty: alloc.backorderedQty,
          status: alloc.allocatedQty >= it.quantity ? "allocated" : alloc.allocatedQty > 0 ? "partial" : "backordered",
        });
      }
    }

    // move order forward
    if (order.status === "created" || order.status === "confirmed") {
      await ctx.db.patch(order._id, { status: "allocated", allocatedAt: now });
    }

    await ctx.db.patch(alloc._id, { status: "approved", approvedAt: now });
    await logAudit(ctx, { action: "Allocation approved", entity: alloc.orderNumber, prev: "Proposed", next: `${alloc.decision} · ${alloc.allocatedQty}/${alloc.requiredQty} units`, user });

    if (alloc.backorderedQty > 0) {
      await notify(ctx, {
        title: "Backorder created",
        message: `${alloc.backorderedQty} units of ${alloc.sku} backordered for ${alloc.orderNumber} after ${alloc.decision} allocation.`,
        type: "stock", severity: alloc.priority === "critical" ? "critical" : "high",
        orderId: alloc.orderId, orderNumber: alloc.orderNumber, sku: alloc.sku,
        link: `/orders/${alloc.orderNumber}`,
      });
    } else {
      await notify(ctx, {
        title: "Allocation approved",
        message: `${alloc.allocatedQty} units of ${alloc.sku} allocated to ${alloc.orderNumber}.`,
        type: "system", severity: "info",
        orderId: alloc.orderId, orderNumber: alloc.orderNumber, sku: alloc.sku,
        link: `/orders/${alloc.orderNumber}`,
      });
    }

    // mark related pending recommendation applied
    const recs = await ctx.db.query("recommendations").collect();
    for (const r of recs) {
      if (r.status === "pending" && r.category === "inventory" && r.orderNumber === alloc.orderNumber && r.sku === alloc.sku) {
        await ctx.db.patch(r._id, { status: "applied", resolvedAt: now });
      }
    }

    return { ok: true, decision: alloc.decision };
  },
});

export const modifyAllocation = mutation({
  args: { allocId: v.id("allocations"), allocatedQty: v.number() },
  handler: async (ctx, { allocId, allocatedQty }) => {
    const alloc = await ctx.db.get(allocId);
    if (!alloc) return { ok: false, error: "Allocation not found" };
    if (alloc.status !== "proposed") return { ok: false, error: "Only proposed allocations can be modified" };
    const qty = Math.max(0, Math.min(alloc.requiredQty, Math.round(allocatedQty)));
    const user = await currentUserName(ctx);
    await ctx.db.patch(alloc._id, {
      allocatedQty: qty,
      backorderedQty: alloc.requiredQty - qty,
      decision: qty === 0 ? "backorder" : qty >= alloc.requiredQty ? "full" : "partial",
      reason: `Allocation manually adjusted by ${user}: ${qty} of ${alloc.requiredQty} units.`,
    });
    await logAudit(ctx, { action: "Allocation modified", entity: alloc.orderNumber, prev: `${alloc.allocatedQty}/${alloc.requiredQty}`, next: `${qty}/${alloc.requiredQty}`, user });
    return { ok: true, allocatedQty: qty };
  },
});

export const rejectAllocation = mutation({
  args: { allocId: v.id("allocations") },
  handler: async (ctx, { allocId }) => {
    const alloc = await ctx.db.get(allocId);
    if (!alloc) return { ok: false, error: "Allocation not found" };
    if (alloc.status !== "proposed") return { ok: false, error: "Allocation already processed" };
    const user = await currentUserName(ctx);
    await ctx.db.patch(alloc._id, { status: "rejected" });
    await logAudit(ctx, { action: "Allocation rejected", entity: alloc.orderNumber, prev: "Proposed", next: "Rejected", user });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------

export const startPicking = mutation({
  args: { taskId: v.id("pickingTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return { ok: false, error: "Task not found" };
    const user = await currentUserName(ctx);
    const now = Date.now();
    await ctx.db.patch(task._id, { status: "in_progress", startedAt: now, picker: user });
    const order = await findOrderByNumber(ctx, task.orderNumber);
    if (order && ["allocated", "confirmed", "created"].includes(order.status)) {
      await ctx.db.patch(order._id, { status: "picking", pickedAt: now });
    }
    await logAudit(ctx, { action: "Picking task started", entity: task.taskNumber, prev: "Assigned", next: "In progress", user });
    return { ok: true };
  },
});

export const completePicking = mutation({
  args: { taskId: v.id("pickingTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return { ok: false, error: "Task not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    await ctx.db.patch(task._id, { status: "completed", completedAt: now });

    const order = await findOrderByNumber(ctx, task.orderNumber);
    const items = order ? await ctx.db.query("orderItems").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).collect() : [];
    for (const it of items) {
      await ctx.db.patch(it._id, { pickedQty: it.quantity, status: "picked" });
    }

    if (order && ["picking", "allocated"].includes(order.status)) {
      await ctx.db.patch(order._id, { status: "packing", packedAt: now });
      // ensure a packing task exists
      const existing = await ctx.db.query("packingTasks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first();
      if (!existing) {
        const packCount = (await ctx.db.query("packingTasks").collect()).length;
        await ctx.db.insert("packingTasks", {
          taskNumber: `PACK-${201 + packCount}`,
          orderId: order._id,
          orderNumber: order.orderNumber,
          station: `Station P${(packCount % 4) + 1}`,
          itemCount: order.itemCount,
          weightKg: Math.round(order.totalValue * 0.001 * 10) / 10 + 0.5,
          packagingType: "Corrugated Box M",
          status: "waiting",
          createdAt: now,
        });
      }
      const qc = await ctx.db.query("qualityChecks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first();
      if (!qc) {
        await ctx.db.insert("qualityChecks", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          itemQuantityVerified: false,
          skuVerified: false,
          damageCheck: false,
          packagingVerified: false,
          addressVerified: false,
          status: "pending",
        });
      }
    }

    await logAudit(ctx, { action: "Picking task completed", entity: task.taskNumber, prev: "In progress", next: "Completed", user });
    await notify(ctx, {
      title: "Picking completed",
      message: `${task.taskNumber} completed for ${task.orderNumber} — moved to packing.`,
      type: "picking", severity: "info", orderId: order?._id, orderNumber: task.orderNumber, link: `/orders/${task.orderNumber}`,
    });
    return { ok: true };
  },
});

export const assignPicker = mutation({
  args: { taskId: v.id("pickingTasks"), picker: v.string() },
  handler: async (ctx, { taskId, picker }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return { ok: false, error: "Task not found" };
    const user = await currentUserName(ctx);
    await ctx.db.patch(task._id, { status: "assigned", picker });
    await logAudit(ctx, { action: "Picker assigned", entity: task.orderNumber, prev: "Waiting", next: `Assigned → ${picker}`, user });
    await notify(ctx, {
      title: "Picking task assigned",
      message: `${picker} assigned to ${task.taskNumber} for ${task.orderNumber}.`,
      type: "picking", severity: "info", orderNumber: task.orderNumber, link: "/picking",
    });
    return { ok: true };
  },
});

export const createPickingBatch = mutation({
  args: { zone: v.string(), orderNumbers: v.array(v.string()) },
  handler: async (ctx, { zone, orderNumbers }) => {
    const user = await currentUserName(ctx);
    const now = Date.now();
    const batch = `BATCH-Z${zone}-${Math.floor(now / 60000) % 1000}`;
    for (const on of orderNumbers) {
      const task = await ctx.db.query("pickingTasks").withIndex("by_order", (q: any) => q.eq("orderNumber", on)).first();
      if (task && task.status === "waiting") {
        await ctx.db.patch(task._id, { batchGroup: batch, status: "assigned" });
      }
    }
    await logAudit(ctx, { action: "Picking batch created", entity: batch, prev: `${orderNumbers.length} tasks`, next: "1 batch", user });
    await notify(ctx, { title: "Picking batch created", message: `Batch ${batch} groups ${orderNumbers.length} orders in Zone ${zone}.`, type: "picking", severity: "info", link: "/picking" });
    return { ok: true as boolean, batch, error: undefined as string | undefined };
  },
});

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

export const startPacking = mutation({
  args: { taskId: v.id("packingTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return { ok: false, error: "Task not found" };
    const user = await currentUserName(ctx);
    const now = Date.now();
    await ctx.db.patch(task._id, { status: "packing", startedAt: now });
    const order = await findOrderByNumber(ctx, task.orderNumber);
    if (order && order.status === "packing") await ctx.db.patch(order._id, { status: "packing", packedAt: now });
    await logAudit(ctx, { action: "Packing started", entity: task.taskNumber, prev: "Waiting", next: "Packing", user });
    return { ok: true };
  },
});

export const completePacking = mutation({
  args: { taskId: v.id("packingTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return { ok: false, error: "Task not found" };
    const user = await currentUserName(ctx);
    const now = Date.now();
    await ctx.db.patch(task._id, { status: "qc_required", completedAt: now });
    const order = await findOrderByNumber(ctx, task.orderNumber);
    if (order && ["packing", "allocated", "picking"].includes(order.status)) {
      await ctx.db.patch(order._id, { status: "quality_check", packedAt: now, qcAt: undefined });
    }
    const qc = order ? await ctx.db.query("qualityChecks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first() : null;
    if (qc && qc.status === "pending") {
      await ctx.db.patch(qc._id, { status: "pending" });
    }
    await logAudit(ctx, { action: "Order packed", entity: task.orderNumber, prev: "Packing", next: "Quality check required", user });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Quality check
// ---------------------------------------------------------------------------

export const passQC = mutation({
  args: { orderNumber: v.string() },
  handler: async (ctx, { orderNumber }) => {
    const order = await findOrderByNumber(ctx, orderNumber);
    if (!order) return { ok: false, error: "Order not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    const qc = await ctx.db.query("qualityChecks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first();
    if (qc) {
      await ctx.db.patch(qc._id, { status: "passed", checkedAt: now, itemQuantityVerified: true, skuVerified: true, damageCheck: true, packagingVerified: true, addressVerified: true });
    } else {
      await ctx.db.insert("qualityChecks", { orderId: order._id, orderNumber, itemQuantityVerified: true, skuVerified: true, damageCheck: true, packagingVerified: true, addressVerified: true, status: "passed", checkedAt: now });
    }
    await ctx.db.patch(order._id, { status: "ready", qcAt: now });
    await logAudit(ctx, { action: "QC passed", entity: orderNumber, prev: "Quality check", next: "Ready to dispatch", user });
    // ensure shipment exists
    const existing = await ctx.db.query("shipments").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first();
    if (!existing) {
      const shipCount = (await ctx.db.query("shipments").collect()).length;
      await ctx.db.insert("shipments", {
        shipmentNumber: `SHP-${301 + shipCount}`,
        orderId: order._id,
        orderNumber,
        carrier: order.carrier ?? "Delhivery",
        trackingNumber: `GEN${String(100000 + shipCount * 17)}IN`,
        destination: `${order.customerCity}, India`,
        status: "ready",
        scheduledAt: now + 3 * HOUR,
        risk: "low",
      });
    }
    return { ok: true };
  },
});

export const failQC = mutation({
  args: { orderNumber: v.string(), reason: v.string() },
  handler: async (ctx, { orderNumber, reason }) => {
    const order = await findOrderByNumber(ctx, orderNumber);
    if (!order) return { ok: false, error: "Order not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    const qc = await ctx.db.query("qualityChecks").withIndex("by_order", (q: any) => q.eq("orderId", order._id)).first();
    if (qc) {
      await ctx.db.patch(qc._id, { status: "failed", checkedAt: now, failedReason: reason });
    }
    await ctx.db.patch(order._id, { status: "exception" });
    const excCount = (await ctx.db.query("exceptions").collect()).length;
    await ctx.db.insert("exceptions", {
      exceptionNumber: `EXC-${1001 + excCount}`,
      type: "qc_failure",
      severity: "high",
      orderId: order._id,
      orderNumber,
      description: `QC failed for ${orderNumber}: ${reason}`,
      detectedAt: now,
      assignedUser: undefined,
      suggestedResolution: "Re-pick affected items and re-run quality check before dispatch.",
      status: "action_required",
    });
    await logAudit(ctx, { action: "QC failed", entity: orderNumber, prev: "Quality check", next: "Exception", user });
    await notify(ctx, { title: "QC failure", message: `${orderNumber} failed quality check: ${reason}`, type: "qc", severity: "high", orderId: order._id, orderNumber, link: `/exceptions` });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export const dispatchShipment = mutation({
  args: { shipmentId: v.id("shipments") },
  handler: async (ctx, { shipmentId }) => {
    const shipment = await ctx.db.get(shipmentId);
    if (!shipment) return { ok: false, error: "Shipment not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    await ctx.db.patch(shipment._id, { status: "dispatched", dispatchedAt: now, risk: "low" });
    const order = await ctx.db.get(shipment.orderId);
    if (order) {
      const onTime = order.slaDeadline >= now;
      await ctx.db.patch(order._id, { status: "dispatched", dispatchedAt: now, slaMet: onTime });
    }
    await logAudit(ctx, { action: "Shipment dispatched", entity: shipment.shipmentNumber, prev: "Ready", next: `Dispatched (${shipment.carrier})`, user });
    await notify(ctx, { title: "Shipment dispatched", message: `${shipment.shipmentNumber} dispatched via ${shipment.carrier} to ${shipment.destination}.`, type: "dispatch", severity: "info", orderId: shipment.orderId, orderNumber: shipment.orderNumber, link: "/dispatch" });
    return { ok: true };
  },
});

export const markDelivered = mutation({
  args: { shipmentId: v.id("shipments") },
  handler: async (ctx, { shipmentId }) => {
    const shipment = await ctx.db.get(shipmentId);
    if (!shipment) return { ok: false, error: "Shipment not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    await ctx.db.patch(shipment._id, { status: "delivered" });
    const order = await ctx.db.get(shipment.orderId);
    if (order) {
      const slaMet = order.slaDeadline >= now;
      await ctx.db.patch(order._id, { status: "delivered", deliveredAt: now, slaMet });
    }
    await logAudit(ctx, { action: "Order delivered", entity: shipment.orderNumber, prev: "Dispatched", next: "Delivered", user });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Replenishment
// ---------------------------------------------------------------------------

export const createReorderOrder = mutation({
  args: { sku: v.string() },
  handler: async (ctx, { sku }) => {
    const inv = await ctx.db.query("inventory").withIndex("by_sku", (q: any) => q.eq("sku", sku)).first();
    if (!inv) return { ok: false, error: "SKU not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    const qty = inv.reorderQty;
    await ctx.db.insert("movements", {
      sku,
      productName: inv.productName,
      type: "ordered",
      quantity: qty,
      reference: `PO-${Math.floor(now / 1000)}`,
      note: "Purchase order placed — expected receipt in 3 days",
      timestamp: now,
      by: user,
    });
    // mark replenishment recommendation applied
    const recs = await ctx.db.query("recommendations").collect();
    for (const r of recs) {
      if (r.status === "pending" && r.category === "replenishment" && r.sku === sku) {
        await ctx.db.patch(r._id, { status: "applied", resolvedAt: now });
      }
    }
    // resolve related stockout exceptions
    const excs = await ctx.db.query("exceptions").collect();
    for (const e of excs) {
      if (e.status !== "resolved" && e.sku === sku && (e.type === "stockout" || e.type === "sla_risk")) {
        await ctx.db.patch(e._id, { status: "resolved", resolvedAt: now, resolution: e.resolution ?? "Replenishment order placed", resolutionNote: `Replenishment order placed for ${qty} units.` });
      }
    }
    await logAudit(ctx, { action: "Replenishment ordered", entity: sku, prev: `${inv.available} available`, next: `${qty} units ordered`, user });
    await notify(ctx, { title: "Replenishment ordered", message: `${qty} units of ${sku} ordered — ETA 3 days.`, type: "stock", severity: "info", sku, link: `/inventory/${sku}` });
    return { ok: true, quantity: qty };
  },
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export const approveRecommendation = mutation({
  args: { recId: v.id("recommendations") },
  handler: async (ctx, { recId }) => {
    const rec = await ctx.db.get(recId);
    if (!rec) return { ok: false, error: "Recommendation not found" };
    if (rec.status !== "pending") return { ok: false, error: "Already processed" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    await ctx.db.patch(rec._id, { status: "approved", resolvedAt: now });
    await logAudit(ctx, { action: "AI recommendation approved", entity: rec.title, prev: "Pending", next: "Approved", user });

    let applied = false;
    // inventory allocation rec → approve the proposed allocation
    if (rec.category === "inventory" && rec.orderNumber) {
      const allocs = await ctx.db.query("allocations").collect();
      const target = allocs.find((a: any) => a.orderNumber === rec.orderNumber && a.sku === rec.sku && a.status === "proposed");
      if (target) {
        await ctx.runMutation(api.warehouse.approveAllocation, { allocId: target._id });
        applied = true;
      }
    }
    // order priority rec → bump the order
    if (rec.category === "order_priority" && rec.orderNumber) {
      const order = await findOrderByNumber(ctx, rec.orderNumber);
      if (order && order.priority !== "critical") {
        await ctx.db.patch(order._id, { priority: "critical" });
        await logAudit(ctx, { action: "Order priority changed", entity: rec.orderNumber, prev: order.priority, next: "critical", user });
        applied = true;
      }
    }
    // replenishment rec → place the order
    if (rec.category === "replenishment" && rec.sku) {
      await ctx.runMutation(api.warehouse.createReorderOrder, { sku: rec.sku });
      applied = true;
    }
    return { ok: true, applied };
  },
});

export const ignoreRecommendation = mutation({
  args: { recId: v.id("recommendations") },
  handler: async (ctx, { recId }) => {
    const rec = await ctx.db.get(recId);
    if (!rec) return { ok: false, error: "Recommendation not found" };
    if (rec.status !== "pending") return { ok: false, error: "Already processed" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    await ctx.db.patch(rec._id, { status: "ignored", resolvedAt: now });
    await logAudit(ctx, { action: "AI recommendation ignored", entity: rec.title, prev: "Pending", next: "Ignored", user });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export const resolveException = mutation({
  args: { excId: v.id("exceptions"), note: v.optional(v.string()) },
  handler: async (ctx, { excId, note }) => {
    const exc = await ctx.db.get(excId);
    if (!exc) return { ok: false, error: "Exception not found" };
    const now = Date.now();
    const user = await currentUserName(ctx);
    await ctx.db.patch(exc._id, {
      status: "resolved",
      resolvedAt: now,
      resolutionNote: note ?? exc.resolution ?? "Resolution approved by supervisor.",
    });
    await logAudit(ctx, { action: "Exception resolved", entity: exc.exceptionNumber, prev: "Open / action required", next: "Resolved", user });
    await notify(ctx, { title: "Exception resolved", message: `${exc.exceptionNumber} marked resolved.`, type: "exception", severity: "info", orderId: exc.orderId, orderNumber: exc.orderNumber, sku: exc.sku, link: "/exceptions" });
    // stockout resolution → mark replenishment rec applied
    if (exc.type === "stockout" && exc.sku) {
      const recs = await ctx.db.query("recommendations").collect();
      for (const r of recs) {
        if (r.status === "pending" && r.category === "replenishment" && r.sku === exc.sku) {
          await ctx.db.patch(r._id, { status: "applied", resolvedAt: now });
        }
      }
    }
    return { ok: true };
  },
});

export const escalateException = mutation({
  args: { excId: v.id("exceptions") },
  handler: async (ctx, { excId }) => {
    const exc = await ctx.db.get(excId);
    if (!exc) return { ok: false, error: "Exception not found" };
    const user = await currentUserName(ctx);
    await ctx.db.patch(exc._id, { status: "escalated" });
    await logAudit(ctx, { action: "Exception escalated", entity: exc.exceptionNumber, prev: exc.status, next: "Escalated", user });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const markNotificationRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { read: true });
    return { ok: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("notifications").collect();
    for (const n of rows) if (!n.read) await ctx.db.patch(n._id, { read: true });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const setDemoRole = mutation({
  args: { role: v.union(v.literal("manager"), v.literal("operator"), v.literal("supervisor"), v.literal("admin")) },
  handler: async (ctx, { role }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, error: "Not signed in" };
    const existing = await ctx.db.query("demoRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { role });
    } else {
      await ctx.db.insert("demoRoles", { userId, role });
    }
    return { ok: true, role };
  },
});

export const updateSettings = mutation({
  args: {
    warehouseName: v.optional(v.string()),
    defaultSlaHours: v.optional(v.number()),
    lowStockThresholdPct: v.optional(v.number()),
    reorderMultiplier: v.optional(v.number()),
    slaUrgencyWindowMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("settings").first();
    if (!settings) return { ok: false, error: "Settings not found" };
    const user = await currentUserName(ctx);
    await ctx.db.patch(settings._id, { ...args });
    await logAudit(ctx, { action: "Warehouse settings updated", entity: settings.warehouseName, prev: "—", next: Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(", "), user });
    return { ok: true };
  },
});

export const bootstrapUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false };
    const user = await ctx.db.get(userId);
    if (user) {
      const patch: { role?: any; displayName?: string } = {};
      if (!user.role) patch.role = "manager";
      if (!user.displayName) patch.displayName = user.name || user.email || "Warehouse Manager";
      if (Object.keys(patch).length) await ctx.db.patch(userId, patch);
      // ensure demo doc + settings exist
      const demo = await ctx.db.query("demo").first();
      if (!demo) await ctx.db.insert("demo", { demoMode: false });
      const settings = await ctx.db.query("settings").first();
      if (!settings) {
        await ctx.db.insert("settings", { warehouseName: "Pragati Fulfilment Hub", defaultSlaHours: 24, lowStockThresholdPct: 20, reorderMultiplier: 1.2, slaUrgencyWindowMinutes: 180 });
      }
    }
    return { ok: true };
  },
});


