export type CardKind = 'question' | 'knowledge' | 'meaning'
export type Confidence = 'first-hand' | 'shared-with-me' | 'hypothesis'
export type CardStatus = 'open' | 'resolved' | 'rejected'

export type Topic = {
  id: string
  name: string
  color: string
  x?: number
  y?: number
  order?: number
  folderId?: string
}

export type SpaceFolder = { id: string; name: string; color: string; order: number }

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
  vx?: number
  vy?: number
  updatedAt: number
  color?: string
  imageStorageId?: string
  imageUrl?: string | null
  /** Original dimensions, used to preserve the photo's aspect ratio. */
  imageWidth?: number
  imageHeight?: number
  /** Resizable width on the map; image height is derived from its original ratio. */
  imageDisplayWidth?: number
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
  folders?: SpaceFolder[]
}
