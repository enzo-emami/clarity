import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

// Destructive fixtures are strictly limited to the local test backend.
const client = new ConvexHttpClient('http://127.0.0.1:3210')
const card = (id: string, x: number) => ({ id, title: `Card ${id}`, body: '', source: '', kind: 'knowledge', confidence: 'first-hand', status: 'open', topicId: 'story', x, y: 0, updatedAt: 1 })
test.beforeEach(async ({ page }) => {
  await page.route('https://*.convex.cloud/**', route => route.abort())
  await page.routeWebSocket('wss://*.convex.cloud/**', socket => socket.close())
  await client.mutation(api.board.seedBoard, { data: {
    cards: [card('a', -308), card('b', 44)], connections: [], folders: [],
    topics: [{ id: 'all', name: 'All threads', color: '#223344' }, { id: 'story', name: 'Story', color: '#557b72' }, { id: 'work', name: 'Work', color: '#8844aa' }, { id: 'ideas', name: 'Ideas', color: '#2244aa' }],
  } })
  await page.goto('/')
  await expect(page.locator('[data-card-id="a"]')).toBeVisible()
})

test('fast typing stays local, survives stale remote updates and reaches another device', async ({ page, context }) => {
  const second = await context.newPage(); await second.goto('/')
  await page.locator('[data-card-id="a"]').click()
  const title = page.getByLabel('Title', { exact: true })
  await title.fill('')
  const text = 'Fast typing never loses letters, spaces, or punctuation!'
  await title.pressSequentially(text, { delay: 2 })
  await expect(title).toHaveValue(text)
  await client.mutation(api.board.updateCard, { id: 'a', updates: { body: 'An independent remote edit' } })
  await expect(title).toHaveValue(text)
  await expect(second.locator('[data-card-id="a"] .card-title')).toHaveText(text)
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')?.title).toBe(text)
  await expect(page.getByLabel('Thought & Context')).toHaveValue('An independent remote edit')
})

