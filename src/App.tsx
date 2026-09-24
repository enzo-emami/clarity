import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Download,
  Focus,
  Link2,
  Menu,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlink,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { confidenceLabels, kindMeta, starterData } from './data'
import { upgradeBoard } from './expansion'
import type { BoardData, CardKind, ClarityCard, Confidence, Connection, Topic } from './types'

const STORAGE_KEY = 'clarity-board-v1'
const CARD_W = 250
const CARD_H = 144

const uid = () => Math.random().toString(36).slice(2, 10)

function loadBoard(): BoardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return upgradeBoard(saved ? JSON.parse(saved) : starterData)
  } catch {
    return upgradeBoard(starterData)
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dragging = useRef<{ id: string; dx: number; dy: number; lastX: number; lastY: number; time: number; vx: number; vy: number } | null>(null)
  const panning = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const cameraRef = useRef(camera)
  cameraRef.current = camera

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
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        if (selectedEdge) setSelectedEdge(null)
        if (linkStart) setLinkStart(null)
        if (bulkOpen) setBulkOpen(false)
        if (topicsOpen) setTopicsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, selectedEdge, linkStart, bulkOpen, topicsOpen])

  useEffect(() => {
    let frame = 0
    let running = true
    const tick = () => {
      if (!running) return
      const current = dataRef.current
      if (current.cards.some((card) => card.vx || card.vy)) {
        let moving = false
        const cards = current.cards.map((card) => ({ ...card }))

        cards.forEach((card) => {
          if (dragging.current?.id === card.id) {
            card.vx = 0
            card.vy = 0
            return
          }
          card.vx *= 0.65
          card.vy *= 0.65
          if (Math.hypot(card.vx, card.vy) < 0.01) { card.vx = 0; card.vy = 0 }
          card.x += card.vx
          card.y += card.vy
          moving = true
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
      const cam = cameraRef.current
      if (dragging.current) {
        if (!viewportRef.current) return
        const rect = viewportRef.current.getBoundingClientRect()
        const worldX = (event.clientX - rect.left - cam.x) / cam.zoom
        const worldY = (event.clientY - rect.top - cam.y) / cam.zoom
        const drag = dragging.current
        const elapsed = Math.max(1, performance.now() - drag.time)
        drag.vx = (event.clientX - drag.lastX) / elapsed
        drag.vy = (event.clientY - drag.lastY) / elapsed
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        drag.time = performance.now()
        const { id, dx, dy } = dragging.current
        setData((old) => ({
          ...old,
          cards: old.cards.map((card) =>
            card.id === id ? { ...card, x: worldX - dx, y: worldY - dy, vx: 0, vy: 0 } : card,
          ),
        }))
      } else if (panning.current) {
        const pan = panning.current
        setCamera((old) => ({
          ...old,
          x: pan.cx + event.clientX - pan.sx,
          y: pan.cy + event.clientY - pan.sy,
        }))
      }
    }

    const onUp = () => {
      const drag = dragging.current
      const cam = cameraRef.current
      if (drag) {
        const fresh = performance.now() - drag.time < 90
        const speed = Math.hypot(drag.vx, drag.vy)
        const scale = fresh ? Math.min(1, 0.8 / Math.max(speed, 0.001)) / cam.zoom : 0
        setData((old) => ({
          ...old,
          cards: old.cards.map((card) =>
            card.id === drag.id ? { ...card, vx: drag.vx * scale, vy: drag.vy * scale } : card,
          ),
        }))
      }
      dragging.current = null
      panning.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  const addCard = (kind: CardKind = 'knowledge') => {
    const id = uid()
    const cam = cameraRef.current
    const next: ClarityCard = {
      id,
      title: kind === 'question' ? 'A question worth exploring' : kind === 'meaning' ? 'What might this mean?' : 'Untitled thought',
      body: '',
      source: 'Added in Clarity',
      kind,
      confidence: kind === 'meaning' ? 'hypothesis' : 'first-hand',
      status: 'open',
      topicId: topicId === 'all' ? 'story' : topicId,
      x: (innerWidth / 2 - cam.x) / cam.zoom - CARD_W / 2 + (Math.random() - 0.5) * 80,
      y: (innerHeight / 2 - cam.y) / cam.zoom - CARD_H / 2 + (Math.random() - 0.5) * 80,
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
    notify('Now click a card to connect')
  }

  const removeEdge = () => {
    if (!selectedEdge) return
    setData((old) => ({ ...old, connections: old.connections.filter((edge) => edge.id !== selectedEdge) }))
    setSelectedEdge(null)
    notify('Connection removed')
  }

  const disconnectCards = (fromId: string, toId: string) => {
    setData((old) => ({
      ...old,
      connections: old.connections.filter(
        (edge) => !((edge.from === fromId && edge.to === toId) || (edge.from === toId && edge.to === fromId)),
      ),
    }))
    notify('Connection removed')
  }

  const fitView = useCallback(() => {
    const cards = dataRef.current.cards.filter((card) => (topicId === 'all' || card.topicId === topicId) && `${card.title} ${card.body}`.toLowerCase().includes(query.toLowerCase().trim()))
    if (!cards.length || !viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    const minX = Math.min(...cards.map((c) => c.x))
    const maxX = Math.max(...cards.map((c) => c.x + CARD_W))
    const minY = Math.min(...cards.map((c) => c.y))
    const maxY = Math.max(...cards.map((c) => c.y + CARD_H))
    const width = maxX - minX + 180
    const height = maxY - minY + 180
    const zoom = Math.min(1.15, Math.max(0.06, Math.min(rect.width / width, (rect.height - 120) / height)))
    setCamera({
      zoom,
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    })
  }, [topicId, query])

  useEffect(() => { fitView() }, [fitView])

  const zoomIn = () => {
    setCamera((cam) => ({ ...cam, zoom: Math.min(2.0, Number((cam.zoom * 1.25).toFixed(2))) }))
  }

  const zoomOut = () => {
    setCamera((cam) => ({ ...cam, zoom: Math.max(0.1, Number((cam.zoom / 1.25).toFixed(2))) }))
  }

  const resetZoom = () => {
    setCamera((cam) => ({ ...cam, zoom: 1 }))
  }

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
    const zoom = Math.min(1.8, Math.max(0.06, camera.zoom * scale))
    const rect = viewportRef.current!.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const wx = (px - camera.x) / camera.zoom
    const wy = (py - camera.y) / camera.zoom
    setCamera({ x: px - wx * zoom, y: py - wy * zoom, zoom })
  }

  return (
    <main className={`app-shell ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <span>clarity</span>
          <span className="saved"><Check size={13} /> saved here</span>
        </div>
        <div className="searchbox">
          <Search size={16} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a thought…"
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={() => setBulkOpen(true)}>
            <Upload size={16} /> Quick capture
          </button>
          <button className="primary-button" onClick={() => addCard()}>
            <Plus size={17} /> New card
          </button>
          <button
            className={`icon-button ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen((open) => !open)}
            title={sidebarOpen ? 'Hide spaces sidebar' : 'Show spaces sidebar'}
            aria-label="Toggle spaces sidebar"
          >
            <Menu size={19} />
          </button>
        </div>
      </header>

      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <p className="eyebrow">Your map</p>
        <nav className="topics">
          {data.topics.map((topic) => (
            <button
              key={topic.id}
              className={topicId === topic.id ? 'topic active' : 'topic'}
              onClick={() => { setTopicId(topic.id) }}
            >
              <span className="topic-dot" style={{ background: topic.color }} />
              <span>{topic.name}</span>
              <span className="count">
                {topic.id === 'all' ? data.cards.length : data.cards.filter((c) => c.topicId === topic.id).length}
              </span>
            </button>
          ))}
        </nav>
        <button className="add-topic" onClick={() => setTopicsOpen(true)}>
          <Plus size={15} /> Add a space
        </button>

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
            <button onClick={exportData} title="Export board to JSON file"><Download size={14} /> Export</button>
            <label title="Import board from JSON file"><Upload size={14} /> Import<input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></label>
          </div>
        </div>
      </aside>

      <section
        ref={viewportRef}
        className={linkStart ? 'canvas linking' : 'canvas'}
        onWheel={onWheel}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement
          if (
            target.closest(
              '.map-card, button, a, input, select, textarea, .canvas-toolbar, .map-title, .modal, .inspector, .edge-popover, .link-hint, .toast, .edge',
            )
          ) {
            return
          }
          event.preventDefault()
          window.getSelection()?.removeAllRanges()
          setSelectedId(null)
          setSelectedEdge(null)
          panning.current = {
            sx: event.clientX,
            sy: event.clientY,
            cx: cameraRef.current.x,
            cy: cameraRef.current.y,
          }
        }}
      >
        <div className="map-title">
          <span className="topic-dot" style={{ background: activeTopic.color }} />
          <h1>{activeTopic.name}</h1>
          <span className="card-count-badge">{visibleCards.length} cards</span>
        </div>

        <div className="world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {data.topics.filter((topic) => topic.id !== 'all' && (topicId === 'all' || topicId === topic.id)).map((topic) => {
            const cards = visibleCards.filter((card) => card.topicId === topic.id)
            if (!cards.length) return null
            return <div key={topic.id} className="space-heading" style={{ position: 'absolute', left: Math.min(...cards.map((card) => card.x)), top: Math.min(...cards.map((card) => card.y)) - 55, color: topic.color, fontSize: 24, fontWeight: 700, pointerEvents: 'none' }}>{topic.name}</div>
          })}
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
                  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
                  chooseCard(card.id)
                  if (linkStart) return
                  event.stopPropagation()
                  const rect = viewportRef.current!.getBoundingClientRect()
                  const cam = cameraRef.current
                  const worldX = (event.clientX - rect.left - cam.x) / cam.zoom
                  const worldY = (event.clientY - rect.top - cam.y) / cam.zoom
                  dragging.current = {
                    id: card.id,
                    dx: worldX - card.x,
                    dy: worldY - card.y,
                    lastX: event.clientX,
                    lastY: event.clientY,
                    time: performance.now(),
                    vx: 0,
                    vy: 0,
                  }
                }}
              >
                <div className="card-topline">
                  <span className="kind-pill"><i>{meta.symbol}</i>{meta.label}</span>
                </div>
                <h2>{card.title}</h2>
                <p>{card.body || 'Click to view and edit details…'}</p>
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
          <button onClick={zoomOut} title="Zoom out" aria-label="Zoom out"><ZoomOut size={16} /></button>
          <button className="zoom-btn" onClick={resetZoom} title="Reset zoom to 100%">{Math.round(camera.zoom * 100)}%</button>
          <button onClick={zoomIn} title="Zoom in" aria-label="Zoom in"><ZoomIn size={16} /></button>
          <span className="toolbar-divider" />
          <button onClick={fitView} title="Fit all cards in view" aria-label="Fit map"><Focus size={16} /></button>
          <span className="toolbar-divider" />
          <button
            onClick={startLink}
            className={linkStart ? 'active-link' : ''}
            title={linkStart ? 'Cancel connecting cards' : 'Connect cards'}
            aria-label="Connect cards"
          >
            <Link2 size={16} />
          </button>
        </div>

        <div className="legend">
          {(Object.keys(kindMeta) as CardKind[]).map((kind) => <span key={kind}><i style={{ background: kindMeta[kind].color }} />{kindMeta[kind].label}</span>)}
        </div>
      </section>

      {selected && (
        <Inspector
          card={selected}
          topics={data.topics.filter((t) => t.id !== 'all')}
          connections={data.connections}
          cards={data.cards}
          onChange={updateCard}
          onClose={() => setSelectedId(null)}
          onDelete={deleteCard}
          onLink={startLink}
          onSelectCard={(id) => setSelectedId(id)}
          onDisconnect={(targetId) => disconnectCards(selected.id, targetId)}
        />
      )}

      {selectedEdge && (
        <div className="edge-popover">
          <span>Connection selected</span>
          <button onClick={removeEdge}><Unlink size={15} /> Disconnect</button>
          <button className="icon-button" onClick={() => setSelectedEdge(null)}><X size={15} /></button>
        </div>
      )}

      {bulkOpen && (
        <BulkCapture
          topics={data.topics.filter((t) => t.id !== 'all')}
          onClose={() => setBulkOpen(false)}
          onAdd={(cards) => {
            setData((old) => ({ ...old, cards: [...old.cards, ...cards] }))
            setBulkOpen(false)
            notify(`${cards.length} cards added`)
          }}
        />
      )}
      {topicsOpen && (
        <NewTopic
          onClose={() => setTopicsOpen(false)}
          onAdd={(topic) => {
            setData((old) => ({ ...old, topics: [...old.topics, topic] }))
            setTopicId(topic.id)
            setTopicsOpen(false)
          }}
        />
      )}
      {linkStart && (
        <div className="link-hint">
          <Link2 size={15} /> Click another card to connect <button onClick={() => setLinkStart(null)}>Cancel</button>
        </div>
      )}
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  )
}

