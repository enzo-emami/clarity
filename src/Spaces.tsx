import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderPlus, Plus, X } from 'lucide-react'
import type { SpaceFolder, Topic } from './types'

type Props = {
  topics: Topic[]; folders: SpaceFolder[]; active: string; counts: Record<string, number>
  onSelect: (id: string) => void; onEdit: (topic: Topic) => void; onAdd: () => void
  onArrange: (ids: string[], folderId?: string) => Promise<unknown>
  onSaveFolder: (folder: SpaceFolder) => Promise<unknown>
  onDeleteFolder: (id: string) => Promise<unknown>
}

export function Spaces(props: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ topic: Topic; x: number; y: number } | null>(null)
  const [editing, setEditing] = useState<SpaceFolder | null>(null)
  const [busy, setBusy] = useState(false)
  const sorted = [...props.topics].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const group = (folderId?: string) => sorted.filter(t => t.id !== 'all' && (t.folderId || undefined) === folderId)
  const move = async (id: string, folderId?: string, before?: string) => {
    const ids = group(folderId).map(t => t.id).filter(t => t !== id)
    const index = before ? ids.indexOf(before) : -1
    ids.splice(index < 0 ? ids.length : index, 0, id)
    const result = await props.onArrange(ids, folderId)
    if (result !== undefined) { setDragId(null); setOver(null); setMenu(null) }
  }
  const newFolder = () => setEditing({ id: crypto.randomUUID(), name: '', color: '#557b72', order: props.folders.length })
  const row = (topic: Topic) => <button key={topic.id}
    className={`topic ${props.active === topic.id ? 'active' : ''} ${over === topic.id ? 'drop-before' : ''}`}
    draggable={topic.id !== 'all'}
    onDragStart={e => { setDragId(topic.id); e.dataTransfer.setData('text/plain', topic.id); e.dataTransfer.effectAllowed = 'move' }}
    onDragEnd={() => { setDragId(null); setOver(null) }}
    onDragOver={e => { if (dragId && topic.id !== 'all') { e.preventDefault(); setOver(topic.id) } }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (dragId && topic.id !== 'all') void move(dragId, topic.folderId, topic.id) }}
    onClick={() => props.onSelect(topic.id)}
    onKeyDown={e => {
      if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key) && topic.id !== 'all') {
        e.preventDefault()
        const ids = group(topic.folderId).map(t => t.id)
        const index = ids.indexOf(topic.id), next = index + (e.key === 'ArrowUp' ? -1 : 1)
        if (next >= 0 && next < ids.length) { [ids[index], ids[next]] = [ids[next], ids[index]]; void props.onArrange(ids, topic.folderId) }
      }
    }}
    onContextMenu={e => { e.preventDefault(); if (topic.id !== 'all') setMenu({ topic, x: Math.min(e.clientX, innerWidth - 240), y: Math.min(e.clientY, innerHeight - 320) }) }}
    title="Drag to reorder · Alt + ↑/↓ to reorder · Right-click for options">
    <span className="topic-dot" style={{ background: topic.color }} /><span>{topic.name}</span><span className="count">{props.counts[topic.id] ?? 0}</span>
  </button>
  return <>
    <nav className="topics" aria-label="Spaces">
      {props.topics.filter(t => t.id === 'all').map(row)}
      <div className={`space-group ${over === 'root' ? 'drop-zone' : ''}`}
        onDragOver={e => { if (dragId) { e.preventDefault(); if (e.target === e.currentTarget) setOver('root') } }}
        onDrop={e => { e.preventDefault(); if (dragId) void move(dragId) }}>
        {group().map(row)}
        {dragId && <div className="drop-root" onDragOver={e => { e.preventDefault(); setOver('root') }}>Move outside folders</div>}
      </div>
      {[...props.folders].sort((a,b) => a.order-b.order).map(folder => <div className={`space-folder ${over === folder.id ? 'drop-zone' : ''}`} key={folder.id}
        onDragOver={e => { if (dragId) { e.preventDefault(); if (!(e.target as HTMLElement).closest('.topic')) setOver(folder.id) } }}
        onDrop={e => { e.preventDefault(); if (dragId) void move(dragId, folder.id) }}>
        <button className="folder-heading" onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id); return next })}
          onContextMenu={e => { e.preventDefault(); setEditing(folder) }} aria-expanded={!collapsed.has(folder.id)} title="Right-click to rename or color folder">
          {collapsed.has(folder.id) ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
          <Folder size={15} color={folder.color}/><span>{folder.name}</span>
        </button>
        {!collapsed.has(folder.id) && <div className="folder-spaces">{group(folder.id).map(row)}{!group(folder.id).length && <span className="folder-empty">Drop spaces here</span>}</div>}
      </div>)}
    </nav>
    <div className="sidebar-additions"><button className="add-topic" onClick={props.onAdd}><Plus size={15}/>Add a space</button><button className="add-topic" onClick={newFolder}><FolderPlus size={15}/>Add a folder</button></div>
    {menu && <div className="menu-dismiss" onPointerDown={() => setMenu(null)} onKeyDown={e => { if (e.key === 'Escape') setMenu(null) }}>
      <div className="canvas-context-menu space-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={e => e.stopPropagation()}>
        <button autoFocus onClick={() => { props.onEdit(menu.topic); setMenu(null) }}>Edit space</button>
        <label>Add to folder<select aria-label="Add to folder" value={menu.topic.folderId ?? ''} onChange={e => void move(menu.topic.id, e.target.value || undefined)}>
          <option value="">No folder</option>{props.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select></label>
        <button onClick={() => { newFolder(); setMenu(null) }}><FolderPlus size={15}/>Create a folder</button>
        <button onClick={() => setMenu(null)}>Close</button>
      </div>
    </div>}
    {editing && <div className="modal-backdrop" onPointerDown={() => !busy && setEditing(null)}>
      <form className="modal small-modal" onPointerDown={e => e.stopPropagation()} onSubmit={async e => {
        e.preventDefault(); setBusy(true)
        try {
          const result = await props.onSaveFolder({ id: editing.id, name: editing.name.trim(), color: editing.color, order: editing.order })
          if (result !== undefined) setEditing(null)
        } finally { setBusy(false) }
      }}>
        <button type="button" className="modal-close icon-button" onClick={() => setEditing(null)} aria-label="Close folder editor"><X size={19}/></button>
        <h2>{props.folders.some(f => f.id === editing.id) ? 'Edit folder' : 'Add a folder'}</h2>
        <label className="field-label" htmlFor="folder-name">Folder name</label>
        <input id="folder-name" className="topic-name-input" autoFocus required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/>
        <label className="field-label" htmlFor="folder-color">Folder color</label>
        <input id="folder-color" type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })}/>
        <button className="primary-button wide" disabled={busy || !editing.name.trim()}>Save folder</button>
        {props.folders.some(f => f.id === editing.id) && <button type="button" className="add-topic" disabled={busy} onClick={async () => { setBusy(true); try { const result = await props.onDeleteFolder(editing.id); if (result !== undefined) setEditing(null) } finally { setBusy(false) } }}>Remove folder · keep spaces</button>}
      </form>
    </div>}
  </>
}