test('drag only syncs on drop, snaps to grid, and cancellation does not persist', async ({ page, context }) => {
  const second = await context.newPage(); await second.goto('/')
  await expect(second.locator('[data-card-id="a"]')).toBeVisible()
  const initial = await second.locator('[data-card-id="a"]').getAttribute('style')
  const box = (await page.locator('[data-card-id="a"]').boundingBox())!
  await page.mouse.move(box.x + 50, box.y + 40); await page.mouse.down()
  await page.mouse.move(box.x + 137, box.y + 121, { steps: 15 })
  await expect(page.locator('.snap-preview')).toBeVisible()
  expect((await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')?.x).toBe(-308)
  expect(await second.locator('[data-card-id="a"]').getAttribute('style')).toBe(initial)
  await page.mouse.up()
  await expect(page.locator('.snap-preview')).toHaveCount(0)
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')?.x).not.toBe(-308)
  const saved = (await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')!
  expect(saved.x % 22).toBeCloseTo(0); expect(saved.y % 22).toBeCloseTo(0)
  await expect(second.locator('[data-card-id="a"]')).toHaveCSS('transform', `matrix(1, 0, 0, 1, ${saved.x}, ${saved.y})`)
  const moved = (await page.locator('[data-card-id="a"]').boundingBox())!
  await page.mouse.move(moved.x + 30, moved.y + 30); await page.mouse.down(); await page.mouse.move(moved.x + 70, moved.y + 60)
  await page.locator('[data-card-id="a"]').dispatchEvent('pointercancel')
  await page.mouse.up()
  expect((await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')?.x).toBe(saved.x)
})

test('right-button hold connects cards and release on empty canvas cancels', async ({ page }) => {
  const a = (await page.locator('[data-card-id="a"]').boundingBox())!
  const b = (await page.locator('[data-card-id="b"]').boundingBox())!
  await page.mouse.move(a.x + 50, a.y + 50); await page.mouse.down({ button: 'right' })
  await page.mouse.move(b.x + 50, b.y + 50, { steps: 10 })
  await expect(page.locator('.live-wire')).toBeVisible()
  await page.mouse.up({ button: 'right' })
  await expect.poll(async () => (await client.query(api.board.getBoardData)).connections.length).toBe(1)
  await page.mouse.move(a.x + 50, a.y + 50); await page.mouse.down({ button: 'right' })
  await page.mouse.move(1300, 800); await page.mouse.up({ button: 'right' })
  await expect(page.locator('.live-wire')).toHaveCount(0)
  expect((await client.query(api.board.getBoardData)).connections).toHaveLength(1)
})

test('spaces reorder and folders support rename, color, move and removal', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a folder', exact: true }).click()
  await page.getByLabel('Folder name').fill('Research')
  await page.getByLabel('Folder color').fill('#123456')
  await page.getByRole('button', { name: 'Save folder' }).click()
  await expect(page.locator('.folder-heading')).toHaveText('Research')
  await page.locator('.topic').filter({ hasText: 'Work' }).click({ button: 'right' })
  const folder = (await client.query(api.board.getBoardData)).folders[0]
  await page.getByLabel('Add to folder').selectOption(folder.id)
  await expect(page.locator('.folder-spaces .topic')).toHaveText('Work0')
  await page.locator('.topic').filter({ hasText: 'Ideas' }).dragTo(page.locator('.topic').filter({ hasText: 'Story' }))
  await expect.poll(async () => (await client.query(api.board.getBoardData)).topics.find(t => t.id === 'ideas')?.order).toBe(0)
  await page.locator('.folder-heading').click({ button: 'right' })
  await page.getByLabel('Folder name').fill('Reference')
  await page.getByRole('button', { name: 'Save folder' }).click()
  await expect(page.locator('.folder-heading')).toHaveText('Reference')
  await page.locator('.folder-heading').click({ button: 'right' })
  await page.getByRole('button', { name: 'Remove folder · keep spaces' }).click()
  await expect(page.locator('.folder-heading')).toHaveCount(0)
  await expect(page.locator('.topic').filter({ hasText: 'Work' })).toBeVisible()
})

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
test('import and clipboard images persist and open a name-only editor', async ({ page }) => {
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'Reference.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.image-card')).toHaveCount(1)
  await page.locator('.image-card').click()
  await expect(page.getByLabel('Image name')).toHaveValue('Reference')
  await expect(page.locator('.body-input')).toHaveCount(0)
  await page.getByLabel('Image name').fill('Mood board')
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await expect(page.locator('.image-name')).toHaveText('Mood board')
  await page.evaluate(async base64 => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
    const data = new DataTransfer(); data.items.add(new File([blob], 'Pasted.png', { type: 'image/png' }))
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
  }, png.toString('base64'))
  await expect(page.locator('.image-card')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('.image-card')).toHaveCount(2)
  const images = await page.locator('.map-image').evaluateAll(elements => elements.every(e => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0))
  expect(images).toBe(true)
  const imported = page.locator('.image-card').filter({ hasText: 'Mood board' })
  await imported.click()
  await page.getByRole('button', { name: 'Connect card', exact: true }).click()
  await page.getByRole('button', { name: 'Fit all cards in view' }).click()
  await page.locator('[data-card-id="a"]').click()
  await expect.poll(async () => (await client.query(api.board.getBoardData)).connections.length).toBe(1)
})

test('offline typing stays visible and syncs after reconnecting', async ({ page, context }) => {
  await page.locator('[data-card-id="a"]').click()
  await context.setOffline(true)
  const text = 'These edits survive a temporary network outage.'
  await page.getByLabel('Title', { exact: true }).fill(text)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(text)
  await expect(page.locator('.saved')).toContainText('Saving')
  await context.setOffline(false)
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')?.title).toBe(text)
  await expect(page.locator('.saved')).toContainText('synced to cloud')
})

test('new cards snap after pan and zoom; map and inspector render cleanly', async ({ page }) => {
  await page.mouse.move(1000, 700)
  await page.mouse.wheel(0, -150)
  await page.mouse.move(1250, 750); await page.mouse.down(); await page.mouse.move(1200, 710); await page.mouse.up()
  await page.getByRole('button', { name: 'New card', exact: true }).click()
  await expect(page.locator('.inspector')).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('A clearer map')
  await page.getByLabel('Thought & Context').fill('A place for questions, references, and connected ideas.')
  await page.getByLabel('Card color', { exact: true }).fill('#254f45')
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await page.getByRole('button', { name: 'Fit all cards in view' }).click()
  const created = (await client.query(api.board.getBoardData)).cards.find(c => !['a','b'].includes(c.id))!
  expect(created.x % 22).toBeCloseTo(0); expect(created.y % 22).toBeCloseTo(0)
  await page.screenshot({ path: 'test-results/map-overview.png' })
})

test('custom preview colors select legible foregrounds and persist', async ({ page }) => {
  await page.locator('[data-card-id="a"]').click()
  await page.getByLabel('Card color', { exact: true }).fill('#101010')
  await expect(page.locator('[data-card-id="a"]')).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.locator('[data-card-id="a"] .card-title')).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.getByLabel('Card color', { exact: true }).fill('#ffff88')
  await expect(page.locator('[data-card-id="a"]')).toHaveCSS('color', 'rgb(0, 0, 0)')
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === 'a')?.color).toBe('#ffff88')
})

