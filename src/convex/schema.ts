import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

export const warehouseRoleValidator = v.union(
  v.literal("manager"),
  v.literal("operator"),
  v.literal("supervisor"),
  v.literal("admin"),
);
export type WarehouseRole = Infer<typeof warehouseRoleValidator>;

export const priorityValidator = v.union(
  v.literal("critical"),
  v.literal("high"),
  v.literal("normal"),
  v.literal("low"),
);

export const orderStatusValidator = v.union(
  v.literal("created"),
  v.literal("confirmed"),
  v.literal("allocated"),
  v.literal("picking"),
  v.literal("packing"),
  v.literal("quality_check"),
  v.literal("ready"),
  v.literal("dispatched"),
  v.literal("delivered"),
  v.literal("exception"),
  v.literal("cancelled"),
);

export const riskValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

export const inventoryStatusValidator = v.union(
  v.literal("healthy"),
  v.literal("low_stock"),
  v.literal("critical"),
  v.literal("out_of_stock"),
  v.literal("overstock"),
  v.literal("damaged"),
);

export const exceptionTypeValidator = v.union(
  v.literal("damaged"),
  v.literal("missing"),
  v.literal("mismatch"),
  v.literal("picking_delay"),
  v.literal("packing_error"),
  v.literal("qc_failure"),
  v.literal("dispatch_delay"),
  v.literal("stockout"),
  v.literal("sla_risk"),
);

export const exceptionStatusValidator = v.union(
  v.literal("open"),
  v.literal("investigating"),
  v.literal("action_required"),
  v.literal("resolved"),
  v.literal("escalated"),
);

export const recommendationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("ignored"),
  v.literal("applied"),
);

export const taskStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("assigned"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("blocked"),
);

export const allocationDecisionValidator = v.union(
  v.literal("full"),
  v.literal("partial"),
  v.literal("backorder"),
  v.literal("reallocate"),
);
export type AllocationDecision = Infer<typeof allocationDecisionValidator>;

export const allocationStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("modified"),
);

export const itemStatusValidator = v.union(
  v.literal("pending"),
  v.literal("allocated"),
  v.literal("partial"),
  v.literal("backordered"),
  v.literal("picked"),
  v.literal("packed"),
  v.literal("damaged"),
  v.literal("missing"),
  v.literal("qc_failed"),
  v.literal("cancelled"),
);

export const movementTypeValidator = v.union(
  v.literal("received"),
  v.literal("allocated"),
  v.literal("picked"),
  v.literal("backordered"),
  v.literal("damaged"),
  v.literal("adjusted"),
  v.literal("returned"),
  v.literal("restocked"),
  v.literal("ordered"),
);

export const notificationTypeValidator = v.union(
  v.literal("stock"),
  v.literal("sla"),
  v.literal("urgent"),
  v.literal("picking"),
  v.literal("qc"),
  v.literal("damaged"),
  v.literal("dispatch"),
  v.literal("ai"),
  v.literal("exception"),
  v.literal("system"),
);

export const shipmentStatusValidator = v.union(
  v.literal("ready"),
  v.literal("processing"),
  v.literal("dispatched"),
  v.literal("delayed"),
  v.literal("delivered"),
);

