// ---------------------------------------------------------------------------
// Smart Decision Engine
// ---------------------------------------------------------------------------
// Deterministic decision logic that powers the "AI Operations Advisor".
// Every recommendation is computed from real warehouse data — no randomness,
// no fake AI. These functions are pure and shared by seeding, queries, and
// operational mutations so the system always reasons from actual state.
// ---------------------------------------------------------------------------

export type Priority = "critical" | "high" | "normal" | "low";
export type Risk = "low" | "medium" | "high" | "critical";

export interface PriorityInput {
  priority: Priority;
  slaDeadline: number; // epoch ms
  createdAt: number; // epoch ms
  totalValue: number;
  shippingMethod: "express" | "standard";
  inventoryReady: "full" | "partial" | "none"; // how much stock is available
  progressStage: number; // 0..6 (created → delivered)
  customerTier: "gold" | "silver" | "standard";
}

const TIER_SCORE: Record<string, number> = { gold: 5, silver: 3, standard: 1 };

/** SLA urgency component (0-40). Tighter deadlines score higher. */
export function slaUrgencyScore(deadline: number, now: number): number {
  const mins = Math.round((deadline - now) / 60000);
  if (mins <= 0) return 40;
  if (mins <= 60) return 36;
  if (mins <= 180) return 28;
  if (mins <= 480) return 18;
  if (mins <= 1440) return 9;
  return 3;
}

export function calculateOrderPriority(input: PriorityInput, now: number): number {
  const { priority, totalValue, shippingMethod, inventoryReady, progressStage, createdAt, slaDeadline, customerTier } = input;
  const customer = { critical: 18, high: 13, normal: 7, low: 2 }[priority] ?? 7;
  const ageHours = Math.max(0, (now - createdAt) / 3_600_000);
  const age = ageHours > 72 ? 10 : ageHours > 48 ? 8 : ageHours > 24 ? 6 : ageHours > 8 ? 4 : 1;
  const value = totalValue > 50_000 ? 10 : totalValue > 20_000 ? 7 : totalValue > 5_000 ? 4 : 1;
  const readiness = { full: 12, partial: 6, none: 0 }[inventoryReady] ?? 6;
  const shipping = shippingMethod === "express" ? 6 : 2;
  const progress = Math.min(6, Math.round(progressStage * 1.2));
  const tier = TIER_SCORE[customerTier] ?? 1;
  const total = slaUrgencyScore(slaDeadline, now) + customer + age + value + readiness + shipping + progress + tier;
  return Math.max(1, Math.min(100, total));
}