async function photoFile(page: Page, width: number, height: number, name: string) {
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#396c62'; ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#ead0a2'; ctx.fillRect(width / 4, height / 4, width / 2, height / 2)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height })
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

test('landscape photo resizes proportionally, syncs only on release and survives reload', async ({ page, context }) => {
  await page.locator('input[type=file][multiple]').setInputFiles(await photoFile(page, 1200, 600, 'Landscape.png'))
  const photo = page.locator('.image-card')
  await expect(photo).toHaveCount(1)
  await page.getByRole('button', { name: 'Fit all cards in view' }).click()
  await expect(photo).toHaveCSS('width', '640px')
  await expect(photo).toHaveCSS('height', '352px')
  const id = (await photo.getAttribute('data-card-id'))!
  await client.mutation(api.board.addConnection, { connection: { id: 'photo-edge', from: id, to: 'a' } })
  const second = await context.newPage(); await second.goto('/')
  await expect(second.locator('.image-card')).toHaveCSS('width', '640px')
  const handle = (await photo.locator('.resize-se').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down(); await page.mouse.move(handle.x + 120, handle.y + 65, { steps: 12 })
  await expect(photo).toHaveClass(/resizing/)
  expect((await client.query(api.board.getBoardData)).cards.find(c => c.id === id)?.imageDisplayWidth).toBeUndefined()
  await expect(second.locator('.image-card')).toHaveCSS('width', '640px')
  await page.mouse.up()
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === id)?.imageDisplayWidth ?? 0).toBeGreaterThan(640)
  const saved = (await client.query(api.board.getBoardData)).cards.find(c => c.id === id)!
  await expect.poll(() => second.locator('.image-card').evaluate(el => parseFloat(getComputedStyle(el).width))).toBeCloseTo(saved.imageDisplayWidth!, 1)
  const imageBox = (await photo.locator('img').boundingBox())!
  expect(imageBox.width / imageBox.height).toBeCloseTo(2, 2)
  const path = await page.locator('.edges > path').getAttribute('d')
  expect(path).toContain(`M ${saved.x + saved.imageDisplayWidth! / 2} ${saved.y + (saved.imageDisplayWidth! / 2 + 32) / 2}`)
  await page.reload()
  await expect.poll(() => page.locator('.image-card').evaluate(el => parseFloat(getComputedStyle(el).width))).toBeCloseTo(saved.imageDisplayWidth!, 1)
  await page.getByRole('button', { name: 'Fit all cards in view' }).click()
  const bounds = (await photo.boundingBox())!, canvas = (await page.locator('.canvas').boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(canvas.x)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvas.y + canvas.height)
  await page.screenshot({ path: 'test-results/resizable-photo.png' })
})

test('portrait photos preserve ratio, opposite-corner anchors and cancelled resize', async ({ page }) => {
  await page.locator('input[type=file][multiple]').setInputFiles(await photoFile(page, 600, 1200, 'Portrait.png'))
  const photo = page.locator('.image-card')
  await expect(photo).toHaveCSS('width', '320px')
  await expect(photo).toHaveCSS('height', '672px')
  await page.getByRole('button', { name: 'Fit all cards in view' }).click()
  const id = (await photo.getAttribute('data-card-id'))!
  const original = (await client.query(api.board.getBoardData)).cards.find(c => c.id === id)!
  await photo.hover()
  const handle = (await photo.locator('.resize-nw').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down(); await page.mouse.move(handle.x - 20, handle.y - 40, { steps: 8 }); await page.mouse.up()
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === id)?.imageDisplayWidth ?? 0).toBeGreaterThan(320)
  const saved = (await client.query(api.board.getBoardData)).cards.find(c => c.id === id)!
  expect(saved.x + saved.imageDisplayWidth!).toBeCloseTo(original.x + 320)
  expect(saved.y + saved.imageDisplayWidth! * 2 + 32).toBeCloseTo(original.y + 672)
  const imageBox = (await photo.locator('img').boundingBox())!
  expect(imageBox.width / imageBox.height).toBeCloseTo(0.5, 2)
  const nextHandle = (await photo.locator('.resize-se').boundingBox())!
  await page.mouse.move(nextHandle.x + 9, nextHandle.y + 9); await page.mouse.down()
  await page.mouse.move(nextHandle.x + 50, nextHandle.y + 50, { steps: 5 })
  await page.keyboard.press('Escape'); await page.mouse.up()
  await expect(photo).not.toHaveClass(/resizing/)
  expect((await client.query(api.board.getBoardData)).cards.find(c => c.id === id)?.imageDisplayWidth).toBe(saved.imageDisplayWidth)
})

test('previously uploaded photos learn their natural ratio without losing name or position', async ({ page }) => {
  const file = await photoFile(page, 900, 300, 'Existing.png')
  const url = await client.mutation(api.board.generateUploadUrl)
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: file.buffer })
  const { storageId } = await response.json()
  await client.mutation(api.board.addImage, { id: 'legacy', storageId, title: 'Existing photo', topicId: 'story', x: 704, y: 22 })
  await expect(page.locator('[data-card-id="legacy"]')).toHaveCSS('height', '245.328px')
  await expect.poll(async () => (await client.query(api.board.getBoardData)).cards.find(c => c.id === 'legacy')?.imageWidth).toBe(900)
  expect((await client.query(api.board.getBoardData)).cards.find(c => c.id === 'legacy')).toMatchObject({ title: 'Existing photo', x: 704, y: 22, imageWidth: 900, imageHeight: 300 })
})