function Inspector({
  card,
  topics,
  connections,
  cards,
  onChange,
  onClose,
  onDelete,
  onLink,
  onSelectCard,
  onDisconnect,
}: {
  card: ClarityCard
  topics: Topic[]
  connections: Connection[]
  cards: ClarityCard[]
  onChange: (patch: Partial<ClarityCard>) => void
  onClose: () => void
  onDelete: () => void
  onLink: () => void
  onSelectCard: (id: string) => void
  onDisconnect: (id: string) => void
}) {
  const linked = connections
    .filter((edge) => edge.from === card.id || edge.to === card.id)
    .map((edge) => cards.find((c) => c.id === (edge.from === card.id ? edge.to : edge.from)))
    .filter(Boolean) as ClarityCard[]

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div className="inspector-badge">
          <i style={{ background: kindMeta[card.kind].color }}>{kindMeta[card.kind].symbol}</i>
          <span>{kindMeta[card.kind].label}</span>
        </div>
        <div className="inspector-header-actions">
          <button className="icon-button close-btn" onClick={onClose} title="Close inspector (Esc)" aria-label="Close inspector">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="inspector-scroll-area">
        <div className="kind-switcher">
          {(Object.keys(kindMeta) as CardKind[]).map((kind) => (
            <button
              key={kind}
              className={card.kind === kind ? 'active' : ''}
              onClick={() => onChange({ kind, confidence: kind === 'meaning' ? 'hypothesis' : card.confidence })}
            >
              <i style={{ background: kindMeta[kind].color }}>{kindMeta[kind].symbol}</i>
              <span>{kindMeta[kind].label}</span>
            </button>
          ))}
        </div>

        <label className="field-label">Title</label>
        <textarea
          className="title-input"
          value={card.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title of this thought…"
          rows={2}
        />

        <label className="field-label">Thought & Context</label>
        <textarea
          className="body-input"
          value={card.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Write freely. What do you know, wonder, or feel about this?"
          rows={7}
        />

        <div className="two-fields">
          <label>
            <span>Space</span>
            <select value={card.topicId} onChange={(e) => onChange({ topicId: e.target.value })}>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={card.status}
              onChange={(e) => onChange({ status: e.target.value as ClarityCard['status'] })}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>

        <div className="field-group">
          <label className="field-label">How do we know this?</label>
          <select
            className="full-select"
            value={card.confidence}
            onChange={(e) => onChange({ confidence: e.target.value as Confidence })}
          >
            {(Object.keys(confidenceLabels) as Confidence[]).map((value) => (
              <option key={value} value={value}>
                {confidenceLabels[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">Source / Whose perspective?</label>
          <input
            className="source-input"
            value={card.source ?? ''}
            onChange={(e) => onChange({ source: e.target.value })}
            placeholder="e.g. Conversation, note, reading"
          />
        </div>

        {card.confidence === 'hypothesis' && (
          <div className="gentle-note">
            <strong>Interpretation / Hypothesis:</strong> This is visibly marked as an interpretation rather than an established fact. It can be freely edited, tested, or rejected.
          </div>
        )}

        <div className="connections-list">
          <div className="connections-header">
            <span>Connected cards ({linked.length})</span>
            <button className="connect-add-btn" onClick={onLink} title="Connect another card to this one">
              <Plus size={15} /> Connect card
            </button>
          </div>
          {linked.length ? (
            <div className="connection-cards-grid">
              {linked.map((item) => (
                <div key={item.id} className="connection-row-card">
                  <button
                    className="connection-link-btn"
                    onClick={() => onSelectCard(item.id)}
                    title={`Open "${item.title}"`}
                  >
                    <i style={{ background: kindMeta[item.kind].color }}>{kindMeta[item.kind].symbol}</i>
                    <span className="connection-title">{item.title}</span>
                  </button>
                  <button
                    className="connection-unlink-btn"
                    onClick={() => onDisconnect(item.id)}
                    title="Disconnect this card"
                    aria-label={`Disconnect ${item.title}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-connections-text">No connections yet. Connect related questions, facts, or meanings.</p>
          )}
        </div>
      </div>

      <div className="inspector-footer">
        <button className="delete-button" onClick={onDelete} title="Delete this card">
          <Trash2 size={16} /> Delete card
        </button>
        <span className="save-status"><Check size={13} /> Auto-saved</span>
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
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close modal"><X size={19} /></button>
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
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <section className="modal small-modal" onPointerDown={(e) => e.stopPropagation()}>
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close modal"><X size={19} /></button>
        <h2>Make a new space</h2>
        <p>A space can hold a topic, chapter, relationship, or ongoing story.</p>
        <input autoFocus className="topic-name-input" placeholder="e.g. School & direction" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="color-row">{colors.map((item) => <button key={item} className={color === item ? 'color active' : 'color'} style={{ background: item }} onClick={() => setColor(item)} aria-label="Select color" />)}</div>
        <button className="primary-button wide" disabled={!name.trim()} onClick={() => onAdd({ id: uid(), name: name.trim(), color })}><Plus size={17} /> Create space</button>
      </section>
    </div>
  )
}

export default App
