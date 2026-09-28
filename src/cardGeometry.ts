import type { ClarityCard } from './types'

export const CARD_W = 250
export const CARD_H = 144
export const IMAGE_CAPTION_H = 32
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'
type ImageGeometry = Pick<ClarityCard, 'imageStorageId' | 'imageWidth' | 'imageHeight' | 'imageDisplayWidth'>

export function imageRatio(card: ImageGeometry) {
  return card.imageWidth && card.imageHeight && card.imageWidth > 0 && card.imageHeight > 0
    ? card.imageWidth / card.imageHeight : 4 / 3
}

export function clampImageWidth(width: number, ratio: number) {
  // Limit the longest side so both portrait and panoramic images remain usable.
  return Math.min(4096 * Math.min(1, ratio), Math.max(120 * Math.min(1, ratio), width))
}

export function cardSize(card: ImageGeometry) {
  if (!card.imageStorageId) return { width: CARD_W, height: CARD_H }
  const ratio = imageRatio(card)
  const naturalLongest = Math.max(card.imageWidth ?? 480, card.imageHeight ?? 360)
  const defaultWidth = Math.min(640, Math.max(240, naturalLongest)) * Math.min(1, ratio)
  const width = clampImageWidth(card.imageDisplayWidth ?? defaultWidth, ratio)
  return { width, height: width / ratio + IMAGE_CAPTION_H }
}

export function resizeImage(
  bounds: { x: number; y: number; width: number; height: number },
  ratio: number, corner: ResizeCorner, dx: number, dy: number,
) {
  const east = corner.endsWith('e'), south = corner.startsWith('s')
  const horizontal = east ? dx : -dx, vertical = south ? dy : -dy
  // Project the pointer delta onto the image's aspect-ratio diagonal.
  const width = clampImageWidth(bounds.width + (horizontal + vertical / ratio) / (1 + 1 / ratio ** 2), ratio)
  const height = width / ratio + IMAGE_CAPTION_H
  return { width, height, x: east ? bounds.x : bounds.x + bounds.width - width, y: south ? bounds.y : bounds.y + bounds.height - height }
}

export async function readImageDimensions(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no dimensions')
    return { imageWidth: image.naturalWidth, imageHeight: image.naturalHeight }
  } catch {
    throw new Error('This image could not be opened. Please choose another image.')
  } finally { URL.revokeObjectURL(url) }
}
