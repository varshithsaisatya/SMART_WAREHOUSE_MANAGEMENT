// ---------------------------------------------------------------------------
// Deterministic seed data for SmartFulfill AI
// ---------------------------------------------------------------------------
// The entire demo is generated from a fixed PRNG seed, so every run produces
// the same warehouse. Includes the flagship presentation scenario:
//   ORD-1052 (critical) needs 10 × WH-204, only 7 available,
//   ORD-1056 (normal) wants 5 × WH-204 → system detects the conflict,
//   recommends allocation + backorder + replenishment, raises an exception
//   and an alert, and tracks the resolution.
// ---------------------------------------------------------------------------

import { mutation } from "./_generated/server";
import { v, Infer } from "convex/values";

type OrderId = Infer<ReturnType<typeof v.id<"orders">>>;
type ProductId = Infer<ReturnType<typeof v.id<"products">>>;
import {
  allocateInventory,
  calculateOrderPriority,
  calculateFulfillmentRisk,
  detectInventoryRisk,
} from "./engine";

// --- deterministic PRNG (mulberry32) ---
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CATEGORIES: [string, string[]][] = [
  ["Electronics", ["Wireless Keyboard", "Mechanical Keyboard", "Gaming Mouse", '27" LED Monitor', "USB-C Hub 7-in-1", "Webcam 1080p", "Bluetooth Speaker", "Noise-Cancel Headphones", "Portable SSD 1TB", "Smart Watch"]],
  ["Mobile Accessories", ["USB-C Cable 2m", "Fast Charger 65W", "Wireless Charger Pad", "Phone Case - iPhone", "Phone Case - Android", "Power Bank 20000mAh", "Tempered Glass Screen Guard", "Car Phone Mount", "TWS Earbuds Pro", "SD Card 128GB"]],
  ["Home & Kitchen", ["LED Desk Lamp", "Air Fryer 5L", "Electric Kettle 1.5L", "Drip Coffee Maker", "Blender 750W", "Toaster 2-Slice", "Rice Cooker 5L", "Vacuum Cleaner 1600W", "Smart Wi-Fi Plug", "Ceiling Fan 1200mm"]],
  ["Office", ["Ergonomic Office Chair", "Standing Desk 120cm", "Paper Shredder", "Label Printer", "Desk Organizer Tray", "Whiteboard A2", "Ergonomic Footrest", "Document Tray Set", "Heavy Duty Stapler", "Electric Pencil Sharpener"]],
  ["Apparel", ["Cotton T-Shirt (Pack of 3)", "Polo Shirt", "Fleece Jacket", "Baseball Cap", "Sports Socks (6-Pack)", "Leather Belt", "Winter Scarf", "Unisex Hoodie", "Joggers", "Thermal Innerwear"]],
  ["Grocery & FMCG", ["Instant Coffee 200g", "Green Tea 100 Bags", "Breakfast Muesli 1kg", "Peanut Butter 500g", "Olive Oil 1L", "Basmati Rice 5kg", "Whole Wheat Flour 5kg", "Tomato Ketchup 500g", "Pure Honey 500g", "Protein Bars (12-Pack)"]],
  ["Sports & Fitness", ["Yoga Mat 6mm", "Dumbbell Set 10kg", "Resistance Bands Kit", "Skipping Rope", "Insulated Water Bottle 1L", "Gym Gloves", "Foam Roller", "Smart Jump Rope", "Kettlebell 8kg", "Running Shoes"]],
  ["Stationery", ["A4 Paper Ream", "Gel Pens (10-Pack)", "Hardbound Notebook A5", "Highlighter Set", "Sticky Notes Pack", "Binder Clips Assorted", "File Folders (20-Pack)", "Desk Calendar", "Correction Tape", "Ruler Set"]],
  ["Tools & Hardware", ["Cordless Drill 12V", "Screwdriver Set 32pc", "Tape Measure 5m", "Toolbox 19-Inch", "LED Work Light", "Utility Knife", "Claw Hammer 500g", "Pliers Set", "Spirit Level 60cm", "Safety Goggles"]],
  ["Pet Supplies", ["Dog Food 5kg", "Cat Litter 10L", "Pet Grooming Kit", "Dog Leash 2m", "Cat Toy (10-Pack)", "Bird Seed 2kg", "Pet Shampoo 500ml", "Fish Tank Filter", "Hamster Cage Small", "Pet Bed Medium"]],
];

const NAMES = [
  "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Ananya Iyer", "Vikram Singh", "Neha Gupta", "Arjun Nair",
  "Kavya Reddy", "Aditya Kulkarni", "Sneha Joshi", "Karan Malhotra", "Ishita Bose", "Rahul Verma", "Pooja Desai",
  "Amit Chawla", "Divya Menon", "Suresh Kumar", "Meera Krishnan", "Naveen Rao", "Tanvi Shah", "Harsh Vardhan",
  "Ritu Agarwal", "Deepak Mishra", "Shreya Pillai", "Manish Jain", "Anjali Nambiar", "Siddharth Ghosh",
  "Lakshmi Subramanian", "Gaurav Kapoor", "Nidhi Saxena", "Rajesh Tiwari", "Aisha Khan", "Kunal Chopra",
  "Rhea D'Souza", "Varun Bhatia", "Simran Kaur", "Abhishek Roy", "Nikhil Bansal", "Farhan Sheikh", "Shruti Prasad",
];

const CITIES = ["Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Lucknow", "Surat", "Indore", "Gurugram", "Nagpur"];

const PICKERS = ["Priya N.", "Ravi K.", "Sameer J.", "Anita D.", "Kiran P.", "Deepa M.", "Manoj S.", "Neha R."];
const STATIONS = ["Station P1", "Station P2", "Station P3", "Station P4"];
const CARRIERS = ["BlueDart", "Delhivery", "DTDC", "Ecom Express", "Shadowfax", "XpressBees"];
const PACKAGING = ["Corrugated Box S", "Corrugated Box M", "Poly Mailer", "Fragile Box", "Carton + Cushioning"];

const PRIORITIES = ["normal", "normal", "normal", "high", "high", "critical", "low"] as const;
const TIERS = ["standard", "standard", "silver", "gold"] as const;