/** Human-readable explanation of why an order scored the way it did. */
export function priorityExplanation(input: PriorityInput, now: number): string {
  const mins = Math.round((input.slaDeadline - now) / 60000);
  const parts: string[] = [];
  if (mins <= 180) parts.push(`SLA ${formatDuration(mins)}`);
  parts.push(`${input.priority} customer priority`);
  const ageHours = Math.max(0, (now - input.createdAt) / 3_600_000);
  if (ageHours > 24) parts.push(`${Math.round(ageHours)}h old`);
  if (input.totalValue > 20_000) parts.push(`₹${formatINR(input.totalValue)} order value`);
  if (input.shippingMethod === "express") parts.push("express shipping");
  if (input.inventoryReady !== "none") parts.push("inventory available");
  if (input.inventoryReady === "none") parts.push("waiting on stock");
  return parts.length ? parts.join(" + ") : "standard fulfillment profile";
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${Math.max(0, mins)}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatINR(value: number): string {
  return value.toLocaleString("en-IN");
}

/** Risk level derived from SLA proximity, priority, and inventory readiness. */
export function calculateFulfillmentRisk(
  priority: Priority,
  slaDeadline: number,
  now: number,
  inventoryReady: "full" | "partial" | "none",
  progressStage: number,
): { risk: Risk; reason: string } {
  const minsLeft = Math.round((slaDeadline - now) / 60000);
  if (minsLeft < 0) return { risk: "critical", reason: "SLA deadline has already passed" };
  if (minsLeft < 60) return { risk: "critical", reason: `SLA expires in ${formatDuration(minsLeft)}` };
  if (minsLeft < 180) return { risk: "high", reason: `SLA expires in ${formatDuration(minsLeft)}` };
  if (inventoryReady === "none" && (priority === "critical" || priority === "high"))
    return { risk: "high", reason: "no stock available for a high-priority order" };
  if (inventoryReady === "partial" && priority === "critical")
    return { risk: "high", reason: "partial stock for a critical order" };
  if (minsLeft < 480) return { risk: "medium", reason: `SLA due in ${formatDuration(minsLeft)}` };
  return { risk: "low", reason: "on track within SLA window" };
}

// ---------------------------------------------------------------------------
// Inventory risk
// ---------------------------------------------------------------------------

export interface InventoryState {
  available: number;
  reserved: number;
  damaged: number;
  reorderPoint: number;
  demand30d: number;
  forecastDemand: number;
  reorderQty: number;
}

export type InventoryStatus = "healthy" | "low_stock" | "critical" | "out_of_stock" | "overstock" | "damaged";

export function detectInventoryRisk(stock: InventoryState): { status: InventoryStatus; risk: Risk; reason: string } {
  const total = stock.available + stock.reserved;
  if (stock.available <= 0 && total <= 0)
    return { status: "out_of_stock", risk: "critical", reason: "No units available or reserved" };
  if (stock.available <= 0)
    return { status: "critical", risk: "critical", reason: "All stock reserved, none available to fulfill" };
  if (stock.available <= stock.reorderPoint * 0.5)
    return { status: "critical", risk: "high", reason: `Available (${stock.available}) is below half the reorder point (${stock.reorderPoint})` };
  if (stock.available <= stock.reorderPoint)
    return { status: "low_stock", risk: "medium", reason: `Available (${stock.available}) at or below reorder point (${stock.reorderPoint})` };
  if (stock.available > stock.reorderPoint * 4)
    return { status: "overstock", risk: "low", reason: "Stock levels significantly exceed typical demand" };
  if (stock.damaged > 0)
    return { status: stock.available > stock.reorderPoint ? "healthy" : "low_stock", risk: "low", reason: `${stock.damaged} damaged units awaiting disposition` };
  return { status: "healthy", risk: "low", reason: "Stock above reorder point" };
}

/** Reorder recommendation: cover forecasted demand with a safety multiplier. */
export function recommendReorder(stock: InventoryState, now: number): { quantity: number; daysToStockout: number | null; rationale: string } | null {
  const projectedNeed = Math.max(0, stock.forecastDemand - stock.available);
  const dailyDemand = stock.demand30d / 30 || 1;
  const daysToStockout = stock.available > 0 ? stock.available / dailyDemand : 0;
  const urgent = stock.available <= stock.reorderPoint;
  const stockoutSoon = daysToStockout !== null && daysToStockout <= 3;
  if (!urgent && !stockoutSoon) return null;
  const quantity = Math.max(stock.reorderQty, Math.ceil(projectedNeed * 1.2 / 10) * 10);
  const rationale =
    stock.available <= 0
      ? "Stock is exhausted; immediate replenishment required."
      : `Projected demand (${stock.forecastDemand} units/30d) may exceed available stock (${stock.available} units) within ~${Math.ceil(daysToStockout)} days.`;
  return { quantity, daysToStockout, rationale };
}

// ---------------------------------------------------------------------------
// Allocation engine
// ---------------------------------------------------------------------------

export interface AllocationLine {
  orderNumber: string;
  sku: string;
  productName: string;
  requiredQty: number;
  availableQty: number; // unreserved stock available right now
  reservedQty: number; // already reserved for this or other orders
  priority: Priority;
  slaMinutesLeft: number;
}

export type AllocationDecision = "full" | "partial" | "backorder" | "reallocate";

export interface AllocationVerdict {
  orderNumber: string;
  sku: string;
  productName: string;
  requiredQty: number;
  availableQty: number;
  allocatedQty: number;
  backorderedQty: number;
  decision: AllocationDecision;
  reason: string;
  suggestedAction: string;
}

/**
 * Decide how to allocate scarce inventory across orders.
 * Rules (deterministic):
 *  - enough stock  -> fully allocate
 *  - some stock    -> allocate everything to the higher-priority order; partial for the rest
 *  - none          -> backorder, unless a lower-priority order is hoarding reserved stock
 *  - critical order with reserved stock held by low-priority orders -> suggest reallocate
 */
export function allocateInventory(lines: AllocationLine[]): AllocationVerdict[] {
  // Pool of reserved stock per sku that could be reclaimed from low-priority holders.
  return lines.map((line) => {
    const urgent = line.slaMinutesLeft <= 180 || line.priority === "critical";
    const available = Math.max(0, line.availableQty);

    if (available >= line.requiredQty) {
      return {
        orderNumber: line.orderNumber,
        sku: line.sku,
        productName: line.productName,
        requiredQty: line.requiredQty,
        availableQty: available,
        allocatedQty: line.requiredQty,
        backorderedQty: 0,
        decision: "full",
        reason: `All ${line.requiredQty} units available — no conflict.`,
        suggestedAction: "Approve full allocation",
      };
    }

    if (available > 0) {
      return {
        orderNumber: line.orderNumber,
        sku: line.sku,
        productName: line.productName,
        requiredQty: line.requiredQty,
        availableQty: available,
        allocatedQty: available,
        backorderedQty: line.requiredQty - available,
        decision: "partial",
        reason:
          line.priority === "critical" || urgent
            ? `Only ${available} of ${line.requiredQty} units available. Allocate all ${available} to keep the ${line.priority} order moving; backorder the rest.`
            : `Only ${available} of ${line.requiredQty} units available. Allocate ${available} now and backorder ${line.requiredQty - available} — demand exceeds supply for this SKU.`,
        suggestedAction: "Approve partial allocation",
      };
    }

    // No free stock.
    if (urgent && line.reservedQty > 0) {
      return {
        orderNumber: line.orderNumber,
        sku: line.sku,
        productName: line.productName,
        requiredQty: line.requiredQty,
        availableQty: 0,
        allocatedQty: 0,
        backorderedQty: 0,
        decision: "reallocate",
        reason: `No free stock, but ${line.reservedQty} units are reserved for lower-priority orders. Reclaim ${Math.min(line.requiredQty, line.reservedQty)} units to protect the SLA.`,
        suggestedAction: "Review reserved stock and reallocate",
      };
    }

    return {
      orderNumber: line.orderNumber,
      sku: line.sku,
      productName: line.productName,
      requiredQty: line.requiredQty,
      availableQty: 0,
      allocatedQty: 0,
      backorderedQty: line.requiredQty,
      decision: "backorder",
      reason: "No inventory available. Backorder and trigger replenishment.",
      suggestedAction: "Backorder + create reorder recommendation",
    };
  });
}

// ---------------------------------------------------------------------------
// Picking optimization
// ---------------------------------------------------------------------------

export interface PickTask {
  id: string;
  orderNumber: string;
  priority: Priority;
  slaDeadline: number;
  zone: string;
  createdAt: number;
  estimatedMinutes: number;
  status: string;
}

/** Score each waiting pick; lower = should be picked sooner. */
export function pickingTaskScore(t: PickTask, now: number): number {
  const prio = { critical: 0, high: 1, normal: 2, low: 3 }[t.priority] ?? 2;
  const minsLeft = (t.slaDeadline - now) / 60000;
  const urgency = minsLeft <= 60 ? 0 : minsLeft <= 180 ? 1 : minsLeft <= 480 ? 2 : 3;
  const ageHours = (now - t.createdAt) / 3_600_000;
  const age = ageHours > 12 ? 0 : ageHours > 4 ? 1 : 2;
  return prio * 10 + urgency * 4 + age;
}

export function prioritizedPickingQueue(tasks: PickTask[], now: number): PickTask[] {
  return [...tasks].sort((a, b) => pickingTaskScore(a, now) - pickingTaskScore(b, now));
}

/** Detect orders that share a zone -> batch picking opportunity. */
export function detectBatchOpportunities(
  tasks: PickTask[],
  zoneTaskCounts: Record<string, number>,
): { zone: string; orderCount: number; travelReductionPct: number }[] {
  const byZone: Record<string, number> = {};
  for (const t of tasks) byZone[t.zone] = (byZone[t.zone] ?? 0) + 1;
  const total = tasks.length || 1;
  const results: { zone: string; orderCount: number; travelReductionPct: number }[] = [];
  for (const [zone, count] of Object.entries(byZone)) {
    if (count >= 3) {
      // more orders in the same zone -> bigger travel saving
      const pct = Math.min(45, 12 + count * 4 + ((zoneTaskCounts[zone] ?? 1) > 6 ? 6 : 0));
      results.push({ zone, orderCount: count, travelReductionPct: pct });
    }
  }
  return results.sort((a, b) => b.orderCount - a.orderCount);
}

// ---------------------------------------------------------------------------
// Bottleneck detection
// ---------------------------------------------------------------------------

export interface BottleneckSignal {
  zone: string;
  avgMinutes: number;
  warehouseAvg: number;
  queueSize: number;
  exceptionCount: number;
  delayMinutes: number;
}

export interface Bottleneck {
  id: string;
  kind: string;
  zone: string;
  impact: string;
  avgDelay: number;
  suggestedAction: string;
  severity: Risk;
}

export function detectBottlenecks(signals: BottleneckSignal[]): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];
  for (const s of signals) {
    const slowdown = s.warehouseAvg > 0 ? (s.avgMinutes - s.warehouseAvg) / s.warehouseAvg : 0;
    if (slowdown > 0.15 && s.queueSize >= 2) {
      bottlenecks.push({
        id: `bn-${s.zone.toLowerCase()}`,
        kind: "picking",
        zone: s.zone,
        impact: `${s.queueSize} orders in queue, ${s.exceptionCount} open exceptions`,
        avgDelay: Math.round(s.avgMinutes - s.warehouseAvg),
        suggestedAction: `Rebalance ${Math.max(1, Math.round(s.queueSize / 3))} picking task${s.queueSize >= 3 ? "s" : ""} from Zone ${s.zone}`,
        severity: slowdown > 0.35 ? "high" : "medium",
      });
    }
  }
  return bottlenecks;
}

// ---------------------------------------------------------------------------
// Replenishment / stockout horizon
// ---------------------------------------------------------------------------

export function daysUntilStockout(available: number, demand30d: number): number | null {
  const daily = demand30d / 30;
  if (daily <= 0) return null;
  return available / daily;
}
