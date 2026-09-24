import type { BoardData, ClarityCard } from './types'
import { starterData } from './data'

export function organize(cards: ClarityCard[], topics: BoardData['topics']) {
  const spaces = topics.filter((topic) => topic.id !== 'all')
  return cards.map((card) => {
    const space = Math.max(0, spaces.findIndex((topic) => topic.id === card.topicId))
    const index = cards.filter((item) => item.topicId === card.topicId).findIndex((item) => item.id === card.id)
    return {
      ...card,
      x: (space % 3) * 1100 + (index % 3) * 310,
      y: Math.floor(space / 3) * 1650 + Math.floor(index / 3) * 210,
      vx: 0,
      vy: 0,
    }
  })
}

export function upgradeBoard(board: BoardData): BoardData {
  if ((board.contentVersion ?? 0) >= 3) {
    return {
      ...board,
      cards: board.cards.map((card) => ({ ...card, vx: 0, vy: 0 })),
    }
  }
  // Upgraded to deep knowledge base board (version 3)
  return starterData
}