interface SeedRefs {
  orders: Record<string, { id: OrderId; createdAt: number; slaDeadline: number; priority: string; totalValue: number; shippingMethod: string; status: string; tier: string }>;
  products: Record<string, { id: ProductId; name: string; price: number }>;
  invBySku: Record<string, { available: number; reserved: number }>;
}

export const seedEverything = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const existing = await ctx.db.query("products").first();
    if (existing && !force) {
      return { seeded: false, reason: "already-seeded" };
    }

    if (existing && force) {
      for (const table of ["products", "inventory", "orders", "orderItems", "allocations", "pickingTasks", "packingTasks", "qualityChecks", "exceptions", "shipments", "notifications", "recommendations", "movements", "auditLogs", "settings", "demo"] as const) {
        const docs = await ctx.db.query(table).collect();
        for (const d of docs) await ctx.db.delete(d._id);
      }
    }

    const rng = mulberry32(20260818);
    const now = Date.now();
    const refs: SeedRefs = { orders: {}, products: {}, invBySku: {} };

    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

    // ------------------------------------------------------------------
    // Products (100) + inventory (100)
    // ------------------------------------------------------------------
    const skuList: string[] = [];
    let skuIndex = 0;
    for (const [category, names] of CATEGORIES) {
      const catIndex = CATEGORIES.findIndex(([c]) => c === category);
      const offset = 204 + catIndex * 100; // Electronics -> WH-2xx … Pet -> WH-11xx, so WH-204 = Wireless Keyboard
      for (const name of names) {
        const nameIdx = names.indexOf(name);
        skuIndex += 1;
        const sku = `WH-${offset + nameIdx}`;
        skuList.push(sku);
        const price = Math.round((200 + rng() * 4200 + (category === "Grocery & FMCG" ? -100 : 0)) * 100) / 100;
        const prod = await ctx.db.insert("products", {
          sku,
          name,
          category,
          price,
          weightGrams: Math.round(100 + rng() * 4800),
          color: pick(["Black", "White", "Blue", "Silver", "Red", "Grey", "Teal", "Beige"]),
          supplier: pick(["TechMint India", "FulfilPro Pvt Ltd", "Apex Distributors", "Omni Supply Co", "Nova Traders", "BrightPath Wholesale"]),
        });
        refs.products[sku] = { id: prod, name, price };
        void catIndex;

        // --- inventory ---
        const zone = skuIndex <= 25 ? "A" : skuIndex <= 50 ? "B" : skuIndex <= 75 ? "C" : "D";
        const bin = `${zone}-${String(Math.ceil(skuIndex / 10)).padStart(2, "0")}-${String(((skuIndex * 7) % 9) + 1).padStart(2, "0")}`;
        let reorderPoint = Math.round(8 + rng() * 26);
        let reorderQty = Math.round((30 + rng() * 90) / 10) * 10;
        let demand30d = Math.round(40 + rng() * 260);
        let forecastDemand = Math.round(demand30d * (0.9 + rng() * 0.4));

        let available: number;
        let damaged = 0;
        let status: string;
        let reserved: number;

        // flagship scenario SKU: WH-204 Wireless Keyboard (7 available / 12 reserved / reorder point 15 / critical)
        if (sku === "WH-204") {
          available = 7;
          reserved = 12;
          damaged = 0;
          status = "critical";
          reorderPoint = 15;
          reorderQty = 50;
          demand30d = 70;
          forecastDemand = 48; // projected demand exceeds stock within ~3 days -> engine recommends reorder 50
        } else if (skuIndex % 37 === 0 || skuIndex === 69) {
          // WH-813 (Running Shoes) is the demo stockout SKU
          available = 0; status = "out_of_stock";
          reserved = Math.round(rng() * 4);
        } else if (skuIndex % 23 === 0) {
          available = Math.max(1, Math.round(reorderPoint * (0.2 + rng() * 0.3)));
          status = "critical"; reserved = Math.round(reorderPoint * (0.3 + rng() * 0.4));
        } else if (skuIndex % 29 === 0) {
          available = reorderPoint * (5 + rng() * 3);
          status = "overstock"; reserved = Math.round(available * 0.15);
        } else if (skuIndex === 88) {
          available = reorderPoint * 2 + 6;
          status = "healthy"; reserved = Math.round(available * 0.2);
          damaged = 3;
        } else if (skuIndex % 7 === 0) {
          available = Math.max(1, Math.round(reorderPoint * (0.55 + rng() * 0.35)));
          status = "low_stock"; reserved = Math.round(reorderPoint * 0.3);
        } else {
          available = reorderPoint * (2 + rng() * 3.5);
          status = "healthy"; reserved = Math.round(available * (0.1 + rng() * 0.2));
          if (skuIndex % 13 === 0 && rng() < 0.5) damaged = Math.round(rng() * 2);
        }

        // keep status coherent with the engine
        const eng = detectInventoryRisk({ available, reserved, damaged, reorderPoint, demand30d, forecastDemand, reorderQty });
        if (eng.status !== "overstock" && sku !== "WH-204") status = eng.status;

        const inv = await ctx.db.insert("inventory", {
          sku, productName: name, category, zone, bin,
          available, reserved, damaged,
          reorderPoint, reorderQty, status: status as any,
          forecastDemand, demand30d, price,
          lastUpdated: now - Math.round(rng() * 3 * DAY),
        });
        void inv;
        refs.invBySku[sku] = { available, reserved };
      }
    }

    // ------------------------------------------------------------------
    // Orders (66) + items + allocations
    // ------------------------------------------------------------------
    const orderNumbers: string[] = [];
    for (let i = 0; i < 66; i++) orderNumbers.push(`ORD-${1001 + i}`);

    // status plan by index
    const statusPlan = (i: number): string => {
      if (i <= 14) return "delivered";
      if (i <= 20) return "dispatched";
      if (i <= 25) return "ready";
      if (i <= 28) return "quality_check";
      if (i <= 33) return "packing";
      if (i <= 43) return "picking";
      if (i <= 50) return "allocated";
      if (i <= 58) return "confirmed";
      if (i <= 63) return "created";
      if (i === 64) return "exception";
      return "cancelled";
    };

    const STAGE_OF_STATUS: Record<string, number> = {
      created: 0, confirmed: 1, allocated: 2, picking: 3, packing: 4, quality_check: 5,
      ready: 5, dispatched: 6, delivered: 6, exception: 3, cancelled: 0,
    };

    const orderIds: OrderId[] = [];
    const orderMeta: { id: OrderId; orderNumber: string; createdAt: number; slaDeadline: number; priority: string; totalValue: number; shippingMethod: string; status: string; tier: string; customer: string; city: string; itemCount: number }[] = [];

    for (let i = 0; i < 66; i++) {
      const orderNumber = orderNumbers[i];
      const daysAgo = i <= 14 ? 5 + rng() * 2 : i <= 20 ? 2 + rng() * 2 : rng() * 1.8;
      const createdAt = now - daysAgo * DAY;
      const customer = pick(NAMES);
      const city = pick(CITIES);

      let priority: string;
      let slaHours: number;
      let tier: string;
      let shippingMethod: "express" | "standard";
      let status = statusPlan(i);
      let slaDeadline = createdAt + 24 * HOUR;

      // special orders
      if (orderNumber === "ORD-1048") { priority = "critical"; tier = "gold"; shippingMethod = "express"; slaHours = 6; slaDeadline = now + 2.5 * HOUR; status = "allocated"; }
      else if (orderNumber === "ORD-1052") { priority = "critical"; tier = "gold"; shippingMethod = "express"; slaHours = 6; slaDeadline = now + 2 * HOUR; status = "confirmed"; }
      else if (orderNumber === "ORD-1056") { priority = "normal"; tier = "standard"; shippingMethod = "standard"; slaHours = 24; slaDeadline = now + 20 * HOUR; status = "confirmed"; }
      else if (orderNumber === "ORD-1046") { priority = "high"; tier = "silver"; shippingMethod = "express"; slaHours = 8; slaDeadline = now + 3 * HOUR; status = "picking"; }
      else if (orderNumber === "ORD-1039") { priority = "high"; tier = "gold"; shippingMethod = "express"; slaHours = 8; slaDeadline = now - 2 * HOUR; status = "packing"; }
      else {
        priority = pick(PRIORITIES);
        tier = pick(TIERS);
        shippingMethod = priority === "critical" || priority === "high" ? (rng() < 0.6 ? "express" : "standard") : "standard";
        slaHours = shippingMethod === "express" ? 8 : 24;
        if (status === "delivered" || status === "dispatched") slaDeadline = createdAt + slaHours * HOUR;
        else if (status === "ready" || status === "quality_check" || status === "packing") slaDeadline = now + (2 + rng() * 9) * HOUR;
        else slaDeadline = now + (1 + rng() * 22) * HOUR;
      }

      // 1-4 line items
      const lineCount = 1 + Math.floor(rng() * 4);
      const itemSkus: string[] = [];
      const itemQtys: number[] = [];
      for (let l = 0; l < lineCount; l++) {
        let sku = `WH-${String(1 + Math.floor(rng() * 100)).padStart(3, "0")}`;
        if (orderNumber === "ORD-1052" && l === 0) sku = "WH-204";
        if (orderNumber === "ORD-1056" && l === 0) sku = "WH-204";
        if (orderNumber === "ORD-1048" && l === 0) sku = "WH-205";
        if (orderNumber === "ORD-1046" && l === 0) sku = "WH-313";
        if (orderNumber === "ORD-1039" && l === 0) sku = "WH-404";
        // avoid duplicate skus within an order
        let guard = 0;
        while (itemSkus.includes(sku) && guard++ < 20) sku = `WH-${String(1 + Math.floor(rng() * 100)).padStart(3, "0")}`;
        itemSkus.push(sku);
        let qty = 1 + Math.floor(rng() * 5);
        // flagship scenario quantities
        if (orderNumber === "ORD-1052" && l === 0) qty = 10;
        if (orderNumber === "ORD-1056" && l === 0) qty = 5;
        itemQtys.push(qty);
      }

      const totalValue = itemSkus.reduce((sum, sku, l) => sum + (refs.products[sku]?.price ?? 500) * itemQtys[l], 0);
      const itemCount = itemSkus.length;

      // progress stage + inventory readiness for scoring
      const stage = STAGE_OF_STATUS[status] ?? 0;
      let readiness: "full" | "partial" | "none" = "full";
      if (orderNumber === "ORD-1052") readiness = "partial";
      if (orderNumber === "ORD-1056") readiness = "none";
      else if (status === "created" || status === "confirmed" || status === "allocated" || status === "picking") {
        const oos = itemSkus.filter((s) => (refs.invBySku[s]?.available ?? 5) === 0);
        if (oos.length === itemSkus.length) readiness = "none";
        else if (oos.length > 0) readiness = "partial";
      }

      const priorityScore = calculateOrderPriority(
        { priority: priority as any, slaDeadline, createdAt, totalValue, shippingMethod, inventoryReady: readiness, progressStage: stage, customerTier: tier as any },
        now,
      );
      const risk = calculateFulfillmentRisk(priority as any, slaDeadline, now, readiness, stage);

      // timestamps
      const allocatedAt = status !== "created" && status !== "confirmed" ? createdAt + (0.2 + rng() * 0.4) * DAY : undefined;
      const pickedAt = ["picking", "packing", "quality_check", "ready", "dispatched", "delivered", "exception"].includes(status) ? createdAt + (0.5 + rng() * 0.5) * DAY : undefined;
      const packedAt = ["packing", "quality_check", "ready", "dispatched", "delivered"].includes(status) ? createdAt + (0.7 + rng() * 0.5) * DAY : undefined;
      const qcAt = ["quality_check", "ready", "dispatched", "delivered"].includes(status) ? createdAt + (0.9 + rng() * 0.5) * DAY : undefined;
      const dispatchedAt = ["dispatched", "delivered"].includes(status) ? createdAt + (1.1 + rng() * 0.6) * DAY : undefined;
      const deliveredAt = status === "delivered" ? createdAt + (1.5 + rng() * 1.5) * DAY : undefined;
      const slaMet = status === "delivered" ? (deliveredAt ?? now) <= slaDeadline : undefined;

      const orderId = await ctx.db.insert("orders", {
        orderNumber, customerName: customer, customerEmail: `${customer.toLowerCase().replace(/[^a-z]/g, ".")}@example.com`,
        customerCity: city, customerTier: tier as any,
        priority: priority as any, priorityScore, slaDeadline, slaHours,
        createdAt, status: status as any, risk: risk.risk, riskReason: risk.reason,
        totalValue: Math.round(totalValue), itemCount,
        zone: pick(["A", "B", "C", "D"]),
        shippingMethod, carrier: pick(CARRIERS),
        slaMet,
        allocatedAt, pickedAt, packedAt, qcAt, dispatchedAt, deliveredAt,
      });

      orderIds.push(orderId);
      refs.orders[orderNumber] = { id: orderId, createdAt, slaDeadline, priority, totalValue, shippingMethod, status, tier };
      orderMeta.push({ id: orderId, orderNumber, createdAt, slaDeadline, priority, totalValue, shippingMethod, status, tier, customer, city, itemCount });

      // --- order items + allocations ---
      const itemIds: string[] = [];
      for (let l = 0; l < itemSkus.length; l++) {
        const sku = itemSkus[l];
        const qty = itemQtys[l];
        const prod = refs.products[sku];
        const inv = refs.invBySku[sku];
        const avail = Math.max(0, inv?.available ?? 0);

        // allocation decision (engine)
        const verdicts = allocateInventory([
          {
            orderNumber, sku, productName: prod?.name ?? sku,
            requiredQty: qty, availableQty: avail, reservedQty: inv?.reserved ?? 0,
            priority: priority as any, slaMinutesLeft: Math.round((slaDeadline - now) / 60000),
          },
        ]);
        const vd = verdicts[0];

        // prevent lower-priority order from consuming critical WH-204 stock
        let allocatedQty = vd.allocatedQty;
        let backorderedQty = vd.backorderedQty;
        if (orderNumber === "ORD-1056" && sku === "WH-204") {
          allocatedQty = 0; backorderedQty = qty;
        }

        const itemStatus =
          status === "delivered" || status === "dispatched" || status === "ready" || status === "quality_check" || status === "packing" ? "packed"
          : status === "picking" || status === "allocated" ? (allocatedQty > 0 ? (allocatedQty < qty ? "partial" : "allocated") : "backordered")
          : status === "exception" ? "missing"
          : "pending";

        const itemId = await ctx.db.insert("orderItems", {
          orderId, orderNumber, sku, productName: prod?.name ?? sku,
          quantity: qty, price: prod?.price ?? 500,
          allocatedQty, backorderedQty,
          pickedQty: ["picking", "packing", "quality_check", "ready", "dispatched", "delivered"].includes(status) ? qty : 0,
          packedQty: ["packing", "quality_check", "ready", "dispatched", "delivered"].includes(status) ? qty : 0,
          status: itemStatus as any,
          bin: `${["A", "B", "C", "D"][Math.floor(skuIndexToNum(sku) % 4)]}-01-01`,
          zone: ["A", "B", "C", "D"][Math.floor(skuIndexToNum(sku) % 4)],
        });
        itemIds.push(itemId);

        // allocations record — proposed for confirmed/allocated, approved for in-flight
        if (["confirmed", "allocated", "picking", "packing", "quality_check", "ready"].includes(status)) {
          let reason = vd.reason;
          if (orderNumber === "ORD-1056" && sku === "WH-204") {
            reason = "Stock reserved for critical order ORD-1052. Prevented this order from consuming critical inventory — backorder 5 units.";
          }
          await ctx.db.insert("allocations", {
            orderId, orderNumber, sku, productName: prod?.name ?? sku,
            requiredQty: qty, allocatedQty, availableQty: allocatedQty > 0 ? allocatedQty : avail,
            backorderedQty,
            decision: allocatedQty === 0 ? (orderNumber === "ORD-1056" && sku === "WH-204" ? "backorder" : vd.decision) : vd.decision,
            priority: priority as any,
            status: ["allocated", "picking", "packing", "quality_check", "ready"].includes(status) ? "approved" : "proposed",
            reason,
            createdAt: createdAt + 0.1 * DAY,
            approvedAt: ["allocated", "picking", "packing", "quality_check", "ready"].includes(status) ? createdAt + 0.15 * DAY : undefined,
          });
        }
      }
    }

    function skuIndexToNum(sku: string): number {
      const n = parseInt(sku.replace("WH-", ""), 10);
      return Number.isFinite(n) ? n : 0;
    }

    // ------------------------------------------------------------------
    // Picking tasks
    // ------------------------------------------------------------------
    const pickingOrders = orderMeta.filter((o) => ["picking", "allocated", "packing", "quality_check", "ready"].includes(o.status));
    let pickNo = 100;
    const taskStatuses = ["waiting", "waiting", "assigned", "in_progress", "in_progress", "blocked", "completed", "waiting", "assigned", "in_progress", "completed", "waiting"];
    for (const o of pickingOrders) {
      pickNo += 1;
      const taskNumber = `PICK-${pickNo}`;
      let status = "waiting";
      if (o.orderNumber === "ORD-1046") status = "assigned";
      else if (o.orderNumber === "ORD-1048") status = "waiting";
      else if (o.orderNumber === "ORD-1039") status = "completed";
      else status = taskStatuses[pickNo % taskStatuses.length];

      const zone = ["A", "B", "B", "C"][pickNo % 4];
      const est = 4 + ((pickNo * 3) % 9);
      await ctx.db.insert("pickingTasks", {
        taskNumber, orderId: o.id, orderNumber: o.orderNumber,
        picker: status === "completed" ? pick(PICKERS) : pick(PICKERS),
        zone: o.orderNumber === "ORD-1046" ? "B" : zone,
        itemCount: 1 + (pickNo % 4),
        priority: o.priority as any,
        estimatedMinutes: o.orderNumber === "ORD-1046" ? 6 : est,
        status: status as any,
        createdAt: o.createdAt + 0.5 * DAY,
        startedAt: ["in_progress", "blocked", "completed"].includes(status) ? o.createdAt + 0.6 * DAY : undefined,
        completedAt: status === "completed" ? o.createdAt + 0.9 * DAY : undefined,
        batchGroup: pickNo % 4 === 0 ? "BATCH-ZB-01" : undefined,
        route: o.orderNumber === "ORD-1046" ? "Zone A → Zone B → Zone C" : undefined,
      });
    }

    // ------------------------------------------------------------------
    // Packing tasks + quality checks
    // ------------------------------------------------------------------
    const packingOrders = orderMeta.filter((o) => ["packing", "quality_check", "ready"].includes(o.status));
    let packNo = 200;
    const packStatuses = ["waiting", "packing", "packed", "qc_required", "ready", "packing"];
    for (const o of packingOrders) {
      packNo += 1;
      let status = packStatuses[packNo % packStatuses.length];
      if (o.orderNumber === "ORD-1039") status = "packed";
      const weight = Math.round((0.3 + (packNo % 9) * 0.7) * 10) / 10;
      await ctx.db.insert("packingTasks", {
        taskNumber: `PACK-${packNo}`, orderId: o.id, orderNumber: o.orderNumber,
        station: STATIONS[packNo % STATIONS.length],
        itemCount: 1 + (packNo % 4),
        weightKg: weight,
        packagingType: PACKAGING[packNo % PACKAGING.length],
        status: status as any,
        qcPassed: status === "ready" ? true : status === "packed" ? undefined : undefined,
        createdAt: o.createdAt + 0.8 * DAY,
        startedAt: ["packing", "packed", "qc_required", "ready"].includes(status) ? o.createdAt + 0.9 * DAY : undefined,
        completedAt: ["ready"].includes(status) ? o.createdAt + 1.1 * DAY : undefined,
      });

      if (["quality_check", "ready", "packing"].includes(o.status)) {
        const failed = o.orderNumber === "ORD-1031";
        await ctx.db.insert("qualityChecks", {
          orderId: o.id, orderNumber: o.orderNumber,
          itemQuantityVerified: !failed, skuVerified: !failed, damageCheck: !failed, packagingVerified: !failed, addressVerified: !failed,
          status: failed ? "failed" : o.status === "packing" ? "pending" : "passed",
          checkedAt: failed || o.status !== "packing" ? o.createdAt + 1.0 * DAY : undefined,
          failedReason: failed ? "Item quantity mismatch — 2 units missing from carton" : undefined,
        });
      }
    }

    // ------------------------------------------------------------------
    // Shipments
    // ------------------------------------------------------------------
    const shipmentOrders = orderMeta.filter((o) => ["ready", "dispatched", "delivered"].includes(o.status));
    let shipNo = 300;
    for (const o of shipmentOrders) {
      shipNo += 1;
      const delayed = o.orderNumber === "ORD-1043";
      await ctx.db.insert("shipments", {
        shipmentNumber: `SHP-${shipNo}`,
        orderId: o.id, orderNumber: o.orderNumber,
        carrier: o.orderNumber === "ORD-1043" ? "BlueDart" : (o as any).carrier ?? pick(CARRIERS),
        trackingNumber: `BLU${String(100000 + shipNo * 13)}${String(shipNo)}IN`,
        destination: `${o.city}, India`,
        status: o.status === "delivered" ? "delivered" : o.status === "ready" ? "ready" : delayed ? "delayed" : "dispatched",
        scheduledAt: o.createdAt + (1.1 + (shipNo % 4) * 0.3) * DAY,
        dispatchedAt: o.status === "dispatched" || o.status === "delivered" ? o.createdAt + (1.1 + (shipNo % 3) * 0.2) * DAY : undefined,
        delayMinutes: delayed ? 45 : undefined,
        risk: delayed ? "high" : o.status === "ready" ? "low" : "low",
      });
    }

    // ------------------------------------------------------------------
    // Exceptions (incl. flagship EXC-1008)
    // ------------------------------------------------------------------
    const excDefs: { no: number; type: any; severity: any; order: string; sku?: string; desc: string; suggested: string; status: any; decision?: string; resolution?: string; note?: string }[] = [
      { no: 1001, type: "damaged", severity: "high", order: "", sku: "WH-1113", desc: "3 units of WH-1113 (Pet Bed Medium) reported damaged during receiving.", suggested: "Quarantine damaged units, raise vendor claim, adjust inventory.", status: "open" },
      { no: 1002, type: "missing", severity: "high", order: "ORD-1022", desc: "1 item missing from carton during picking verification.", suggested: "Re-pick missing line item and expedite to packing.", status: "investigating", decision: "Re-pick 1 unit of WH-503 from bin B-03-04.", resolution: "Item re-picked and verified by supervisor." },
      { no: 1003, type: "mismatch", severity: "medium", order: "", sku: "WH-706", desc: "Cycle count shows 6 more units than system record for WH-706.", suggested: "Adjust stock after supervisor verification.", status: "open" },
      { no: 1004, type: "picking_delay", severity: "high", order: "", sku: "", desc: "Picking queue in Zone B exceeds 15 minutes average wait.", suggested: "Reassign 2 pickers from Zone A to Zone B.", status: "action_required", decision: "Rebalance 2 picking tasks from Zone B to Zone A.", resolution: "2 tasks reassigned; queue normalised to 8 minutes." },
      { no: 1005, type: "packing_error", severity: "medium", order: "ORD-1027", desc: "Wrong packaging size used; carton replaced at station P2.", suggested: "Retrain operator on packaging size matrix.", status: "resolved", decision: "Replace carton and re-verify weight.", resolution: "Carton replaced, weight verified, order packed." },
      { no: 1006, type: "qc_failure", severity: "high", order: "ORD-1031", desc: "QC failed — item quantity mismatch (2 units missing from carton).", suggested: "Re-pick 2 units, re-run QC before dispatch.", status: "action_required" },
      { no: 1007, type: "dispatch_delay", severity: "high", order: "ORD-1043", desc: "BlueDart pickup delayed by 45 minutes for Zone B dispatch.", suggested: "Escalate to carrier; re-route to next pickup slot.", status: "escalated", decision: "Escalate to BlueDart regional hub.", resolution: "Carrier confirmed pickup; shipment moving." },
      { no: 1008, type: "stockout", severity: "critical", order: "ORD-1052", sku: "WH-204", desc: "Only 7 units of WH-204 available but urgent order ORD-1052 requires 10 units.", suggested: "Allocate 7 units to the urgent order, backorder 3 units, trigger replenishment.", status: "action_required", decision: "Allocate 7 units to urgent order ORD-1052.", resolution: "Backorder remaining 3 units and trigger replenishment recommendation for WH-204." },
      { no: 1009, type: "sla_risk", severity: "high", order: "ORD-1046", desc: "Order ORD-1046 is approaching its SLA deadline (3h remaining).", suggested: "Prioritize picking task and assign best picker.", status: "open", decision: "Assign picker Ravi K. and prioritize task.", resolution: "Task assigned — in progress." },
      { no: 1010, type: "stockout", severity: "medium", order: "", sku: "WH-813", desc: "Demand forecast indicates WH-813 (Running Shoes) may stock out within 48 hours.", suggested: "Place replenishment order for 75 units.", status: "open" },
      { no: 1011, type: "damaged", severity: "low", order: "", sku: "WH-302", desc: "1 damaged unit found during packing at station P3.", suggested: "Quarantine unit and file return with supplier.", status: "resolved", decision: "Quarantine unit.", resolution: "Unit quarantined; supplier claim filed." },
      { no: 1012, type: "sla_risk", severity: "critical", order: "ORD-1052", desc: "Critical order ORD-1052 cannot be fully fulfilled — SLA expires in 2h.", suggested: "Approve partial allocation of 7 units and backorder 3.", status: "action_required", decision: "Approve partial allocation.", resolution: "Allocation approved, 3 units backordered." },
    ];
    for (const d of excDefs) {
      const orderRef = d.order ? refs.orders[d.order] : undefined;
      const detectedAt = d.order && orderRef ? Math.max(orderRef.createdAt + 0.6 * DAY, now - 6 * HOUR) : now - (d.no % 3) * 5 * HOUR;
      await ctx.db.insert("exceptions", {
        exceptionNumber: `EXC-${d.no}`,
        type: d.type, severity: d.severity,
        orderId: orderRef?.id, orderNumber: d.order || undefined,
        sku: d.sku,
        description: d.desc,
        detectedAt,
        assignedUser: d.status === "investigating" ? "Ravi K." : d.status === "action_required" ? "Anita D." : undefined,
        suggestedResolution: d.suggested,
        status: d.status,
        decision: d.decision, resolution: d.resolution,
        resolvedAt: d.status === "resolved" ? now - 8 * HOUR : undefined,
        resolutionNote: d.resolution,
      });
    }

    // ------------------------------------------------------------------
    // Recommendations
    // ------------------------------------------------------------------
    const recDefs: { cat: any; title: string; problem: string; reasoning: string; action: string; impact: string; sev: any; status: any; order?: string; sku?: string }[] = [
      { cat: "order_priority", title: "Prioritize Order ORD-1048", problem: "ORD-1048 (Critical) has an SLA deadline in under 3 hours.", reasoning: "High customer priority (Gold tier) + SLA expires in ~2h 30m + all inventory is available + express shipping. Score 94/100.", action: "Move ORD-1048 to the front of the picking queue.", impact: "Protects SLA, avoids penalty and customer escalation.", sev: "critical", status: "pending", order: "ORD-1048" },
      { cat: "inventory", title: "Allocate 7 of 10 units to ORD-1052", problem: "Only 7 units of WH-204 are available while critical order ORD-1052 requires 10.", reasoning: "ORD-1052 is Critical with a 2h SLA. Allocating all 7 keeps the order moving; the remaining 3 units are backordered.", action: "Approve partial allocation — 7 units to ORD-1052, 3 units backordered.", impact: "SLA preserved for the urgent order; only 3 units delayed.", sev: "critical", status: "pending", order: "ORD-1052", sku: "WH-204" },
      { cat: "replenishment", title: "Reorder 50 units of WH-204", problem: "WH-204 (Wireless Keyboard) has 7 available units; projected demand (140/30d) exceeds stock within 3 days.", reasoning: "Available (7) is below reorder point (15). Forecast demand of 140 units/30d implies stockout in ~2 days at current consumption.", action: "Create a replenishment order for 50 units.", impact: "Reduces projected stockout risk by ~82%.", sev: "high", status: "pending", sku: "WH-204" },
      { cat: "picking", title: "Batch 4 picking tasks in Zone B", problem: "4 waiting orders require products from Zone B.", reasoning: "Grouping Zone B picks into one batch reduces picker travel between zones.", action: "Create Picking Batch ZB-01 covering the 4 orders.", impact: "Estimated travel reduction of 28%.", sev: "medium", status: "pending" },
      { cat: "exception", title: "Resolve EXC-1008 via backorder decision", problem: "EXC-1008: WH-204 stockout — 7 available vs 10 required by ORD-1052.", reasoning: "Standard exception-to-decision flow: allocate 7, backorder 3, trigger replenishment.", action: "Approve resolution and close the exception.", impact: "Full audit trail; order and inventory stay in sync.", sev: "critical", status: "pending", order: "ORD-1052", sku: "WH-204" },
      { cat: "dispatch", title: "Resolve BlueDart delay for SHP-343", problem: "BlueDart pickup for Zone B delayed by 45 minutes.", reasoning: "Dispatch delay exceeds acceptable threshold and risks missing delivery windows.", action: "Escalate to carrier and re-route shipment to next pickup slot.", impact: "Prevents cascading delivery delays.", sev: "high", status: "pending", order: "ORD-1043" },
      { cat: "bottleneck", title: "Zone B picking is 23% slower than average", problem: "Average picking duration in Zone B is 23% above the warehouse average.", reasoning: "Zone B has a queue of 6 tasks and 2 open exceptions, compounding the slowdown.", action: "Rebalance 2 picking tasks from Zone B to Zone A.", impact: "Normalizes queue latency and reduces avg delay by ~18 minutes.", sev: "high", status: "pending" },
      { cat: "inventory", title: "Backorder ORD-1056 (WH-204)", problem: "ORD-1056 (Normal) requires 5 units of WH-204, which is reserved for critical orders.", reasoning: "Stock must be protected for critical ORD-1052. ORD-1056 will be backordered rather than consuming critical inventory.", action: "Approve backorder of 5 units for ORD-1056.", impact: "Critical order protected; ORD-1056 ships when stock arrives.", sev: "medium", status: "pending", order: "ORD-1056", sku: "WH-204" },
      { cat: "order_priority", title: "Watch SLA risk on ORD-1046", problem: "ORD-1046 (High) has 3h remaining on its SLA with picking in progress.", reasoning: "Progress is on track but any delay in Zone B picking would breach the SLA.", action: "Assign the top picker and monitor until packing.", impact: "Maintains 100% SLA compliance for express orders.", sev: "high", status: "approved", order: "ORD-1046" },
      { cat: "replenishment", title: "Reorder 75 units of WH-813", problem: "WH-813 (Running Shoes) may stock out within 48 hours.", reasoning: "Forecast demand (260/30d) with 0 available units points to an imminent stockout.", action: "Reorder 75 units.", impact: "Reduces projected stockout risk by 82%.", sev: "high", status: "applied", sku: "WH-813" },
    ];
    for (const r of recDefs) {
      const orderRef = r.order ? refs.orders[r.order] : undefined;
      await ctx.db.insert("recommendations", {
        category: r.cat, title: r.title, problem: r.problem, reasoning: r.reasoning,
        recommendedAction: r.action, impact: r.impact, severity: r.sev, status: r.status,
        orderId: orderRef?.id, orderNumber: r.order, sku: r.sku,
        createdAt: now - (1 + Math.floor(rng() * 20)) * HOUR,
        resolvedAt: r.status === "applied" || r.status === "approved" ? now - 3 * HOUR : undefined,
      });
    }

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------
    const notifDefs: { title: string; msg: string; type: any; sev: any; read: boolean; order?: string; sku?: string; link?: string; agoH: number }[] = [
      { title: "Critical stock alert", msg: "WH-204 (Wireless Keyboard) — only 7 units available, urgent order requires 10.", type: "stock", sev: "critical", read: false, sku: "WH-204", link: "/inventory/WH-204", agoH: 0.3 },
      { title: "New urgent order", msg: "ORD-1052 (Critical, Gold) requires 10 × WH-204 with a 2h SLA.", type: "urgent", sev: "critical", read: false, order: "ORD-1052", link: "/orders/ORD-1052", agoH: 0.4 },
      { title: "SLA risk detected", msg: "ORD-1046 has 3h remaining on its express SLA.", type: "sla", sev: "high", read: false, order: "ORD-1046", link: "/orders/ORD-1046", agoH: 0.7 },
      { title: "QC failure", msg: "ORD-1031 failed quality check — 2 units missing from carton.", type: "qc", sev: "high", read: false, order: "ORD-1031", link: "/orders/ORD-1031", agoH: 1.2 },
      { title: "Dispatch delayed", msg: "BlueDart pickup delayed by 45 min for Zone B (SHP-343).", type: "dispatch", sev: "high", read: false, order: "ORD-1043", link: "/dispatch", agoH: 1.5 },
      { title: "Damaged inventory", msg: "3 units of WH-1113 reported damaged during receiving.", type: "damaged", sev: "high", read: false, sku: "WH-1113", link: "/exceptions", agoH: 2.1 },
      { title: "AI recommendation", msg: "Allocate 7 of 10 units of WH-204 to ORD-1052.", type: "ai", sev: "high", read: false, link: "/recommendations", agoH: 0.5 },
      { title: "Replenishment needed", msg: "Reorder 50 units of WH-204 before projected stockout.", type: "stock", sev: "high", read: false, sku: "WH-204", link: "/inventory/WH-204", agoH: 0.9 },
      { title: "Batch picking opportunity", msg: "4 orders in Zone B can be batched (28% travel saving).", type: "picking", sev: "medium", read: true, link: "/picking", agoH: 3 },
      { title: "Picking task assigned", msg: "Ravi K. assigned to PICK-114 for ORD-1046.", type: "picking", sev: "medium", read: true, order: "ORD-1046", link: "/picking", agoH: 4 },
      { title: "Exception assigned", msg: "EXC-1004 (picking delay) assigned to Anita D.", type: "exception", sev: "medium", read: true, link: "/exceptions", agoH: 5 },
      { title: "Shipment dispatched", msg: "SHP-311 dispatched via Delhivery.", type: "system", sev: "info", read: true, link: "/dispatch", agoH: 6 },
      { title: "Stock received", msg: "80 units of WH-703 received into Zone A.", type: "system", sev: "info", read: true, sku: "WH-703", link: "/inventory/WH-703", agoH: 8 },
      { title: "Audit: allocation approved", msg: "Allocation for ORD-1040 approved by supervisor.", type: "system", sev: "info", read: true, order: "ORD-1040", link: "/orders/ORD-1040", agoH: 9 },
    ];
    for (const n of notifDefs) {
      const orderRef = n.order ? refs.orders[n.order] : undefined;
      await ctx.db.insert("notifications", {
        title: n.title, message: n.msg, type: n.type, severity: n.sev, read: n.read,
        orderId: orderRef?.id, orderNumber: n.order, sku: n.sku, link: n.link,
        createdAt: now - n.agoH * HOUR,
      });
    }

    // ------------------------------------------------------------------
    // Movements
    // ------------------------------------------------------------------
    skuList.forEach(async (sku, i) => {
      const prod = refs.products[sku];
      const inv = refs.invBySku[sku];
      const count = 2 + ((i + 1) % 3);
      for (let m = 0; m < count; m++) {
        const type = m === 0 ? "received" : m === 1 ? "allocated" : "picked";
        const qty = type === "received" ? Math.round((inv?.available ?? 20) * 0.8) : 1 + (((i + 1) * 3 + m) % 8);
        await ctx.db.insert("movements", {
          sku, productName: prod?.name ?? sku,
          type: type as any, quantity: qty,
          reference: type === "received" ? `PO-${String(5000 + i)}` : type === "allocated" ? `ORD-${1000 + (i % 60)}` : `PICK-${100 + i}`,
          note: type === "received" ? "Supplier delivery" : type === "allocated" ? "Order allocation" : "Picked to packing",
          timestamp: now - (i + m * 3) * HOUR * 1.2,
          by: type === "picked" ? pick(PICKERS) : "System",
        });
      }
      if (sku === "WH-204") {
        await ctx.db.insert("movements", { sku, productName: prod?.name ?? sku, type: "backordered", quantity: 3, reference: "ORD-1052", note: "Backordered after partial allocation", timestamp: now - 1.1 * HOUR, by: "System" });
        await ctx.db.insert("movements", { sku, productName: prod?.name ?? sku, type: "allocated", quantity: 7, reference: "ORD-1052", note: "Partial allocation to critical order", timestamp: now - 1.2 * HOUR, by: "System" });
      }
    });

    // ------------------------------------------------------------------
    // Audit log (drives the live operations feed)
    // ------------------------------------------------------------------
    const auditDefs: { action: string; entity: string; prev?: string; next?: string; agoH: number; user?: string }[] = [
      { action: "Order allocated", entity: "ORD-1048", prev: "Confirmed", next: "Allocated", agoH: 0.2, user: "System" },
      { action: "Allocation proposed", entity: "ORD-1052", prev: "—", next: "Partial (7/10 units)", agoH: 0.4, user: "Decision Engine" },
      { action: "Stock conflict detected", entity: "WH-204", prev: "10 required", next: "7 available", agoH: 0.5, user: "Decision Engine" },
      { action: "Exception created", entity: "EXC-1008", prev: "—", next: "Critical · Stockout", agoH: 0.5, user: "Decision Engine" },
      { action: "AI recommendation raised", entity: "Allocate 7 units WH-204", prev: "—", next: "Pending approval", agoH: 0.5, user: "Decision Engine" },
      { action: "Picker assigned", entity: "ORD-1046", prev: "Waiting", next: "Assigned → Ravi K.", agoH: 0.7, user: "Anita D." },
      { action: "Picking task started", entity: "PICK-113", prev: "Assigned", next: "In progress", agoH: 0.9, user: "Ravi K." },
      { action: "Order packed", entity: "ORD-1039", prev: "Packing", next: "Packed", agoH: 1.1, user: "Station P2" },
      { action: "Dispatch delayed", entity: "Zone B", prev: "Scheduled pickup", next: "Delayed 45m (BlueDart)", agoH: 1.4, user: "System" },
      { action: "Inventory discrepancy detected", entity: "WH-706", prev: "System: 18", next: "Cycle count: 24", agoH: 1.8, user: "Kiran P." },
      { action: "QC passed", entity: "ORD-1037", prev: "QC required", next: "Passed", agoH: 2.2, user: "Deepa M." },
      { action: "Damaged item reported", entity: "WH-1113", prev: "3 healthy", next: "3 damaged", agoH: 2.4, user: "Manoj S." },
      { action: "Shipment dispatched", entity: "SHP-311", prev: "Ready", next: "Dispatched (Delhivery)", agoH: 3, user: "System" },
      { action: "Reorder recommended", entity: "WH-204", prev: "7 available", next: "Reorder 50 units", agoH: 3.2, user: "Decision Engine" },
      { action: "Order priority changed", entity: "ORD-1048", prev: "High", next: "Critical", agoH: 3.6, user: "Anita D." },
      { action: "Picking batch created", entity: "BATCH-ZB-01", prev: "4 tasks", next: "1 batch · Zone B", agoH: 4, user: "System" },
      { action: "QC failed", entity: "ORD-1031", prev: "QC required", next: "Failed · 2 missing", agoH: 4.5, user: "Deepa M." },
      { action: "Exception escalated", entity: "EXC-1007", prev: "Action required", next: "Escalated", agoH: 5, user: "Suresh (Supervisor)" },
      { action: "Backorder created", entity: "ORD-1056", prev: "5 required", next: "5 backordered", agoH: 5.5, user: "Decision Engine" },
      { action: "Stock received", entity: "WH-703", prev: "12 available", next: "92 available", agoH: 6, user: "Kiran P." },
      { action: "Allocation approved", entity: "ORD-1040", prev: "Proposed", next: "Approved", agoH: 7, user: "Suresh (Supervisor)" },
      { action: "Picking task completed", entity: "PICK-108", prev: "In progress", next: "Completed", agoH: 8, user: "Sameer J." },
      { action: "Cycle count adjusted", entity: "WH-706", prev: "18 units", next: "24 units", agoH: 9, user: "Kiran P." },
      { action: "Order delivered", entity: "ORD-1019", prev: "Dispatched", next: "Delivered", agoH: 10, user: "Carrier" },
      { action: "Exception resolved", entity: "EXC-1005", prev: "Open", next: "Resolved", agoH: 12, user: "Anita D." },
      { action: "Stock adjusted (damaged)", entity: "WH-302", prev: "1 healthy", next: "1 damaged", agoH: 14, user: "Manoj S." },
      { action: "SLA breach prevented", entity: "ORD-1035", prev: "At risk", next: "Dispatched on time", agoH: 16, user: "System" },
      { action: "Order cancelled", entity: "ORD-1066", prev: "Created", next: "Cancelled", agoH: 20, user: "Customer service" },
      { action: "Replenishment ordered", entity: "WH-813", prev: "0 available", next: "75 units ordered", agoH: 26, user: "System" },
    ];
    for (const a of auditDefs) {
      await ctx.db.insert("auditLogs", {
        user: a.user ?? "System",
        userName: undefined,
        action: a.action,
        entityType: "warehouse",
        entityId: a.entity,
        prevState: a.prev,
        newState: a.next,
        timestamp: now - a.agoH * HOUR,
      });
    }

    // ------------------------------------------------------------------
    // Settings + demo docs
    // ------------------------------------------------------------------
    await ctx.db.insert("settings", {
      warehouseName: "Pragati Fulfilment Hub — Zone A",
      defaultSlaHours: 24,
      lowStockThresholdPct: 20,
      reorderMultiplier: 1.2,
      slaUrgencyWindowMinutes: 180,
      notificationPrefs: { criticalStock: true, slaRisk: true, urgentOrders: true, pickingDelay: true, qcFailure: true, damaged: true, dispatchDelay: true, aiRecommendations: true },
      priorityRules: { slaWeight: 40, customerWeight: 18, ageWeight: 10, valueWeight: 10, readinessWeight: 12, shippingWeight: 6 },
    });
    await ctx.db.insert("demo", { demoMode: false, activeScenario: undefined, lastRunAt: undefined });

    return { seeded: true, products: 100, orders: orderMeta.length };
  },
});
