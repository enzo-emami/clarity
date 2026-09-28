import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getBoardData = query({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("cards").collect();
    const connections = await ctx.db.query("connections").collect();
    const topics = await ctx.db.query("topics").collect();
    const folders = await ctx.db.query("folders").collect();
    const withImages = await Promise.all(cards.map(async (card) => ({
      ...card,
      imageUrl: card.imageStorageId ? await ctx.storage.getUrl(card.imageStorageId) : null,
    })));
    return { cards: withImages, connections, topics, folders };
  },
});

export const updateCard = mutation({
  args: { id: v.string(), updates: v.any() },
  handler: async (ctx, args) => {
    const card = await ctx.db.query("cards").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (!card) {
      throw new Error("This card was deleted by another editor.");
    }
    if (args.updates.imageDisplayWidth !== undefined) {
      const width = args.updates.imageDisplayWidth;
      if (!card.imageStorageId || typeof width !== 'number' || !Number.isFinite(width) || width <= 0 || width > 4096) {
        throw new Error("Invalid image size");
      }
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

export const deleteCard = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const card = await ctx.db.query("cards").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (card) {
      await ctx.db.delete(card._id);
    }
    const conns = await ctx.db.query("connections").collect();
    for (const conn of conns) {
      if (conn.from === args.id || conn.to === args.id) {
        await ctx.db.delete(conn._id);
      }
    }
  },
});

export const addConnection = mutation({
  args: { connection: v.object({ id: v.string(), from: v.string(), to: v.string() }) },
  handler: async (ctx, args) => {
    if (args.connection.from === args.connection.to) return;
    for (const id of [args.connection.from, args.connection.to]) {
      if (!await ctx.db.query("cards").withIndex("idx_id", q => q.eq("id", id)).first()) {
        throw new Error("One of these cards no longer exists.");
      }
    }
    const connections = await ctx.db.query("connections").collect();
    if (connections.some(c => (c.from === args.connection.from && c.to === args.connection.to) ||
      (c.to === args.connection.from && c.from === args.connection.to))) return;
    const existing = await ctx.db
      .query("connections")
      .withIndex("idx_id", (q) => q.eq("id", args.connection.id))
      .first();
    if (!existing) {
      await ctx.db.insert("connections", args.connection);
    }
  },
});

export const removeConnection = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const conn = await ctx.db.query("connections").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (conn) await ctx.db.delete(conn._id);
  },
});

export const disconnectCards = mutation({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const conns = await ctx.db.query("connections").collect();
    for (const conn of conns) {
      if (
        (conn.from === args.from && conn.to === args.to) ||
        (conn.from === args.to && conn.to === args.from)
      ) {
        await ctx.db.delete(conn._id);
      }
    }
  },
});

export const upsertTopic = mutation({
  args: { id: v.string(), topic: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("topics").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (existing) {
      await ctx.db.patch(existing._id, args.topic);
    } else {
      await ctx.db.insert("topics", { ...args.topic });
    }
  },
});

export const updateTopic = mutation({
  args: { id: v.string(), updates: v.any() },
  handler: async (ctx, args) => {
    const topic = await ctx.db.query("topics").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (topic) {
      await ctx.db.patch(topic._id, args.updates);
    }
  },
});

export const deleteTopic = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const topic = await ctx.db.query("topics").withIndex("idx_id", (q) => q.eq("id", args.id)).first();
    if (topic) {
      await ctx.db.delete(topic._id);
    }
    const cards = await ctx.db.query("cards").collect();
    for (const c of cards) {
      if (c.topicId === args.id) {
        await ctx.db.patch(c._id, { topicId: "story" });
      }
    }
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
    const folders = await ctx.db.query("folders").collect();
    for (const folder of folders) await ctx.db.delete(folder._id);
    for (const folder of args.data.folders ?? []) {
      const { _id, _creationTime, ...clean } = folder;
      await ctx.db.insert("folders", clean);
    }

    // Seed topics
    for (const t of args.data.topics) {
      const { _id, _creationTime, ...clean } = t;
      await ctx.db.insert("topics", clean);
    }
    // Seed cards
    for (const c of args.data.cards) {
      const { _id, _creationTime, imageUrl, ...clean } = c;
      await ctx.db.insert("cards", clean);
    }
    // Seed connections
    for (const cn of args.data.connections) {
      const { _id, _creationTime, ...clean } = cn;
      await ctx.db.insert("connections", clean);
    }
  },
});

