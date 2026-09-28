import { expect, test } from 'vitest'
import { cardSize, imageRatio, resizeImage, IMAGE_CAPTION_H } from './cardGeometry'

test('image cards use their original landscape, portrait and panoramic proportions', () => {
  for (const [imageWidth, imageHeight] of [[1600, 900], [800, 1200], [5000, 100], [100, 5000], [1, 1]]) {
    const card = { imageStorageId: 'photo', imageWidth, imageHeight }
    const size = cardSize(card)
    expect(size.width / (size.height - IMAGE_CAPTION_H)).toBeCloseTo(imageWidth / imageHeight)
    expect(Math.max(size.width, size.height - IMAGE_CAPTION_H)).toBeLessThanOrEqual(640)
    expect(Math.max(size.width, size.height - IMAGE_CAPTION_H)).toBeGreaterThanOrEqual(240)
  }
  expect(cardSize({})).toEqual({ width: 250, height: 144 })
})

test('every corner preserves aspect ratio and the opposite anchor', () => {
  const original = { x: -100, y: 80, width: 400, height: 232 }
  for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
    const next = resizeImage(original, 2, corner, 70, 40)
    expect(next.width / (next.height - IMAGE_CAPTION_H)).toBeCloseTo(2)
    expect(corner.endsWith('e') ? next.x : next.x + next.width).toBeCloseTo(corner.endsWith('e') ? original.x : original.x + original.width)
    expect(corner.startsWith('s') ? next.y : next.y + next.height).toBeCloseTo(corner.startsWith('s') ? original.y : original.y + original.height)
  }
})

test('resizing cannot invert a photo or produce an unbounded canvas item', () => {
  const original = { x: 0, y: 0, width: 200, height: 432 }
  for (const delta of [-100000, 100000]) {
    const next = resizeImage(original, 0.5, 'se', delta, delta)
    expect(next.width).toBeGreaterThan(0)
    expect(next.height - IMAGE_CAPTION_H).toBeLessThanOrEqual(4096)
    expect(imageRatio({ imageWidth: 100, imageHeight: 200 })).toBe(0.5)
  }
})
