import { useMemo, useState } from 'react'

export interface SpellPickerItem {
  name: string
  source: string
  level: number
}

interface SpellPickerModalProps {
  title: string
  hint?: string
  spells: SpellPickerItem[]
  selected: { name: string; source: string }[]
  limit: number
  loading?: boolean
  onToggle: (spell: SpellPickerItem) => void
  onClose: () => void
}

export function SpellPickerModal({
  title,
  hint,
  spells,
  selected,
  limit,
  loading,
  onToggle,
  onClose
}: SpellPickerModalProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return spells
    return spells.filter((spell) => spell.name.toLowerCase().includes(q))
  }, [query, spells])

  return (
    <div className="sheet-modal-backdrop" onMouseDown={onClose}>
      <div
        className="sheet-modal sheet-modal-lg"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="spell-picker-title"
      >
        <h3 id="spell-picker-title">{title}</h3>
        {hint ? <p className="sheet-hint">{hint}</p> : null}
        <input
          type="search"
          className="prepare-spells-search"
          placeholder="Search spells…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="prepare-spells-list">
          {loading ? (
            <p className="sheet-hint">Loading spells…</p>
          ) : filtered.length === 0 ? (
            <p className="sheet-hint">
              {spells.length === 0 ? 'No spells available for this class.' : 'No spells match your search.'}
            </p>
          ) : (
            filtered.map((spell) => {
              const isSelected = selected.some(
                (s) => s.name === spell.name && s.source === spell.source
              )
              return (
                <div key={`${spell.name}|${spell.source}`} className="spell-picker-row">
                  <span>
                    {spell.name}{' '}
                    {spell.level > 0 ? <span className="muted">(Lv {spell.level})</span> : null}
                  </span>
                  <div className="spell-picker-actions">
                    <button type="button" className="btn-chip" onClick={() => onToggle(spell)}>
                      {isSelected ? 'Remove' : 'Add'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="sheet-modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