export const saveFolder = mutation({
  args: { folder: v.object({ id: v.string(), name: v.string(), color: v.string(), order: v.number() }) },
  handler: async (ctx, { folder }) => {
    if (!folder.name.trim() || !/^#[0-9a-f]{6}$/i.test(folder.color)) throw new Error("Invalid folder");
    const existing = await ctx.db.query("folders").withIndex("by_folder_id", q => q.eq("id", folder.id)).unique();
    if (existing) await ctx.db.patch(existing._id, folder);
    else await ctx.db.insert("folders", folder);
  },
});

export const deleteFolder = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const folder = await ctx.db.query("folders").withIndex("by_folder_id", q => q.eq("id", id)).unique();
    if (folder) await ctx.db.delete(folder._id);
    for (const topic of await ctx.db.query("topics").collect()) {
      if (topic.folderId === id) await ctx.db.patch(topic._id, { folderId: undefined });
    }
  },
});

export const arrangeSpaces = mutation({
  args: { ids: v.array(v.string()), folderId: v.optional(v.string()) },
  handler: async (ctx, { ids, folderId }) => {
    if (folderId && !await ctx.db.query("folders").withIndex("by_folder_id", q => q.eq("id", folderId)).unique()) {
      throw new Error("Folder no longer exists");
    }
    for (const [order, id] of ids.entries()) {
      if (id === 'all') continue;
      const topic = await ctx.db.query("topics").withIndex("idx_id", q => q.eq("id", id)).first();
      if (topic) await ctx.db.patch(topic._id, { order, folderId });
    }
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => ctx.storage.generateUploadUrl(),
});

export const addImage = mutation({
  args: { id: v.string(), storageId: v.id("_storage"), title: v.string(), topicId: v.string(), x: v.number(), y: v.number(), imageWidth: v.optional(v.number()), imageHeight: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.imageWidth !== undefined || args.imageHeight !== undefined) validateImageDimensions(args.imageWidth, args.imageHeight);
    const file = await ctx.db.system.get(args.storageId);
    if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.contentType ?? '') || file.size > 10 * 1024 * 1024) {
      throw new Error("Choose a PNG, JPEG, WebP, GIF or AVIF image up to 10 MB.");
    }
    await ctx.db.insert("cards", {
      id: args.id, title: args.title, topicId: args.topicId, x: args.x, y: args.y,
      imageStorageId: args.storageId, body: '', source: '', kind: 'knowledge',
      imageWidth: args.imageWidth, imageHeight: args.imageHeight,
      confidence: 'first-hand', status: 'open', updatedAt: Date.now(),
    });
  },
});

function validateImageDimensions(width: number | undefined, height: number | undefined) {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 100000 || height > 100000) {
    throw new Error("Invalid image dimensions");
  }
}

// Existing images learn their dimensions on load. Concurrent viewers cannot
// replace known dimensions or reset a size another viewer has already chosen.
export const setImageDimensions = mutation({
  args: { id: v.string(), imageWidth: v.number(), imageHeight: v.number() },
  handler: async (ctx, args) => {
    validateImageDimensions(args.imageWidth, args.imageHeight);
    const card = await ctx.db.query("cards").withIndex("idx_id", q => q.eq("id", args.id)).first();
    if (!card?.imageStorageId || (card.imageWidth && card.imageHeight)) return;
    await ctx.db.patch(card._id, { imageWidth: args.imageWidth, imageHeight: args.imageHeight });
  },
});
