export const GRID = 22
export const snap = (value: number) => Math.round(value / GRID) * GRID

export function freePosition(x: number, y: number, cards: { x: number; y: number }[]) {
  const origin = { x: snap(x), y: snap(y) }
  const available = (px: number, py: number) => !cards.some(c => Math.abs(c.x - px) < 272 && Math.abs(c.y - py) < 166)
  if (available(origin.x, origin.y)) return origin
  for (let ring = 1; ring <= cards.length + 1; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (const dy of [-ring, ring]) {
      const next = { x: origin.x + dx * 286, y: origin.y + dy * 176 }
      if (available(next.x, next.y)) return next
    }
    for (let dy = -ring + 1; dy < ring; dy++) for (const dx of [-ring, ring]) {
      const next = { x: origin.x + dx * 286, y: origin.y + dy * 176 }
      if (available(next.x, next.y)) return next
    }
  }
  return origin
}

// Choose the higher WCAG contrast ratio. Black or white always provides >= 4.58:1.
export function contrastText(hex: string): '#000000' | '#ffffff' {
  const channels = hex.replace('#', '').match(/.{2}/g)
  if (!channels || channels.length !== 3) return '#000000'
  const [r, g, b] = channels.map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff'
}
