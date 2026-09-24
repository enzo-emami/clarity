import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getBoardData = query({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("cards").collect();
    const connections = await ctx.db.query("connections").collect();
    const topics = await ctx.db.query("topics").collect();
    return { cards, connections, topics };
  },
});

export const updateCard = mutation({
  args: { id: v.string(), updates: v.any() },
  handler: async (ctx, args) => {
    const card = await ctx.db.query("cards").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (!card) {
        return;
    }
    await ctx.db.patch(card._id, args.updates);
  },
});

export const upsertCard = mutation({
  args: { id: v.string(), card: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("cards").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (existing) {
      await ctx.db.patch(existing._id, args.card);
    } else {
      await ctx.db.insert("cards", { ...args.card });
    }
  },
});

export const addConnection = mutation({
  args: { connection: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("connections", args.connection);
  },
});

export const removeConnection = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const conn = await ctx.db.query("connections").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (conn) await ctx.db.delete(conn._id);
  },
});

export const seedBoard = mutation({
  args: { data: v.any() },
  handler: async (ctx, args) => {
    // Clear existing
    const cards = await ctx.db.query("cards").collect();
    for (const c of cards) await ctx.db.delete(c._id);

    const conns = await ctx.db.query("connections").collect();
    for (const cn of conns) await ctx.db.delete(cn._id);

    const tops = await ctx.db.query("topics").collect();
    for (const t of tops) await ctx.db.delete(t._id);

    // Seed topics
    for (const t of args.data.topics) {
      await ctx.db.insert("topics", t);
    }
    // Seed cards
    for (const c of args.data.cards) {
      await ctx.db.insert("cards", c);
    }
    // Seed connections
    for (const cn of args.data.connections) {
      await ctx.db.insert("connections", cn);
    }
  },
});
