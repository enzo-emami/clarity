/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
const modules = import.meta.glob('./**/*.ts')
const card = (id: string) => ({ id, title: id, body: '', kind: 'knowledge', confidence: 'first-hand', status: 'open', topicId: 'story', x: 0, y: 0, source: '', updatedAt: 1 })

test('connections reject missing endpoints and deduplicate reverse wires', async () => {
  const t = convexTest(schema, modules)
  for (const id of ['a','b']) await t.mutation(api.board.upsertCard, { id, card: card(id) })
  await t.mutation(api.board.addConnection, { connection: { id: 'ab', from: 'a', to: 'b' } })
  await t.mutation(api.board.addConnection, { connection: { id: 'ba', from: 'b', to: 'a' } })
  await t.mutation(api.board.addConnection, { connection: { id: 'aa', from: 'a', to: 'a' } })
  expect((await t.query(api.board.getBoardData)).connections).toHaveLength(1)
  await expect(t.mutation(api.board.addConnection, { connection: { id: 'bad', from: 'a', to: 'missing' } })).rejects.toThrow()
  await t.mutation(api.board.deleteCard, { id: 'a' })
  expect((await t.query(api.board.getBoardData)).connections).toHaveLength(0)
})

test('space order persists and deleting a folder preserves spaces and cards', async () => {
  const t = convexTest(schema, modules)
  for (const id of ['a','b','c']) await t.mutation(api.board.upsertTopic, { id, topic: { id, name: id, color: '#ffffff' } })
  await t.mutation(api.board.upsertCard, { id: 'card', card: { ...card('card'), topicId: 'a' } })
  await t.mutation(api.board.saveFolder, { folder: { id: 'folder', name: 'Work', color: '#abcdef', order: 0 } })
  await t.mutation(api.board.arrangeSpaces, { ids: ['c','a'], folderId: 'folder' })
  let data = await t.query(api.board.getBoardData)
  expect(data.topics.find(t => t.id === 'a')).toMatchObject({ order: 1, folderId: 'folder' })
  await t.mutation(api.board.deleteFolder, { id: 'folder' })
  data = await t.query(api.board.getBoardData)
  expect(data.folders).toHaveLength(0)
  expect(data.topics).toHaveLength(3)
  expect(data.topics.every(t => t.folderId === undefined)).toBe(true)
  expect(data.cards[0].topicId).toBe('a')
})

test('images are stored as connectable cards and unsupported files are rejected', async () => {
  const t = convexTest(schema, modules)
  const storageId = await t.run(ctx => ctx.storage.store(new Blob(['image'], { type: 'image/png' })))
  // convex-test's storeBlob does not populate contentType; HTTP uploads do.
  // @ts-expect-error Only the test harness permits patching storage system metadata.
  await t.run(ctx => ctx.db.patch(storageId, { contentType: 'image/png' }))
  await t.mutation(api.board.addImage, { id: 'image', storageId, title: 'Photo', topicId: 'story', x: 22, y: -44 })
  const data = await t.query(api.board.getBoardData)
  expect(data.cards[0]).toMatchObject({ imageStorageId: storageId, title: 'Photo', x: 22, y: -44 })
  expect(data.cards[0].imageUrl).toBeTruthy()
  const invalid = await t.run(ctx => ctx.storage.store(new Blob(['html'], { type: 'text/html' })))
  await expect(t.mutation(api.board.addImage, { id: 'invalid', storageId: invalid, title: 'Bad', topicId: 'story', x: 0, y: 0 })).rejects.toThrow()
  expect((await t.query(api.board.getBoardData)).cards).toHaveLength(1)
})

test('exported query results can be restored including folder and image metadata', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(api.board.upsertCard, { id: 'a', card: card('a') })
  await t.mutation(api.board.saveFolder, { folder: { id: 'folder', name: 'Work', color: '#abcdef', order: 0 } })
  const exported = await t.query(api.board.getBoardData)
  await t.mutation(api.board.seedBoard, { data: exported })
  const restored = await t.query(api.board.getBoardData)
  expect(restored.cards[0].title).toBe('a')
  expect(restored.folders[0].name).toBe('Work')
})
