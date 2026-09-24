import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Download,
  Focus,
  FolderPlus,
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
  Loader2,
} from 'lucide-react'
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { confidenceLabels, kindMeta, starterData } from './data'
import { ErrorBoundary } from './ErrorBoundary'
import type { BoardData, CardKind, ClarityCard, Confidence, Connection, Topic } from './types'

const TUTORIAL_KEY = 'clarity_tutorial_done_v1'
const CARD_W = 250
const CARD_H = 144

const uid = () => Math.random().toString(36).slice(2, 10)

const safeStorage = {
  get: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null
    } catch {
      return null
    }
  },
  set: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
    } catch {
      // ignore
    }
  }
}

function AppContent() {
  const data = useQuery(api.board.getBoardData);
  const updateCardMutation = useMutation(api.board.updateCard);
  const upsertCardMutation = useMutation(api.board.upsertCard);
  const deleteCardMutation = useMutation(api.board.deleteCard);
  const addConnectionMutation = useMutation(api.board.addConnection);
  const removeConnectionMutation = useMutation(api.board.removeConnection);
  const disconnectCardsMutation = useMutation(api.board.disconnectCards);
  const upsertTopicMutation = useMutation(api.board.upsertTopic);
  const updateTopicMutation = useMutation(api.board.updateTopic);
  const deleteTopicMutation = useMutation(api.board.deleteTopic);
  const seedBoardMutation = useMutation(api.board.seedBoard);

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [topicId, setTopicId] = useState('all')
  const [query, setQuery] = useState('')
  const [camera, setCamera] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 - 86 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    zoom: 0.48
  })
  const [linkStart, setLinkStart] = useState<string | null>(null)
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [tempTopicName, setTempTopicName] = useState('')
  const [canvasMenu, setCanvasMenu] = useState<{ clientX: number; clientY: number; worldX: number; worldY: number } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [inTutorial, setInTutorial] = useState(() => {
    const done = safeStorage.get(TUTORIAL_KEY)
    return done === 'true' ? false : false
  })

  const viewportRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cardClickRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null)
  const dragging = useRef<{ id: string; dx: number; dy: number; lastX: number; lastY: number; time: number; vx: number; vy: number } | null>(null)
  const panning = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)

  const dataRef = useRef<BoardData | undefined>(undefined)

  const cameraRef = useRef(camera)
  cameraRef.current = camera

  const isCardKind = (value: string): value is CardKind =>
    value === 'knowledge' ||
    value === 'question' ||
    value === 'meaning'

  const board: BoardData = useMemo(() => {
    if (!data) return starterData
    return {
      cards: (data.cards || []).map((card) => ({
        ...card,
        kind: isCardKind(card.kind) ? card.kind : 'knowledge',
        confidence: card.confidence as Confidence,
        status: card.status as ClarityCard['status'],
        vx: card.vx ?? 0,
        vy: card.vy ?? 0,
      })),
      topics: (data.topics || []).map((topic) => ({
        ...topic,
        x: topic.x ?? 0,
        y: topic.y ?? 0,
      })),
      connections: data.connections || [],
    }
  }, [data])

  useEffect(() => {
    dataRef.current = board
  }, [board])

  useEffect(() => {
    if (data && data.cards.length === 0 && data.topics.length === 0) {
      seedBoardMutation({ data: starterData });
    }
  }, [data, seedBoardMutation]);

  const visibleCards = useMemo(() => {
    if (inTutorial) {
      return board.cards.filter((c) => c.id.startsWith('tutorial-'))
    }
    const q = query.toLowerCase().trim()
    return board.cards
      .filter((card) => topicId === 'all' || card.topicId === topicId)
      .filter((card) => !q || `${card.title} ${card.body}`.toLowerCase().includes(q))
  }, [board.cards, inTutorial, query, topicId])

  const visibleIds = useMemo(() => new Set(visibleCards.map((c) => c.id)), [visibleCards])

  const visibleEdges = useMemo(() => {
    if (inTutorial) return []
    return board.connections.filter(
      (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
    )
  }, [board.connections, inTutorial, visibleIds])

  const selected = useMemo(() => board.cards.find((card) => card.id === selectedId) ?? null, [board.cards, selectedId])
  const activeTopic = useMemo(() => {
    return board.topics.find((topic) => topic.id === topicId) ?? board.topics[0] ?? { id: 'all', name: 'All threads', color: '#2c3834' }
  }, [board.topics, topicId])

  const connectedCards = useMemo(() => new Set(board.connections.flatMap((edge) => [edge.from, edge.to])).size, [board.connections])
  const openQuestions = useMemo(() => board.cards.filter((card) => card.kind === 'question').length, [board.cards])
  const resolvedQuestions = useMemo(() => board.cards.filter((card) => card.kind === 'question' && card.status === 'resolved').length, [board.cards])
  const clarityScore = useMemo(() => Math.round(
    10 + (connectedCards / Math.max(1, board.cards.length)) * 45 + (resolvedQuestions / Math.max(1, openQuestions)) * 45,
  ), [connectedCards, board.cards.length, resolvedQuestions, openQuestions])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (canvasMenu) setCanvasMenu(null)
        if (editingTopic) setEditingTopic(null)
        if (editingTitle) setEditingTitle(false)
        if (linkStart) {
          setLinkStart(null)
          setMouseWorld(null)
        }
        if (selectedId) setSelectedId(null)
        if (selectedEdge) setSelectedEdge(null)
        if (bulkOpen) setBulkOpen(false)
        if (topicsOpen) setTopicsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canvasMenu, editingTopic, editingTitle, selectedId, selectedEdge, linkStart, bulkOpen, topicsOpen])

  useEffect(() => {
    let frame = 0
    let running = true
    const tick = () => {
      if (!running) return
      const current = dataRef.current
      if (!current) return;
      if (current.cards.some((card) => card.vx || card.vy)) {
        const cards = current.cards.map((card) => ({ ...card }))
        cards.forEach((card) => {
          if (dragging.current?.id === card.id) {
            card.vx = 0
            card.vy = 0
            return
          }
          card.vx = (card.vx ?? 0) * 0.65
          card.vy = (card.vy ?? 0) * 0.65
          if (Math.hypot(card.vx, card.vy) < 0.01) { card.vx = 0; card.vy = 0 }
          card.x += card.vx
          card.y += card.vy
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [])

  const centerCardInView = useCallback((cardId: string) => {
    const c = dataRef.current?.cards.find((item) => item.id === cardId)
    if (!c || !viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    const isDesktop = window.innerWidth > 900
    const inspectorWidth = isDesktop ? Math.min(760, rect.width * 0.54) : 0
    const availWidth = rect.width - inspectorWidth
    const targetCenterX = availWidth / 2
    const targetCenterY = rect.height / 2
    const currentZoom = cameraRef.current.zoom
    const cardMidX = c.x + CARD_W / 2
    const cardMidY = c.y + CARD_H / 2
    setCamera((cam) => ({
      ...cam,
      x: targetCenterX - cardMidX * currentZoom,
      y: targetCenterY - cardMidY * currentZoom,
    }))
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const cam = cameraRef.current
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect()
        setMouseWorld({
          x: (event.clientX - rect.left - cam.x) / cam.zoom,
          y: (event.clientY - rect.top - cam.y) / cam.zoom,
        })
      }
      if (dragging.current) {
        if (!viewportRef.current) return
        const rect = viewportRef.current.getBoundingClientRect()
        const worldX = (event.clientX - rect.left - cam.x) / cam.zoom
        const worldY = (event.clientY - rect.top - cam.y) / cam.zoom
        if (cardClickRef.current) {
          const dist = Math.hypot(event.clientX - cardClickRef.current.startX, event.clientY - cardClickRef.current.startY)
          if (dist > 5) {
            cardClickRef.current.moved = true
          }
        }
        const drag = dragging.current
        const elapsed = Math.max(1, performance.now() - drag.time)
        drag.vx = (event.clientX - drag.lastX) / elapsed
        drag.vy = (event.clientY - drag.lastY) / elapsed
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        drag.time = performance.now()
        const { id, dx, dy } = dragging.current
        updateCardMutation({ id, updates: { x: worldX - dx, y: worldY - dy, vx: 0, vy: 0 } });
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
        updateCardMutation({
          id: drag.id,
          updates: { vx: drag.vx * scale, vy: drag.vy * scale }
        });
      }
      if (cardClickRef.current) {
        if (!cardClickRef.current.moved) {
          const targetId = cardClickRef.current.id
          setSelectedId(targetId)
          setSelectedEdge(null)
          centerCardInView(targetId)
        }
        cardClickRef.current = null
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
  }, [centerCardInView, updateCardMutation])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2400)
  }

  const runMutation = async <T extends any[], R>(
    mutationFn: (...args: T) => Promise<R>,
    args: T
  ) => {
    setIsSaving(true)
    try {
      return await mutationFn(...args)
    } finally {
      setIsSaving(false)
    }
  }

  const addCardAt = (kind: CardKind = 'knowledge', posX?: number, posY?: number) => {
    const id = uid()
    const cam = cameraRef.current
    const targetX = posX !== undefined ? posX : (innerWidth / 2 - cam.x) / cam.zoom - CARD_W / 2 + (Math.random() - 0.5) * 80
    const targetY = posY !== undefined ? posY : (innerHeight / 2 - cam.y) / cam.zoom - CARD_H / 2 + (Math.random() - 0.5) * 80
    const next: ClarityCard = {
      id,
      title: kind === 'question' ? 'A question worth exploring' : kind === 'meaning' ? 'What might this mean?' : 'Untitled thought',
      body: '',
      source: 'Added in Clarity',
      kind,
      confidence: kind === 'meaning' ? 'hypothesis' : 'first-hand',
      status: 'open',
      topicId: topicId === 'all' ? 'story' : topicId,
      x: targetX,
      y: targetY,
      vx: 0,
      vy: 0,
      updatedAt: Date.now(),
    }
    runMutation(upsertCardMutation, [{ id, card: next }]);
    setSelectedId(id)
    setSelectedEdge(null)
    setCanvasMenu(null)
    setTimeout(() => centerCardInView(id), 50)
  }

  const addTutorialCard = (worldX: number, worldY: number) => {
    const id = `tutorial-${uid()}`
    const newCard: ClarityCard = {
      id,
      title: 'I think I need some clarity',
      body: "You take very extensive notes about your life, spend some time organizing them more precisely here. We can take every detail and map out what's in our minds. Ready?",
      source: 'Welcome to Clarity',
      kind: 'knowledge',
      confidence: 'first-hand',
      status: 'open',
      topicId: 'story',
      x: worldX - CARD_W / 2,
      y: worldY - CARD_H / 2,
      vx: 0,
      vy: 0,
      updatedAt: Date.now(),
    }
    runMutation(upsertCardMutation, [{ id, card: newCard }]);
    setSelectedId(id)
    setCanvasMenu(null)
    setTimeout(() => centerCardInView(id), 50)
  }

  const finishTutorial = () => {
    safeStorage.set(TUTORIAL_KEY, 'true')
    setInTutorial(false)
    notify('Welcome to Clarity')
  }

  const addThreadAt = (worldX: number, worldY: number) => {
    const newTopic: Topic = {
      id: uid(),
      name: 'New space',
      color: '#557b72',
      x: worldX,
      y: worldY,
    }
    runMutation(upsertTopicMutation, [{ id: newTopic.id, topic: newTopic }])
    notify('New space created')
    setCanvasMenu(null)
  }

  const updateCard = (patch: Partial<ClarityCard>) => {
    if (!selectedId) return
    runMutation(updateCardMutation, [{ id: selectedId, updates: { ...patch, updatedAt: Date.now() } }]);
  }

  const deleteCard = () => {
    if (!selectedId) return
    runMutation(deleteCardMutation, [{ id: selectedId }])
    setSelectedId(null)
    notify('Card deleted')
  }

  const startLink = () => {
    if (!selectedId) return notify('Choose a card first')
    setLinkStart(selectedId)
    setSelectedId(null)
    notify('Wire mode: click another card or thread to connect')
  }

  const removeEdge = () => {
    if (!selectedEdge) return
    runMutation(removeConnectionMutation, [{ id: selectedEdge }]);
    setSelectedEdge(null)
    notify('Connection removed')
  }

  const disconnectCards = (fromId: string, toId: string) => {
    runMutation(disconnectCardsMutation, [{ from: fromId, to: toId }])
    notify('Cards disconnected')
  }

  const saveTopicTitle = () => {
    const trimmed = tempTopicName.trim()
    if (trimmed && trimmed !== activeTopic.name) {
      runMutation(updateTopicMutation, [{ id: activeTopic.id, updates: { name: trimmed } }])
      notify('Space renamed')
    }
    setEditingTitle(false)
  }

  const updateTopic = (targetTopicId: string, patch: { name: string; color: string }) => {
    runMutation(updateTopicMutation, [{ id: targetTopicId, updates: patch }])
    notify('Space updated')
    setEditingTopic(null)
  }

  const deleteTopic = (targetTopicId: string) => {
    if (targetTopicId === 'all') return
    runMutation(deleteTopicMutation, [{ id: targetTopicId }])
    if (topicId === targetTopicId) setTopicId('all')
    setEditingTopic(null)
    notify('Space removed')
  }

  const fitView = useCallback(() => {
    const cards = dataRef.current?.cards.filter((card) => (topicId === 'all' || card.topicId === topicId) && `${card.title} ${card.body}`.toLowerCase().includes(query.toLowerCase().trim()))
    if (!cards || !cards.length || !viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    const minX = Math.min(...cards.map((c) => c.x))
    const maxX = Math.max(...cards.map((c) => c.x + CARD_W))
    const minY = Math.min(...cards.map((c) => c.y))
    const maxY = Math.max(...cards.map((c) => c.y + CARD_H))
    const width = Math.max(1, maxX - minX + 180)
    const height = Math.max(1, maxY - minY + 180)
    const zoom = Math.min(1.15, Math.max(0.06, Math.min(rect.width / width, Math.max(50, rect.height - 120) / height)))
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
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' })
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
        runMutation(seedBoardMutation, [{ data: next }]);
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

  if (data === undefined) {
    return (
      <div className="app-shell loading">
        <div className="loading-screen">
          <Sparkles className="animate-spin" />
          <p>Synchronizing your map...</p>
        </div>
      </div>
    );
  }

  return (
    <main className={`app-shell ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <span>clarity</span>
          <span className="saved">
            {isSaving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check size={13} /> synced to cloud
              </>
            )}
          </span>
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
          <button className="primary-button" onClick={() => addCardAt()}>
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
          {board.topics.map((topic) => (
            <button
              key={topic.id}
              className={topicId === topic.id ? 'topic active' : 'topic'}
              onClick={() => setTopicId(topic.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setEditingTopic(topic)
              }}
              title="Click to view space • Right-click to edit name & color"
            >
              <span className="topic-dot" style={{ background: topic.color }} />
              <span>{topic.name}</span>
              <span className="count">
                {topic.id === 'all' ? board.cards.length : board.cards.filter((c) => c.topicId === topic.id).length}
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
          <p>{board.cards.filter((c) => c.status === 'resolved').length} resolved · {board.cards.filter((c) => c.kind === 'question' && c.status === 'open').length} open questions</p>
        </div>

        <div className="privacy-note">
          <span>Shared Workspace</span>
          <p>This map is synced in real-time. Changes are seen by all users.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={exportData} title="Export board to JSON file"><Download size={14} /> Export</button>
            <label title="Import board from JSON file"><Upload size={14} /> Import<input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} style={{ display: 'none' }} /></label>
          </div>
        </div>
      </aside>

      <section
        ref={viewportRef}
        className={linkStart ? 'canvas linking' : 'canvas'}
        onWheel={onWheel}
        onPointerDown={(event) => {
          setCanvasMenu(null)
          const target = event.target as HTMLElement
          if (
            target.closest(
              '.map-card, button, a, input, select, textarea, .canvas-toolbar, .map-title, .modal, .inspector, .edge-popover, .link-hint, .toast, .edge, .canvas-context-menu, .floating-thread',
            )
          ) {
            return
          }
          if (event.button === 0) {
            setSelectedId(null)
            setSelectedEdge(null)
            panning.current = {
              sx: event.clientX,
              sy: event.clientY,
              cx: camera.x,
              cy: camera.y,
            }
          }
        }}
        onContextMenu={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('.map-card, button, a, input, select, textarea, .modal, .inspector, .canvas-toolbar, .floating-thread')) return
          event.preventDefault()
          const rect = viewportRef.current!.getBoundingClientRect()
          setCanvasMenu({
            clientX: event.clientX,
            clientY: event.clientY,
            worldX: (event.clientX - rect.left - camera.x) / camera.zoom,
            worldY: (event.clientY - rect.top - camera.y) / camera.zoom,
          })
        }}
      >
        <div className="canvas-toolbar">
          <button className="icon-button" onClick={zoomIn} title="Zoom in" aria-label="Zoom in"><ZoomIn size={18} /></button>
          <button className="icon-button" onClick={zoomOut} title="Zoom out" aria-label="Zoom out"><ZoomOut size={18} /></button>
          <button className="icon-button" onClick={resetZoom} title="Reset zoom (100%)" aria-label="Reset zoom">1:1</button>
          <button className="icon-button" onClick={fitView} title="Fit all cards in view" aria-label="Fit all cards in view"><Focus size={18} /></button>
        </div>

        <div className="map-title">
          {editingTitle ? (
            <input
              autoFocus
              className="space-title-input"
              value={tempTopicName}
              onChange={(e) => setTempTopicName(e.target.value)}
              onBlur={saveTopicTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTopicTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
            />
          ) : (
            <h1
              onClick={() => {
                if (activeTopic.id !== 'all') {
                  setTempTopicName(activeTopic.name)
                  setEditingTitle(true)
                }
              }}
              title={activeTopic.id !== 'all' ? 'Click to rename this space' : undefined}
            >
              {activeTopic.name}
            </h1>
          )}
          <span className="card-count-badge">{visibleCards.length} cards</span>
        </div>

        {inTutorial && !visibleCards.length && (
          <div className="tutorial-prompt">
            <div className="tutorial-prompt-icon"><Sparkles size={28} /></div>
            <h3>Organize your thoughts</h3>
            <p>Right-click or double-click anywhere to place your first thought.</p>
          </div>
        )}

        <div className="world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {!inTutorial &&
            board.topics
              .filter((topic) => topic.id !== 'all' && (topicId === 'all' || topicId === topic.id))
              .map((topic) => {
                const cards = board.cards.filter((c) => c.topicId === topic.id)
                if (!cards.length && topic.x === undefined) return null

                let posX = topic.x ?? 0
                let posY = topic.y ?? 0

                if (topic.x === undefined && cards.length) {
                  posX = Math.min(...cards.map((c) => c.x))
                  posY = Math.min(...cards.map((c) => c.y)) - 55
                }

                return (
                  <div
                    key={topic.id}
                    className={`floating-thread ${linkStart ? 'wire-target' : ''}`}
                    style={{
                      position: 'absolute',
                      left: posX,
                      top: posY,
                      color: topic.color,
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setEditingTopic(topic)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (linkStart) {
                        runMutation(updateCardMutation, [{ id: linkStart, updates: { topicId: topic.id, updatedAt: Date.now() } }])
                        notify(`Assigned card to "${topic.name}"`)
                        setLinkStart(null)
                        setMouseWorld(null)
                      } else {
                        setTopicId(topic.id)
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingTopic(topic)
                    }}
                    title={linkStart ? `Connect card to "${topic.name}" space` : `Space: ${topic.name} (Right-click to edit)`}
                  >
                    <span className="topic-dot" style={{ background: topic.color }} />
                    <span>{topic.name}</span>
                    {linkStart && <span className="thread-connect-hint">+ Drop into thread</span>}
                  </div>
                )
              })}

          <svg className="edges" width="1" height="1" overflow="visible">
            {visibleEdges.map((edge) => {
              const from = board.cards.find((c) => c.id === edge.from)
              const to = board.cards.find((c) => c.id === edge.to)
              if (!from || !to) return null
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

            {linkStart && mouseWorld && (() => {
              const src = board.cards.find((c) => c.id === linkStart)
              if (!src) return null
              const x1 = src.x + CARD_W / 2
              const y1 = src.y + CARD_H / 2
              const x2 = mouseWorld.x
              const y2 = mouseWorld.y
              const cx = (x1 + x2) / 2
              return (
                <g className="live-wire-layer">
                  <path
                    className="edge live-wire"
                    d={`M ${x1} ${y1} Q ${cx} ${Math.min(y1, y2) - 30} ${x2} ${y2}`}
                  />
                  <circle cx={x2} cy={y2} r={6} className="wire-lead-dot" />
                </g>
              )
            })()}
          </svg>

          {visibleCards.map((card) => {
            const isSelected = selectedId === card.id
            const topic = board.topics.find((t) => t.id === card.topicId)
            const meta = kindMeta[card.kind] ?? kindMeta.knowledge
            return (
              <article
                key={card.id}
                className={`map-card ${isSelected ? 'selected' : ''} ${linkStart && linkStart !== card.id ? 'wire-target' : ''}`}
                style={{
                  transform: `translate(${card.x}px, ${card.y}px)`,
                  width: CARD_W,
                }}
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest('button, select, input, textarea, a')) return
                  event.stopPropagation()
                  if (linkStart) {
                    if (linkStart !== card.id) {
                      if (!board.connections.some((e) => (e.from === linkStart && e.to === card.id) || (e.from === card.id && e.to === linkStart))) {
                        runMutation(addConnectionMutation, [{ connection: { id: uid(), from: linkStart, to: card.id } }]);
                        notify('Connected')
                      }
                    }
                    setLinkStart(null)
                    setMouseWorld(null)
                    return
                  }
                  cardClickRef.current = {
                    id: card.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                  }
                  const cam = cameraRef.current
                  const rect = viewportRef.current!.getBoundingClientRect()
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
                onClick={(e) => {
                  e.stopPropagation()
                  if (linkStart) {
                    if (linkStart !== card.id) {
                      if (!board.connections.some((e) => (e.from === linkStart && e.to === card.id) || (e.from === card.id && e.to === linkStart))) {
                        runMutation(addConnectionMutation, [{ connection: { id: uid(), from: linkStart, to: card.id } }]);
                        notify('Connected')
                      }
                    }
                    setLinkStart(null)
                    setMouseWorld(null)
                  }
                }}
              >
                <div className="card-topline">
                  <span className="card-kind-tag" style={{ color: meta.color }}>
                    <i>{meta.symbol}</i>
                    {meta.label}
                  </span>
                  {topic && (
                    <span className="card-topic-pill" style={{ borderColor: `${topic.color}55`, color: topic.color }}>
                      {topic.name}
                    </span>
                  )}
                </div>

                <h3 className="card-title">{card.title}</h3>
                {card.body && <p className="card-body-preview">{card.body}</p>}

                <div className="card-foot">
                  <span className={`status-badge status-${card.status}`}>{card.status}</span>
                  {card.confidence === 'hypothesis' && <span className="hypo-indicator">Hypothesis</span>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {canvasMenu && (
        <div
          className="canvas-context-menu"
          style={{ left: canvasMenu.clientX, top: canvasMenu.clientY }}
          onClick={(e) => e.stopPropagation()}
        >
          {inTutorial ? (
            <div className="menu-group">
              <button onClick={() => addTutorialCard(canvasMenu.worldX, canvasMenu.worldY)}>
                <Sparkles size={16} /> Add First Thought Card
              </button>
            </div>
          ) : (
            <>
              <div className="menu-header">Add to this space</div>
              <button onClick={() => addCardAt('knowledge', canvasMenu.worldX - CARD_W / 2, canvasMenu.worldY - CARD_H / 2)}>
                <i className="ctx-dot" style={{ background: kindMeta.knowledge.color }} />
                Add Knowledge Card
              </button>
              <button onClick={() => addCardAt('question', canvasMenu.worldX - CARD_W / 2, canvasMenu.worldY - CARD_H / 2)}>
                <i className="ctx-dot" style={{ background: kindMeta.question.color }} />
                Add Question Card
              </button>
              <button onClick={() => addCardAt('meaning', canvasMenu.worldX - CARD_W / 2, canvasMenu.worldY - CARD_H / 2)}>
                <i className="ctx-dot" style={{ background: kindMeta.meaning.color }} />
                Add Meaning Card
              </button>
              <div className="menu-divider" />
              <button onClick={() => addThreadAt(canvasMenu.worldX, canvasMenu.worldY)}>
                <FolderPlus size={15} /> Add Space Here
              </button>
            </>
          )}
        </div>
      )}

      {selected && (
        <Inspector
          card={selected}
          topics={board.topics.filter((t) => t.id !== 'all')}
          connections={board.connections}
          cards={board.cards}
          onChange={updateCard}
          onClose={() => setSelectedId(null)}
          onDelete={deleteCard}
          onLink={startLink}
          onSelectCard={(id) => {
            setSelectedId(id)
            centerCardInView(id)
          }}
          onDisconnect={(targetId) => disconnectCards(selected.id, targetId)}
          inTutorial={inTutorial}
          onFinishTutorial={finishTutorial}
        />
      )}

      {selectedEdge && (
        <div className="edge-popover">
          <span>Connection selected</span>
          <button onClick={removeEdge}><Unlink size={15} /> Disconnect</button>
          <button className="icon-button" onClick={() => setSelectedEdge(null)}><X size={15} /> </button>
        </div>
      )}

      {bulkOpen && (
        <BulkCapture
          topics={board.topics.filter((t) => t.id !== 'all')}
          onClose={() => setBulkOpen(false)}
          onAdd={(cards) => {
            cards.forEach(c => runMutation(upsertCardMutation, [{ id: c.id, card: c }]));
            setBulkOpen(false)
            notify(`${cards.length} cards added`)
          }}
        />
      )}

      {topicsOpen && (
        <NewTopic
          onClose={() => setTopicsOpen(false)}
          onAdd={(topic) => {
            runMutation(upsertTopicMutation, [{ id: topic.id, topic }])
            setTopicId(topic.id)
            setTopicsOpen(false)
            notify('Space created')
          }}
        />
      )}

      {editingTopic && (
        <TopicEditModal
          topic={editingTopic}
          onClose={() => setEditingTopic(null)}
          onSave={(patch) => updateTopic(editingTopic.id, patch)}
          onDelete={() => deleteTopic(editingTopic.id)}
        />
      )}

      {linkStart && (
        <div className="link-hint">
          <Link2 size={15} /> Click another card or thread to connect <button onClick={() => { setLinkStart(null); setMouseWorld(null) }}>Cancel</button>
        </div>
      )}

      {toast && (
        <div className="toast"><Check size={15} /> {toast}</div>
      )}
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
  inTutorial,
  onFinishTutorial,
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
  inTutorial?: boolean
  onFinishTutorial?: () => void
}) {
  const linked = connections
    .filter((edge) => edge.from === card.id || edge.to === card.id)
    .map((edge) => cards.find((c) => c.id === (edge.from === card.id ? edge.to : edge.from)))
    .filter((c): c is ClarityCard => Boolean(c))

  const meta = kindMeta[card.kind] ?? kindMeta.knowledge

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div className="inspector-badge">
          <i style={{ background: meta.color }}>{meta.symbol}</i>
          <span>{meta.label}</span>
        </div>
        <div className="inspector-header-actions">
          <button className="icon-button close-btn" onClick={onClose} title="Close inspector (Esc)" aria-label="Close inspector">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="inspector-scroll-area">
        {inTutorial && onFinishTutorial && (
          <div className="tutorial-ready-banner">
            <div>
              <p>Ready to see your life map?</p>
              <span>We can map out every detail together.</span>
            </div>
            <button className="primary-button ready-btn" onClick={onFinishTutorial}>
              <Check size={16} /> Yes, I'm ready
            </button>
          </div>
        )}

        <div className="kind-switcher">
          {(Object.keys(kindMeta) as CardKind[]).map((kind) => {
            const km = kindMeta[kind]
            return (
              <button
                key={kind}
                className={card.kind === kind ? 'active' : ''}
                onClick={() => onChange({ kind, confidence: kind === 'meaning' ? 'hypothesis' : card.confidence })}
              >
                <i style={{ background: km.color }}>{km.symbol}</i>
                <span>{km.label}</span>
              </button>
            )
          })}
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
          <label>
            <span>Source / Whose perspective?</span>
            <input
            className="source-input"
            value={card.source ?? ''}
            onChange={(e) => onChange({ source: e.target.value })}
            placeholder="e.g. Conversation, note, reading"
            />
          </label>
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
              {linked.map((item) => {
                const itemMeta = kindMeta[item.kind] ?? kindMeta.knowledge
                return (
                  <div key={item.id} className="connection-row-card">
                    <button
                      className="connection-link-btn"
                      onClick={() => onSelectCard(item.id)}
                      title={`Open "${item.title}"`}
                    >
                      <i style={{ background: itemMeta.color }}>{itemMeta.symbol}</i>
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
                )
              })}
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
        <span className="save-status"><Check size={13} /> Synced</span>
      </div>
    </aside>
  )
}

function TopicEditModal({
  topic,
  onClose,
  onSave,
  onDelete,
}: {
  topic: Topic
  onClose: () => void
  onSave: (patch: { name: string; color: string }) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(topic.name)
  const [color, setColor] = useState(topic.color)
  const colors = ['#dd765c', '#557b72', '#8e68aa', '#d49b3b', '#4d78a4', '#b76f86', '#60865c', '#2c3834']

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <section className="modal small-modal" onPointerDown={(e) => e.stopPropagation()}>
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close modal">
          <X size={19} />
        </button>
        <h2>Edit space</h2>
        <p>Change the name or accent color for this space.</p>
        <input
          autoFocus
          className="topic-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Space name"
        />
        <div className="color-row">
          {colors.map((item) => (
            <button
              key={item}
              className={color === item ? 'color active' : 'color'}
              style={{ background: item }}
              onClick={() => setColor(item)}
              aria-label="Select color"
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          {onDelete && (
            <button
              className="delete-button"
              style={{ height: '42px', padding: '0 15px', borderRadius: '10px' }}
              onClick={onDelete}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button
            className="primary-button wide"
            disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), color })}
          >
            <Check size={16} /> Save space
          </button>
        </div>
      </section>
    </div>
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
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close modal"><X size={19} /> </button>
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
  const colors = ['#dd765c', '#557b72', '#8e68aa', '#d49b3b', '#4d78a4', '#b76f86', '#60865c', '#2c3834']
  const [color, setColor] = useState(colors[0])
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <section className="modal small-modal" onPointerDown={(e) => e.stopPropagation()}>
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close modal"><X size={19} /> </button>
        <h2>Make a new space</h2>
        <p>A space can hold a topic, chapter, relationship, or ongoing story.</p>
        <input autoFocus className="topic-name-input" placeholder="e.g. School & direction" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="color-row">{colors.map((item) => <button key={item} className={color === item ? 'color active' : 'color'} style={{ background: item }} onClick={() => setColor(item)} aria-label="Select color" />)}</div>
        <button className="primary-button wide" disabled={!name.trim()} onClick={() => onAdd({ id: uid(), name: name.trim(), color })}><Plus size={17} /> Create space</button>
      </section>
    </div>
  )
}

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string | undefined) || 'https://cheerful-snake-239.convex.cloud'
const convexClient = new ConvexReactClient(CONVEX_URL)

export function App() {
  return (
    <ErrorBoundary>
      <ConvexProvider client={convexClient}>
        <AppContent />
      </ConvexProvider>
    </ErrorBoundary>
  );
}

export default App
