import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import type { SavedCharacter } from '../../../shared/character'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CharacterSheetView } from './CharacterSheetView'

export const SELECTED_CHARACTER_KEY = 'handbook-select-character'

interface CharactersPageProps {
  selectedId?: string | null
  onSelectedIdChange?: (id: string | null) => void
  /** Sheet stays open beside compendium (no full-page list mode). */
  pinned?: boolean
}

export function CharactersPage({
  selectedId: controlledId,
  onSelectedIdChange,
  pinned = false
}: CharactersPageProps = {}) {
  const isControlled = onSelectedIdChange !== undefined
  const [internalId, setInternalId] = useState<string | null>(null)
  const selectedId = isControlled ? (controlledId ?? null) : internalId

  const setSelectedId = useCallback(
    (id: string | null) => {
      if (isControlled) onSelectedIdChange(id)
      else setInternalId(id)
    },
    [isControlled, onSelectedIdChange]
  )

  const [characters, setCharacters] = useState<Awaited<ReturnType<typeof window.handbook.characters.list>>>([])
  const [detail, setDetail] = useState<SavedCharacter | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  const hasSelection = pinned || selectedId !== null

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await window.handbook.characters.list()
    setCharacters(list)
    setLoading(false)
    if (selectedId && !list.some((c) => c.id === selectedId)) {
      setSelectedId(null)
      setDetail(null)
      setSidebarExpanded(false)
    }
  }, [selectedId])

  useEffect(() => {
    void refresh()
    if (isControlled) return
    const pending = sessionStorage.getItem(SELECTED_CHARACTER_KEY)
    if (pending) {
      sessionStorage.removeItem(SELECTED_CHARACTER_KEY)
      setInternalId(pending)
      setSidebarExpanded(false)
    }
  }, [refresh, isControlled])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void window.handbook.characters.load(selectedId).then(setDetail)
  }, [selectedId])

  const selectCharacter = (id: string) => {
    setSelectedId(id)
    setSidebarExpanded(false)
  }

  const handleDelete = async (id: string) => {
    await window.handbook.characters.delete(id)
    if (selectedId === id) {
      setSelectedId(null)
      setDetail(null)
      setSidebarExpanded(false)
    }
    await refresh()
  }

  if (!pinned && loading) {
    return (
      <div className="empty-state">
        <p>Loading characters…</p>
      </div>
    )
  }

  if (!pinned && characters.length === 0) {
    return (
      <div className="empty-state">
        <Users size={48} />
        <h3>No saved characters</h3>
        <p>Complete the Character Creator and save a hero to see them here.</p>
      </div>
    )
  }

  const layoutClass = [
    'characters-layout',
    pinned ? 'characters-pinned' : null,
    hasSelection ? 'has-selection' : 'list-only',
    hasSelection && sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={layoutClass}>
      <div className="characters-sidebar-col">
        <div
          className={`characters-sidebar-wrap ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
        >
          <aside className="characters-sidebar" aria-label="Character roster">
            <div className="characters-card-list">
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`character-card ${selectedId === c.id ? 'selected' : ''}`}
                  onClick={() => selectCharacter(c.id)}
                  aria-current={selectedId === c.id ? 'true' : undefined}
                >
                  <span className="character-card-level">Lv {c.level}</span>
                  <span className="character-card-class">{c.className}</span>
                  <span className="character-card-name">{c.name}</span>
                </button>
              ))}
            </div>
          </aside>

          {hasSelection && (
            <button
              type="button"
              className="characters-sidebar-toggle"
              onClick={() => setSidebarExpanded((open) => !open)}
              aria-label={sidebarExpanded ? 'Collapse character list' : 'Expand character list'}
              aria-expanded={sidebarExpanded}
            >
              {sidebarExpanded ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>
      </div>

      {hasSelection && (
        <section className="characters-sheet">
          {!detail ? (
            <div className="empty-state inline">
              <p>Loading character sheet…</p>
            </div>
          ) : (
            <ErrorBoundary label="Character sheet">
              <CharacterSheetView
                character={detail}
                onDelete={() => void handleDelete(detail.id)}
                onSaved={setDetail}
              />
            </ErrorBoundary>
          )}
        </section>
      )}
    </div>
  )
}
