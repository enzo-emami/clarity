import { expect, test } from 'vitest'
import { snap, contrastText, freePosition } from './mapUtils'
test('automatic placement avoids occupied cards while staying on the grid', () => {
  const cards = [{ x: 0, y: 0 }]
  for (let i = 0; i < 30; i++) {
    const pos = freePosition(0, 0, cards)
    expect(cards.some(c => Math.abs(c.x-pos.x) < 250 && Math.abs(c.y-pos.y) < 144)).toBe(false)
    expect(pos.x % 22).toBeCloseTo(0); expect(pos.y % 22).toBeCloseTo(0)
    cards.push(pos)
  }
})
test('grid snapping works on either side of the origin', () => {
  expect(snap(34)).toBe(44)
  expect(snap(-34)).toBe(-44)
  expect(snap(22)).toBe(22)
})
test('selected text colors meet AA contrast for a broad range of colors', () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const hex = '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('')
    const [lr,lg,lb] = [r,g,b].map(c => c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
    const l = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
    const ratio = contrastText(hex) === '#000000' ? (l + 0.05) / 0.05 : 1.05 / (l + 0.05)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  }
})
