export type CardKind = 'question' | 'knowledge' | 'meaning'
export type Confidence = 'first-hand' | 'shared-with-me' | 'hypothesis'
export type CardStatus = 'open' | 'resolved' | 'rejected'

export type Topic = {
  id: string
  name: string
  color: string
}

export type ClarityCard = {
  id: string
  title: string
  body: string
  source?: string
  kind: CardKind
  confidence: Confidence
  status: CardStatus
  topicId: string
  x: number
  y: number
  vx: number
  vy: number
  updatedAt: number
}

export type Connection = {
  id: string
  from: string
  to: string
}

export type BoardData = {
  contentVersion?: number
  cards: ClarityCard[]
  connections: Connection[]
  topics: Topic[]
}
