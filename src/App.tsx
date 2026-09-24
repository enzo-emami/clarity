import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Download,
  Focus,
  Link2,
  Menu,
  MousePointer2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlink,
  Upload,
  X,
} from 'lucide-react'
import { confidenceLabels, kindMeta, starterData } from './data'
import type { BoardData, CardKind, ClarityCard, Confidence, Connection, Topic } from './types'

const STORAGE_KEY = 'clarity-board-v1'
const CARD_W = 250
const CARD_H = 144

const uid = () => Math.random().toString(36).slice(2, 10)

function loadBoard(): BoardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : starterData
  } catch {
    return starterData
  }
}

function App() {
  const [data, setData] = useState<BoardData>(loadBoard)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [topicId, setTopicId] = useState('all')
  const [query, setQuery] = useState('')
  const [camera, setCamera] = useState({ x: innerWidth / 2 - 86, y: innerHeight / 2, zoom: 0.48 })
  const [linkStart, setLinkStart] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const panning = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const visibleIds = useMemo(() => {
    const q = query.toLowerCase().trim()
    return new Set(
      data.cards
        .filter((card) => topicId === 'all' || card.topicId === topicId)
        .filter((card) => !q || `${card.title} ${card.body}`.toLowerCase().includes(q))
        .map((card) => card.id),
    )
  }, [data.cards, query, topicId])

  const visibleCards = data.cards.filter((card) => visibleIds.has(card.id))
  const visibleEdges = data.connections.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
  )
  const selected = data.cards.find((card) => card.id === selectedId) ?? null
  const activeTopic = data.topics.find((topic) => topic.id === topicId) ?? data.topics[0]
  const connectedCards = new Set(data.connections.flatMap((edge) => [edge.from, edge.to])).size
  const openQuestions = data.cards.filter((card) => card.kind === 'question').length
  const resolvedQuestions = data.cards.filter((card) => card.kind === 'question' && card.status === 'resolved').length
  const clarityScore = Math.round(
    10 + (connectedCards / Math.max(1, data.cards.length)) * 45 + (resolvedQuestions / Math.max(1, openQuestions)) * 45,
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    let frame = 0
    let running = true
    const tick = () => {
      if (!running) return
      const current = dataRef.current
      if (current.cards.length > 1) {
        let moving = false
        const cards = current.cards.map((card) => ({ ...card }))
        const byId = new Map(cards.map((card) => [card.id, card]))

        for (let i = 0; i < cards.length; i++) {
          for (let j = i + 1; j < cards.length; j++) {
            const a = cards[i]
            const b = cards[j]
            let dx = b.x - a.x
            let dy = b.y - a.y
            const dist = Math.max(40, Math.hypot(dx, dy))
            const force = Math.min(0.8, 18000 / (dist * dist))
            dx /= dist
            dy /= dist
            if (dragging.current?.id !== a.id) {
              a.vx -= dx * force
              a.vy -= dy * force
            }
            if (dragging.current?.id !== b.id) {
              b.vx += dx * force
              b.vy += dy * force
            }
          }
        }

        current.connections.forEach((edge) => {
          const a = byId.get(edge.from)
          const b = byId.get(edge.to)
          if (!a || !b) return
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.max(1, Math.hypot(dx, dy))
          const spring = (dist - 330) * 0.0018
          const fx = (dx / dist) * spring
          const fy = (dy / dist) * spring
          if (dragging.current?.id !== a.id) {
            a.vx += fx
            a.vy += fy
          }
          if (dragging.current?.id !== b.id) {
            b.vx -= fx
            b.vy -= fy
          }
        })

        cards.forEach((card) => {
          if (dragging.current?.id === card.id) {
            card.vx = 0
            card.vy = 0
            return
          }
          card.vx = (card.vx - card.x * 0.00002) * 0.91
          card.vy = (card.vy - card.y * 0.00002) * 0.91
          card.x += card.vx
          card.y += card.vy
          if (Math.abs(card.vx) + Math.abs(card.vy) > 0.015) moving = true
        })
        if (moving) setData((old) => ({ ...old, cards }))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragging.current) {
        const worldX = (event.clientX - camera.x) / camera.zoom
        const worldY = (event.clientY - camera.y) / camera.zoom
        const { id, dx, dy } = dragging.current
        setData((old) => ({
          ...old,
          cards: old.cards.map((card) =>
            card.id === id ? { ...card, x: worldX - dx, y: worldY - dy, vx: 0, vy: 0 } : card,
          ),
        }))
      } else if (panning.current) {
        setCamera((old) => ({
          ...old,
          x: panning.current!.cx + event.clientX - panning.current!.sx,
          y: panning.current!.cy + event.clientY - panning.current!.sy,
        }))
      }
    }
    const onUp = () => {
      dragging.current = null
      panning.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera.x, camera.y, camera.zoom])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  const addCard = (kind: CardKind = 'knowledge') => {
    const id = uid()
    const next: ClarityCard = {
      id,
      title: kind === 'question' ? 'A question worth exploring' : kind === 'meaning' ? 'What might this mean?' : 'Untitled thought',
      body: '',
      source: 'Added in Clarity',
      kind,
      confidence: kind === 'meaning' ? 'hypothesis' : 'first-hand',
      status: 'open',
      topicId: topicId === 'all' ? 'story' : topicId,
      x: (innerWidth / 2 - camera.x) / camera.zoom - CARD_W / 2 + (Math.random() - 0.5) * 80,
      y: (innerHeight / 2 - camera.y) / camera.zoom - CARD_H / 2 + (Math.random() - 0.5) * 80,
      vx: 0,
      vy: 0,
      updatedAt: Date.now(),
    }
    setData((old) => ({ ...old, cards: [...old.cards, next] }))
    setSelectedId(id)
    setSelectedEdge(null)
  }

  const chooseCard = (id: string) => {
    if (linkStart) {
      if (linkStart !== id && !data.connections.some((e) => (e.from === linkStart && e.to === id) || (e.from === id && e.to === linkStart))) {
        setData((old) => ({ ...old, connections: [...old.connections, { id: uid(), from: linkStart, to: id }] }))
        notify('Connection made')
      }
      setLinkStart(null)
      return
    }
    setSelectedId(id)
    setSelectedEdge(null)
  }

  const updateCard = (patch: Partial<ClarityCard>) => {
    if (!selectedId) return
    setData((old) => ({
      ...old,
      cards: old.cards.map((card) => card.id === selectedId ? { ...card, ...patch, updatedAt: Date.now() } : card),
    }))
  }

  const deleteCard = () => {
    if (!selectedId) return
    setData((old) => ({
      ...old,
      cards: old.cards.filter((card) => card.id !== selectedId),
      connections: old.connections.filter((edge) => edge.from !== selectedId && edge.to !== selectedId),
    }))
    setSelectedId(null)
    notify('Card removed')
  }

  const startLink = () => {
    if (!selectedId) return notify('Choose a card first')
    setLinkStart(selectedId)
    setSelectedId(null)
    notify('Now choose a card to connect')
  }

  const removeEdge = () => {
    if (!selectedEdge) return
    setData((old) => ({ ...old, connections: old.connections.filter((edge) => edge.id !== selectedEdge) }))
    setSelectedEdge(null)
    notify('Connection removed')
  }

  const fitView = useCallback(() => {
    if (!visibleCards.length) return
    const minX = Math.min(...visibleCards.map((c) => c.x))
    const maxX = Math.max(...visibleCards.map((c) => c.x + CARD_W))
    const minY = Math.min(...visibleCards.map((c) => c.y))
    const maxY = Math.max(...visibleCards.map((c) => c.y + CARD_H))
    const width = maxX - minX + 180
    const height = maxY - minY + 180
    const zoom = Math.min(1.15, Math.max(0.38, Math.min(innerWidth / width, innerHeight / height)))
    setCamera({
      zoom,
      x: innerWidth / 2 - ((minX + maxX) / 2) * zoom,
      y: innerHeight / 2 - ((minY + maxY) / 2) * zoom,
    })
  }, [visibleCards])

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `clarity-map-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
    notify('Private backup downloaded')
  }

  const importData = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)) as BoardData
        if (!Array.isArray(next.cards) || !Array.isArray(next.connections) || !Array.isArray(next.topics)) throw new Error()
        setData(next)
        setSelectedId(null)
        notify('Map restored')
      } catch {
        notify('That file is not a Clarity map')
      }
    }
    reader.readAsText(file)
  }

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    const scale = Math.exp(-event.deltaY * 0.001)
    const zoom = Math.min(1.8, Math.max(0.32, camera.zoom * scale))
    const wx = (event.clientX - camera.x) / camera.zoom
    const wy = (event.clientY - camera.y) / camera.zoom
    setCamera({ x: event.clientX - wx * zoom, y: event.clientY - wy * zoom, zoom })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <span>clarity</span>
          <span className="saved"><Check size={13} /> saved here</span>
        </div>
        <div className="searchbox">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a thought…" />
          <kbd>⌘ K</kbd>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={() => setBulkOpen(true)}><Upload size={16} /> Quick capture</button>
          <button className="primary-button" onClick={() => addCard()}><Plus size={17} /> New card</button>
          <button className="icon-button" onClick={() => setSidebarOpen((open) => !open)} aria-label="Open spaces"><Menu size={19} /></button>
        </div>
      </header>

      <aside className={sidebarOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <p className="eyebrow">Your map</p>
        <nav className="topics">
          {data.topics.map((topic) => (
            <button key={topic.id} className={topicId === topic.id ? 'topic active' : 'topic'} onClick={() => { setTopicId(topic.id); setSidebarOpen(false) }}>
              <span className="topic-dot" style={{ background: topic.color }} />
              <span>{topic.name}</span>
              <span className="count">{topic.id === 'all' ? data.cards.length : data.cards.filter((c) => c.topicId === topic.id).length}</span>
            </button>
          ))}
        </nav>
        <button className="add-topic" onClick={() => { setBulkOpen(true); setSidebarOpen(false) }}><Upload size={15} /> Quick capture</button>
        <button className="add-topic" onClick={() => setTopicsOpen(true)}><Plus size={15} /> Add a space</button>

        <div className="clarity-card">
          <div className="clarity-heading">
            <span>Clarity</span><strong>{clarityScore}%</strong>
          </div>
          <div className="meter"><i style={{ width: `${clarityScore}%` }} /></div>
          <p>{data.cards.filter((c) => c.status === 'resolved').length} resolved · {data.cards.filter((c) => c.kind === 'question' && c.status === 'open').length} open questions</p>
        </div>

        <div className="privacy-note">
          <span>Private by default</span>
          <p>This map is saved only in this browser. Export a backup whenever you like.</p>
          <div>
            <button onClick={exportData}><Download size={14} /> Export</button>
            <label><Upload size={14} /> Import<input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></label>
          </div>
        </div>
      </aside>

      <section
        ref={viewportRef}
        className={linkStart ? 'canvas linking' : 'canvas'}
        onWheel={onWheel}
        onPointerDown={(event) => {
          if (event.target === viewportRef.current || (event.target as Element).classList.contains('world')) {
            setSelectedId(null)
            setSelectedEdge(null)
            panning.current = { sx: event.clientX, sy: event.clientY, cx: camera.x, cy: camera.y }
          }
        }}
      >
        <div className="map-title">
          <span className="topic-dot" style={{ background: activeTopic.color }} />
          <h1>{activeTopic.name}</h1>
          <span>{visibleCards.length} cards</span>
          <ChevronDown size={16} />
        </div>

        <div className="world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          <svg className="edges" width="1" height="1" overflow="visible">
            {visibleEdges.map((edge) => {
              const from = data.cards.find((c) => c.id === edge.from)!
              const to = data.cards.find((c) => c.id === edge.to)!
              const x1 = from.x + CARD_W / 2
              const y1 = from.y + CARD_H / 2
              const x2 = to.x + CARD_W / 2
              const y2 = to.y + CARD_H / 2
              const cx = (x1 + x2) / 2
              return (
                <path
                  key={edge.id}
                  className={selectedEdge === edge.id ? 'edge selected' : 'edge'}
                  d={`M ${x1} ${y1} Q ${cx} ${Math.min(y1, y2) - 24} ${x2} ${y2}`}
                  onPointerDown={(event) => { event.stopPropagation(); setSelectedEdge(edge.id); setSelectedId(null) }}
                />
              )
            })}
          </svg>
          {visibleCards.map((card) => {
            const topic = data.topics.find((t) => t.id === card.topicId)
            const meta = kindMeta[card.kind]
            return (
              <article
                key={card.id}
                className={`map-card ${card.kind} ${selectedId === card.id ? 'selected' : ''} ${linkStart === card.id ? 'link-source' : ''} ${card.status === 'rejected' ? 'rejected' : ''}`}
                style={{ transform: `translate(${card.x}px, ${card.y}px)`, '--kind-color': meta.color } as React.CSSProperties}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  chooseCard(card.id)
                  if (linkStart) return
                  const worldX = (event.clientX - camera.x) / camera.zoom
                  const worldY = (event.clientY - camera.y) / camera.zoom
                  dragging.current = { id: card.id, dx: worldX - card.x, dy: worldY - card.y }
                }}
              >
                <div className="card-topline">
                  <span className="kind-pill"><i>{meta.symbol}</i>{meta.label}</span>
                  <span className="card-menu">•••</span>
                </div>
                <h2>{card.title}</h2>
                <p>{card.body || 'Click to add what you know, wonder, or feel.'}</p>
                <footer>
                  <span className="tiny-dot" style={{ background: topic?.color }} />
                  {topic?.name}
                  {card.source && <span className="source-label">{card.source}</span>}
                  {card.confidence === 'hypothesis' && <span className="hypothesis">hypothesis</span>}
                  {card.status === 'resolved' && <span className="resolved"><Check size={11} /> resolved</span>}
                </footer>
              </article>
            )
          })}
        </div>

        {!visibleCards.length && (
          <div className="empty-state">
            <div><Sparkles size={24} /></div>
            <h2>There’s room to think here.</h2>
            <p>Add the first card, or quick-capture a messy pile of thoughts.</p>
            <button className="primary-button" onClick={() => addCard()}><Plus size={17} /> Add a card</button>
          </div>
        )}

        <div className="canvas-toolbar">
          <button className="active"><MousePointer2 size={17} /></button>
          <button onClick={startLink} className={linkStart ? 'active-link' : ''}><Link2 size={17} /></button>
          <span />
          <button onClick={fitView}><Focus size={17} /></button>
          <span className="zoom-label">{Math.round(camera.zoom * 100)}%</span>
        </div>

        <div className="legend">
          {(Object.keys(kindMeta) as CardKind[]).map((kind) => <span key={kind}><i style={{ background: kindMeta[kind].color }} />{kindMeta[kind].label}</span>)}
        </div>
      </section>

      {selected && (
        <Inspector card={selected} topics={data.topics.filter((t) => t.id !== 'all')} connections={data.connections} cards={data.cards} onChange={updateCard} onClose={() => setSelectedId(null)} onDelete={deleteCard} onLink={startLink} />
      )}

      {selectedEdge && (
        <div className="edge-popover">
          <span>Connection selected</span>
          <button onClick={removeEdge}><Unlink size={15} /> Disconnect</button>
          <button className="icon-button" onClick={() => setSelectedEdge(null)}><X size={15} /></button>
        </div>
      )}

      {bulkOpen && <BulkCapture topics={data.topics.filter((t) => t.id !== 'all')} onClose={() => setBulkOpen(false)} onAdd={(cards) => { setData((old) => ({ ...old, cards: [...old.cards, ...cards] })); setBulkOpen(false); notify(`${cards.length} cards added`) }} />}
      {topicsOpen && <NewTopic onClose={() => setTopicsOpen(false)} onAdd={(topic) => { setData((old) => ({ ...old, topics: [...old.topics, topic] })); setTopicId(topic.id); setTopicsOpen(false) }} />}
      {linkStart && <div className="link-hint"><Link2 size={15} /> Choose the card this connects to <button onClick={() => setLinkStart(null)}>Cancel</button></div>}
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  )
}

function Inspector({ card, topics, connections, cards, onChange, onClose, onDelete, onLink }: {
  card: ClarityCard
  topics: Topic[]
  connections: Connection[]
  cards: ClarityCard[]
  onChange: (patch: Partial<ClarityCard>) => void
  onClose: () => void
  onDelete: () => void
  onLink: () => void
}) {
  const linked = connections.filter((edge) => edge.from === card.id || edge.to === card.id).map((edge) => cards.find((c) => c.id === (edge.from === card.id ? edge.to : edge.from))).filter(Boolean) as ClarityCard[]
  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span>Edit card</span>
        <button className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="kind-switcher">
        {(Object.keys(kindMeta) as CardKind[]).map((kind) => <button key={kind} className={card.kind === kind ? 'active' : ''} onClick={() => onChange({ kind, confidence: kind === 'meaning' ? 'hypothesis' : card.confidence })}><i style={{ background: kindMeta[kind].color }}>{kindMeta[kind].symbol}</i>{kindMeta[kind].label}</button>)}
      </div>
      <label className="field-label">Title</label>
      <textarea className="title-input" value={card.title} onChange={(e) => onChange({ title: e.target.value })} rows={2} />
      <label className="field-label">What’s here?</label>
      <textarea className="body-input" value={card.body} onChange={(e) => onChange({ body: e.target.value })} placeholder="Write freely. This can change." rows={6} />
      <div className="two-fields">
        <label><span>Space</span><select value={card.topicId} onChange={(e) => onChange({ topicId: e.target.value })}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
        <label><span>Status</span><select value={card.status} onChange={(e) => onChange({ status: e.target.value as ClarityCard['status'] })}><option value="open">Open</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label>
      </div>
      <label className="field-label">How do we know this?</label>
      <select className="full-select" value={card.confidence} onChange={(e) => onChange({ confidence: e.target.value as Confidence })}>
        {(Object.keys(confidenceLabels) as Confidence[]).map((value) => <option key={value} value={value}>{confidenceLabels[value]}</option>)}
      </select>
      <label className="field-label">Source / whose perspective?</label>
      <input className="source-input" value={card.source ?? ''} onChange={(e) => onChange({ source: e.target.value })} placeholder="e.g. Cherry, direct message" />
      {card.confidence === 'hypothesis' && <p className="gentle-note">This is visibly marked as an interpretation—not a fact. It can be edited or rejected at any time.</p>}
      <div className="connections-list">
        <div><span>Connections</span><button onClick={onLink}><Plus size={14} /> Add</button></div>
        {linked.length ? linked.map((item) => <button key={item.id} className="connection-row"><i style={{ background: kindMeta[item.kind].color }} />{item.title}</button>) : <p>No connections yet.</p>}
      </div>
      <div className="inspector-footer">
        <button className="delete-button" onClick={onDelete}><Trash2 size={15} /> Delete</button>
        <span>Changes save automatically</span>
      </div>
    </aside>
  )
}

function BulkCapture({ topics, onClose, onAdd }: { topics: Topic[]; onClose: () => void; onAdd: (cards: ClarityCard[]) => void }) {
  const [text, setText] = useState('')
  const [topicId, setTopicId] = useState(topics[0]?.id ?? 'story')
  const [kind, setKind] = useState<CardKind>('knowledge')
  const add = () => {
    const chunks = text.split(/\n\s*\n|\n(?=[-•])/).map((item) => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
    const cols = Math.ceil(Math.sqrt(chunks.length))
    onAdd(chunks.map((chunk, index) => ({
      id: uid(),
      title: chunk.length > 68 ? `${chunk.slice(0, 65)}…` : chunk,
      body: chunk.length > 68 ? chunk : '',
      source: 'Quick capture',
      kind,
      confidence: kind === 'meaning' ? 'hypothesis' : 'first-hand',
      status: 'open',
      topicId,
      x: (index % cols) * 310 - cols * 140,
      y: Math.floor(index / cols) * 205 - 180,
      vx: 0,
      vy: 0,
      updatedAt: Date.now(),
    })))
  }
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <section className="modal bulk-modal" onPointerDown={(e) => e.stopPropagation()}>
        <button className="modal-close icon-button" onClick={onClose}><X size={19} /></button>
        <span className="modal-icon"><Upload size={20} /></span>
        <h2>Drop the whole mess here.</h2>
        <p>One paragraph or bullet becomes one card. Organize it later—capture it now.</p>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'I keep coming back to…\n\nWhat if I tried…\n\n- A question I can’t shake'} rows={10} />
        <div className="bulk-options">
          <label><span>Add to</span><select value={topicId} onChange={(e) => setTopicId(e.target.value)}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label><span>Start as</span><select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}><option value="knowledge">Knowledge</option><option value="question">Questions</option><option value="meaning">Meaning / hypothesis</option></select></label>
        </div>
        <button className="primary-button wide" disabled={!text.trim()} onClick={add}><Sparkles size={17} /> Turn into cards</button>
      </section>
    </div>
  )
}

function NewTopic({ onClose, onAdd }: { onClose: () => void; onAdd: (topic: Topic) => void }) {
  const [name, setName] = useState('')
  const colors = ['#dd765c', '#557b72', '#8e68aa', '#d49b3b', '#4d78a4']
  const [color, setColor] = useState(colors[0])
  return <div className="modal-backdrop" onPointerDown={onClose}><section className="modal small-modal" onPointerDown={(e) => e.stopPropagation()}><button className="modal-close icon-button" onClick={onClose}><X size={19} /></button><h2>Make a new space</h2><p>A space can hold a topic, chapter, relationship, or ongoing story.</p><input autoFocus className="topic-name-input" placeholder="e.g. School & direction" value={name} onChange={(e) => setName(e.target.value)} /><div className="color-row">{colors.map((item) => <button key={item} className={color === item ? 'color active' : 'color'} style={{ background: item }} onClick={() => setColor(item)} />)}</div><button className="primary-button wide" disabled={!name.trim()} onClick={() => onAdd({ id: uid(), name: name.trim(), color })}><Plus size={17} /> Create space</button></section></div>
}

export default App
