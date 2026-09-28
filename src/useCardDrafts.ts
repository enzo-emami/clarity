import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClarityCard } from './types'

type Patch = Partial<ClarityCard>
type Draft = { patch: Patch; revision: number }

// Drafts are authoritative until their own write is acknowledged. Older responses
// must never replace newer keystrokes, including edits made during an in-flight save.
export function useCardDrafts(save: (args: { id: string; updates: Patch }) => Promise<unknown>) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const current = useRef<Record<string, Draft>>({})
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const revision = useRef(0)
  const inFlight = useRef(new Map<string, number>())
  const [error, setError] = useState(false)
  const saveRef = useRef(save)
  saveRef.current = save
  const publish = useCallback(() => setDrafts({ ...current.current }), [])
  const flush = useCallback(async (id: string) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    const draft = current.current[id]
    if (!draft || inFlight.current.get(id) === draft.revision) return
    inFlight.current.set(id, draft.revision)
    try {
      await saveRef.current({ id, updates: draft.patch })
      if (current.current[id]?.revision === draft.revision) {
        delete current.current[id]
        publish()
      }
      setError(false)
    } catch {
      setError(true)
    } finally {
      if (inFlight.current.get(id) === draft.revision) inFlight.current.delete(id)
    }
  }, [publish])
  const edit = useCallback((id: string, patch: Patch, immediate = false) => {
    const previous = current.current[id]
    current.current[id] = {
      patch: { ...previous?.patch, ...patch, updatedAt: Date.now() },
      revision: ++revision.current,
    }
    publish()
    clearTimeout(timers.current.get(id))
    if (immediate) void flush(id)
    else timers.current.set(id, setTimeout(() => void flush(id), 250))
  }, [flush, publish])
  const discard = useCallback((id: string) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    delete current.current[id]
    publish()
  }, [publish])
  const flushAll = useCallback(() => {
    Object.keys(current.current).forEach((id) => void flush(id))
  }, [flush])
  useEffect(() => {
    const onBlur = () => flushAll()
    const onUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(current.current).length) { flushAll(); event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beforeunload', onUnload)
      timers.current.forEach(clearTimeout)
    }
  }, [flushAll])
  return { drafts, edit, discard, flushAll, error, pending: Object.keys(drafts).length > 0 }
}