export const recommendationCategoryValidator = v.union(
  v.literal("order_priority"),
  v.literal("inventory"),
  v.literal("picking"),
  v.literal("replenishment"),
  v.literal("exception"),
  v.literal("dispatch"),
  v.literal("bottleneck"),
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = defineSchema(
  {
    // default auth tables using convex auth. do not remove
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(warehouseRoleValidator),
      displayName: v.optional(v.string()),
    }).index("email", ["email"]),

    products: defineTable({
      sku: v.string(),
      name: v.string(),
      category: v.string(),
      price: v.number(),
      weightGrams: v.number(),
      color: v.optional(v.string()),
      supplier: v.optional(v.string()),
    }).index("by_sku", ["sku"]),

    inventory: defineTable({
      sku: v.string(),
      productName: v.string(),
      category: v.string(),
      zone: v.string(),
      bin: v.string(),
      available: v.number(),
      reserved: v.number(),
      damaged: v.number(),
      reorderPoint: v.number(),
      reorderQty: v.number(),
      status: inventoryStatusValidator,
      forecastDemand: v.number(),
      demand30d: v.number(),
      price: v.number(),
      lastUpdated: v.number(),
    })
      .index("by_sku", ["sku"])
      .index("by_status", ["status"])
      .index("by_zone", ["zone"]),

    orders: defineTable({
      orderNumber: v.string(),
      customerName: v.string(),
      customerEmail: v.optional(v.string()),
      customerCity: v.string(),
      customerTier: v.union(v.literal("gold"), v.literal("silver"), v.literal("standard")),
      priority: priorityValidator,
      priorityScore: v.number(),
      slaDeadline: v.number(),
      slaHours: v.number(),
      createdAt: v.number(),
      status: orderStatusValidator,
      risk: riskValidator,
      riskReason: v.optional(v.string()),
      totalValue: v.number(),
      itemCount: v.number(),
      zone: v.optional(v.string()),
      shippingMethod: v.union(v.literal("express"), v.literal("standard")),
      carrier: v.optional(v.string()),
      slaMet: v.optional(v.boolean()),
      allocatedAt: v.optional(v.number()),
      pickedAt: v.optional(v.number()),
      packedAt: v.optional(v.number()),
      qcAt: v.optional(v.number()),
      dispatchedAt: v.optional(v.number()),
      deliveredAt: v.optional(v.number()),
    })
      .index("by_number", ["orderNumber"])
      .index("by_status", ["status"])
      .index("by_priority", ["priority"])
      .index("by_risk", ["risk"])
      .index("by_created", ["createdAt"]),

    orderItems: defineTable({
      orderId: v.id("orders"),
      orderNumber: v.string(),
      sku: v.string(),
      productName: v.string(),
      quantity: v.number(),
      price: v.number(),
      allocatedQty: v.number(),
      backorderedQty: v.number(),
      pickedQty: v.number(),
      packedQty: v.number(),
      status: itemStatusValidator,
      bin: v.optional(v.string()),
      zone: v.optional(v.string()),
    })
      .index("by_order", ["orderId"])
      .index("by_sku", ["sku"])
      .index("by_orderNumber", ["orderNumber"]),

    allocations: defineTable({
      orderId: v.id("orders"),
      orderNumber: v.string(),
      sku: v.string(),
      productName: v.string(),
      requiredQty: v.number(),
      allocatedQty: v.number(),
      availableQty: v.number(),
      backorderedQty: v.number(),
      decision: allocationDecisionValidator,
      priority: priorityValidator,
      status: allocationStatusValidator,
      reason: v.string(),
      createdAt: v.number(),
      approvedAt: v.optional(v.number()),
    })
      .index("by_order", ["orderId"])
      .index("by_status", ["status"])
      .index("by_sku", ["sku"]),

    pickingTasks: defineTable({
      taskNumber: v.string(),
      orderId: v.id("orders"),
      orderNumber: v.string(),
      picker: v.string(),
      zone: v.string(),
      itemCount: v.number(),
      priority: priorityValidator,
      estimatedMinutes: v.number(),
      status: taskStatusValidator,
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      batchGroup: v.optional(v.string()),
      route: v.optional(v.string()),
    })
      .index("by_status", ["status"])
      .index("by_order", ["orderId"])
      .index("by_zone", ["zone"]),

    packingTasks: defineTable({
      taskNumber: v.string(),
      orderId: v.id("orders"),
      orderNumber: v.string(),
      station: v.string(),
      itemCount: v.number(),
      weightKg: v.number(),
      packagingType: v.string(),
      status: v.union(
        v.literal("waiting"),
        v.literal("packing"),
        v.literal("packed"),
        v.literal("qc_required"),
        v.literal("failed_qc"),
        v.literal("ready"),
      ),
      qcPassed: v.optional(v.boolean()),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_order", ["orderId"]),

    qualityChecks: defineTable({
      orderId: v.id("orders"),
      orderNumber: v.string(),
      itemQuantityVerified: v.boolean(),
      skuVerified: v.boolean(),
      damageCheck: v.boolean(),
      packagingVerified: v.boolean(),
      addressVerified: v.boolean(),
      status: v.union(v.literal("passed"), v.literal("failed"), v.literal("pending")),
      checkedAt: v.optional(v.number()),
      failedReason: v.optional(v.string()),
    }).index("by_order", ["orderId"]),

    exceptions: defineTable({
      exceptionNumber: v.string(),
      type: exceptionTypeValidator,
      severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
      orderId: v.optional(v.id("orders")),
      orderNumber: v.optional(v.string()),
      sku: v.optional(v.string()),
      description: v.string(),
      detectedAt: v.number(),
      assignedUser: v.optional(v.string()),
      suggestedResolution: v.string(),
      status: exceptionStatusValidator,
      decision: v.optional(v.string()),
      resolution: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      resolutionNote: v.optional(v.string()),
    })
      .index("by_status", ["status"])
      .index("by_type", ["type"])
      .index("by_severity", ["severity"])
      .index("by_order", ["orderId"]),

    shipments: defineTable({
      shipmentNumber: v.string(),
      orderId: v.id("orders"),
      orderNumber: v.string(),
      carrier: v.string(),
      trackingNumber: v.string(),
      destination: v.string(),
      status: shipmentStatusValidator,
      scheduledAt: v.number(),
      dispatchedAt: v.optional(v.number()),
      delayMinutes: v.optional(v.number()),
      risk: riskValidator,
    })
      .index("by_status", ["status"])
      .index("by_order", ["orderId"]),

    notifications: defineTable({
      title: v.string(),
      message: v.string(),
      type: notificationTypeValidator,
      severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low"), v.literal("info")),
      orderId: v.optional(v.id("orders")),
      orderNumber: v.optional(v.string()),
      sku: v.optional(v.string()),
      read: v.boolean(),
      createdAt: v.number(),
      link: v.optional(v.string()),
    })
      .index("by_read", ["read"])
      .index("by_created", ["createdAt"]),

    recommendations: defineTable({
      category: recommendationCategoryValidator,
      title: v.string(),
      problem: v.string(),
      reasoning: v.string(),
      recommendedAction: v.string(),
      impact: v.string(),
      severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low"), v.literal("info")),
      status: recommendationStatusValidator,
      orderId: v.optional(v.id("orders")),
      orderNumber: v.optional(v.string()),
      sku: v.optional(v.string()),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_category", ["category"])
      .index("by_created", ["createdAt"]),

    movements: defineTable({
      sku: v.string(),
      productName: v.string(),
      type: movementTypeValidator,
      quantity: v.number(),
      reference: v.string(),
      note: v.optional(v.string()),
      timestamp: v.number(),
      by: v.optional(v.string()),
    })
      .index("by_sku", ["sku"])
      .index("by_timestamp", ["timestamp"]),

    auditLogs: defineTable({
      user: v.string(),
      userName: v.optional(v.string()),
      action: v.string(),
      entityType: v.string(),
      entityId: v.optional(v.string()),
      prevState: v.optional(v.string()),
      newState: v.optional(v.string()),
      timestamp: v.number(),
    }).index("by_timestamp", ["timestamp"]),

    // single-doc settings
    settings: defineTable({
      warehouseName: v.string(),
      defaultSlaHours: v.number(),
      lowStockThresholdPct: v.number(),
      reorderMultiplier: v.number(),
      slaUrgencyWindowMinutes: v.number(),
      notificationPrefs: v.optional(v.any()),
      priorityRules: v.optional(v.any()),
    }),

    // single-doc demo mode state (id = "demo")
    demo: defineTable({
      demoMode: v.boolean(),
      activeScenario: v.optional(v.string()),
      lastRunAt: v.optional(v.number()),
    }),

    // per-user demo role override
    demoRoles: defineTable({
      userId: v.string(),
      role: warehouseRoleValidator,
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
