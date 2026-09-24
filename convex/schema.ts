import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cards: defineTable({
    id: v.string(),
    title: v.string(),
    body: v.string(),
    kind: v.union(
      v.literal("question"),
      v.literal("knowledge"),
      v.literal("meaning")
    ),
    confidence: v.union(
      v.literal("first-hand"),
      v.literal("shared-with-me"),
      v.literal("hypothesis")
    ),
    topicId: v.string(),
    x: v.number(),
    y: v.number(),
    vx: v.optional(v.number()),
    vy: v.optional(v.number()),
    source: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("rejected")
    ),
    updatedAt: v.number(),
  }).index("idx_id", ["id"]),

  connections: defineTable({
    id: v.string(),
    from: v.string(),
    to: v.string(),
  }).index("idx_id", ["id"]),

  topics: defineTable({
    id: v.string(),
    name: v.string(),
    color: v.string(),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  }).index("idx_id", ["id"]),
});
