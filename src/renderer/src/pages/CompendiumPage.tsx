import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { ChevronDown, ListFilter, Search, BookOpen, X, ArrowUp, ArrowDown } from 'lucide-react'
import type { CompendiumEntry, CompendiumEntityType, CompendiumFilterOptions } from '../../../shared/types'
import {
  EDITION_FILTER_OPTIONS,
  formatSpellSchool,
  getEditionLabel,
  miscOptionsForCategory,
  type EditionFilter,
  type MiscFilter
} from '../../../shared/compendium'
import { getCompendiumColumns, getCompendiumGridClass, type ColumnFilterKey } from './compendium-columns'
import type { CompendiumSort } from '../../../shared/compendium-sort'
import { getSourceDisplay } from '../../../shared/source-abbrev'
import { formatSpellSchoolShort, getSpellSchoolColorClass, titleCase, formatCastTime, formatSpellRange, formatSpellDuration, formatSpellComponents } from '../../../shared/display'
import { getMonsterDetailSections, getMonsterStatRows, isMonsterDetail } from '../../../shared/monster-display'
import { FluffImageGallery } from '../components/FluffImageGallery'
import { formatEntriesAsNodes } from '../components/EntryDescription'

const PAGE_SIZE = 150
const SEARCH_DEBOUNCE_MS = 120

const CATEGORIES: { id: CompendiumEntityType; label: string }[] = [
  { id: 'spell', label: 'Spells' },
  { id: 'monster', label: 'Monsters' },
  { id: 'item', label: 'Items' },
  { id: 'feat', label: 'Feats' },
  { id: 'race', label: 'Species' },
  { id: 'class', label: 'Classes' },
  { id: 'background', label: 'Backgrounds' },
  { id: 'skill', label: 'Skills' },
  { id: 'optionalfeature', label: 'Optional Features' },
  { id: 'condition', label: 'Conditions' },
  { id: 'disease', label: 'Diseases' },
  { id: 'deity', label: 'Deities' },
  { id: 'language', label: 'Languages' },
  { id: 'rule', label: 'Variant Rules' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'trap', label: 'Traps' },
  { id: 'hazard', label: 'Hazards' },
  { id: 'action', label: 'Actions' },
  { id: 'object', label: 'Objects' }
]

const SPELL_LEVELS: { value: number | 'all'; label: string }[] = [
  { value: 'all', label: 'All levels' },
  { value: 0, label: 'Cantrip' },
  ...Array.from({ length: 9 }, (_, i) => ({ value: i + 1, label: `Level ${i + 1}` }))
]

interface Filters {
  sources: string[]
  edition: EditionFilter
  misc: MiscFilter | 'all'
  spellLevel: number | 'all'
  spellSchool: string
  spellClass: string
  rarity: string
  concentration: 'all' | 'yes' | 'no'
}

const DEFAULT_FILTERS: Filters = {
  sources: [],
  edition: 'all',
  misc: 'all',
  spellLevel: 'all',
  spellSchool: 'all',
  spellClass: 'all',
  rarity: 'all',
  concentration: 'all'
}

export function CompendiumPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [category, setCategory] = useState<CompendiumEntityType>('spell')
  const [entries, setEntries] = useState<CompendiumEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const fetchGeneration = useRef(0)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<CompendiumFilterOptions>({
    sources: [],
    sourceOptions: [],
    sourceGroups: [],
    spellSchools: [],
    spellClasses: [],
    rarities: [],
    miscTags: []
  })
  const [selected, setSelected] = useState<CompendiumEntry | null>(null)
  const [detail, setDetail] = useState<unknown>(null)
  const [hasData, setHasData] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState<CompendiumSort | null>(null)
  const [filterPopupPos, setFilterPopupPos] = useState({ top: 0, left: 0, maxHeight: 520 })
  const filterPopupRef = useRef<HTMLDivElement>(null)
  const filterToggleRef = useRef<HTMLButtonElement>(null)

  const updateFilterPopupPosition = useCallback(() => {
    const button = filterToggleRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const margin = 12
    const popupWidth = Math.min(440, window.innerWidth - margin * 2)
    let left = rect.right - popupWidth
    left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin))

    let top = rect.bottom + margin
    const maxHeight = Math.min(520, window.innerHeight - top - margin)
    if (maxHeight < 240) {
      top = Math.max(margin, rect.top - Math.min(520, rect.top - margin * 2))
    }

    setFilterPopupPos({ top, left, maxHeight: Math.max(240, maxHeight) })
  }, [])

  useEffect(() => {
    window.handbook.data.hasData().then(setHasData)
  }, [])

  useEffect(() => {
    if (!hasData) return
    void window.handbook.data.compendiumFilters(category).then(setFilterOptions)
    setFilters(DEFAULT_FILTERS)
    setSearchInput('')
    setSearchQuery('')
    setFiltersOpen(false)
    setSort(null)
  }, [category, hasData])

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!filtersOpen) return

    updateFilterPopupPosition()

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setFiltersOpen(false)
    }

    function onReposition(): void {
      updateFilterPopupPosition()
    }

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [filtersOpen, updateFilterPopupPosition])

  const fetchEntries = useCallback(
    async (append: boolean, fetchOffset: number) => {
      if (!hasData) return
      const generation = ++fetchGeneration.current
      setLoading(true)
      try {
        const result = await window.handbook.data.compendiumQuery({
          type: category,
          query: searchQuery || undefined,
          sources: filters.sources.length ? filters.sources : undefined,
          edition: filters.edition !== 'all' ? filters.edition : undefined,
          misc: filters.misc !== 'all' ? filters.misc : undefined,
          spellLevel:
            category === 'spell' && filters.spellLevel !== 'all' ? filters.spellLevel : undefined,
          spellSchool:
            category === 'spell' && filters.spellSchool !== 'all' ? filters.spellSchool : undefined,
          spellClass:
            category === 'spell' && filters.spellClass !== 'all' ? filters.spellClass : undefined,
          rarity: category === 'item' && filters.rarity !== 'all' ? filters.rarity : undefined,
          concentration:
            category === 'spell' && filters.concentration !== 'all' ? filters.concentration : undefined,
          sortColumn: sort?.column,
          sortDirection: sort?.direction,
          offset: fetchOffset,
          limit: PAGE_SIZE
        })
        if (generation !== fetchGeneration.current) return
        setTotal(result.total)
        setOffset(fetchOffset + result.entries.length)
        setEntries((prev) => (append ? [...prev, ...result.entries] : result.entries))
      } finally {
        if (generation === fetchGeneration.current) setLoading(false)
      }
    },
    [hasData, category, searchQuery, filters, sort]
  )

  useEffect(() => {
    if (!hasData) return
    setSelected(null)
    setOffset(0)
    void fetchEntries(false, 0)
  }, [hasData, category, searchQuery, filters, sort, fetchEntries])

  useEffect(() => {
    if (!selected) {
      setDetail(null)
      return
    }
    void window.handbook.data.getDetail(selected.type, selected.name, selected.source).then(setDetail)
  }, [selected])

  if (!hasData) {
    return (
      <div className="empty-state">
        <BookOpen size={48} />
        <h3>Compendium empty</h3>
        <p>Download 5e.tools data from Settings to browse the full rules library.</p>
      </div>
    )
  }

  const hasMore = entries.length < total
  const activeFilterCount = [
    filters.sources.length > 0,
    filters.edition !== 'all',
    filters.misc !== 'all',
    filters.spellLevel !== 'all',
    filters.spellSchool !== 'all',
    filters.spellClass !== 'all',
    filters.rarity !== 'all',
    filters.concentration !== 'all'
  ].filter(Boolean).length

  function isColumnFilterActive(key: ColumnFilterKey): boolean {
    switch (key) {
      case 'level':
        return filters.spellLevel !== 'all'
      case 'school':
        return filters.spellSchool !== 'all'
      case 'class':
        return filters.spellClass !== 'all'
      case 'concentration':
        return filters.concentration !== 'all'
      case 'source':
        return filters.sources.length > 0
      case 'rarity':
        return filters.rarity !== 'all'
      default:
        return false
    }
  }

  function toggleColumnSort(columnId: string): void {
    setSort((prev) => {
      if (prev?.column === columnId) {
        return { column: columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { column: columnId, direction: 'asc' }
    })
  }

  function toggleFiltersOpen(): void {
    setFiltersOpen((open) => {
      if (!open) updateFilterPopupPosition()
      return !open
    })
  }

  const miscOptions = miscOptionsForCategory(
    category,
    filterOptions.miscTags as MiscFilter[]
  )
  const columns = getCompendiumColumns(category)
  const gridClass = getCompendiumGridClass(category)

  return (
    <div className={`compendium-layout ${embedded ? 'compendium-embedded' : ''}`}>
      <nav className="compendium-categories-bar" aria-label="Compendium categories">
        <div className="category-list">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-btn ${category === cat.id ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="compendium-body">
        <div className="compendium-main">
          <div className={`compendium-search-section ${filtersOpen ? 'filters-open' : ''}`}>
          <div className="search-bar">
            <Search size={18} color="var(--text-muted)" />
            <input
              className="search-input"
              placeholder={`Search ${CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()} by name…`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button
              ref={filterToggleRef}
              type="button"
              className={`filter-toggle ${filtersOpen ? 'active' : ''}`}
              onClick={toggleFiltersOpen}
            >
              <ListFilter size={16} />
              Filters
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
            <span className="result-count">
              {loading && entries.length === 0
                ? 'Loading…'
                : `${entries.length.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="entry-list">
          <div className={`compendium-table-header ${gridClass}`}>
            {columns.map((col) =>
              col.sortType ? (
                <button
                  key={col.id}
                  type="button"
                  className={`compendium-col-header compendium-table-cell compendium-table-cell-${col.id} sortable ${sort?.column === col.id ? 'sorted' : ''} ${col.filterKey && isColumnFilterActive(col.filterKey) ? 'filtered' : ''}`}
                  title={col.title ?? `Sort by ${col.label}`}
                  onClick={() => toggleColumnSort(col.id)}
                >
                  <span className="compendium-col-label">{col.label}</span>
                  {sort?.column === col.id ? (
                    sort.direction === 'asc' ? (
                      <ArrowUp size={12} className="compendium-sort-icon" />
                    ) : (
                      <ArrowDown size={12} className="compendium-sort-icon" />
                    )
                  ) : null}
                </button>
              ) : (
                <div
                  key={col.id}
                  className={`compendium-col-header compendium-table-cell compendium-table-cell-${col.id} static`}
                  title={col.title ?? col.label}
                >
                  {col.label}
                </div>
              )
            )}
          </div>

          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`compendium-table-row ${gridClass} ${selected?.id === entry.id ? 'selected' : ''} ${index % 2 === 1 ? 'alt' : ''}`}
              onClick={() => setSelected(entry)}
            >
              {columns.map((col) => (
                <div
                  key={col.id}
                  className={`compendium-table-cell compendium-table-cell-${col.id}`}
                >
                  {renderCell(col.id, entry)}
                </div>
              ))}
            </div>
          ))}
          {!loading && entries.length === 0 && (
            <div className="empty-state" style={{ padding: 32 }}>
              <p>No results match your search and filters.</p>
            </div>
          )}
          {hasMore && (
            <div className="load-more-row">
              <button
                className="btn-secondary load-more-btn"
                disabled={loading}
                onClick={() => void fetchEntries(true, offset)}
              >
                <ChevronDown size={16} />
                {loading ? 'Loading…' : `Load more (${(total - entries.length).toLocaleString()} remaining)`}
              </button>
            </div>
          )}
        </div>
        </div>

        <aside className="compendium-detail-panel">
          {selected ? (
            <CompendiumDetailView entry={selected} detail={detail} />
          ) : (
            <div className="detail-empty">
              <BookOpen size={32} />
              <p>Select an entry to view details</p>
            </div>
          )}
        </aside>
      </div>

      {filtersOpen && (
        <>
          <div
            className="filter-overlay"
            aria-hidden="true"
            onMouseDown={() => setFiltersOpen(false)}
          />
          <div
            ref={filterPopupRef}
            className="compendium-filter-popup"
            role="dialog"
            aria-label="Filters"
            style={{
              top: filterPopupPos.top,
              left: filterPopupPos.left,
              maxHeight: filterPopupPos.maxHeight
            }}
          >
            <div className="compendium-filter-popup-header">
              <h4>Filters</h4>
              {activeFilterCount > 0 && (
                <>
                  <span className="filter-badge">{activeFilterCount}</span>
                  <button
                    type="button"
                    className="filter-clear-inline"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Clear
                  </button>
                </>
              )}
              <button
                type="button"
                className="filter-popup-close"
                onClick={() => setFiltersOpen(false)}
                title="Close filters"
              >
                <X size={16} />
              </button>
            </div>
            <CompendiumFilterPanel
              category={category}
              filters={filters}
              filterOptions={filterOptions}
              miscOptions={miscOptions}
              onChange={setFilters}
            />
          </div>
        </>
      )}
    </div>
  )
}

function renderCell(columnId: string, entry: CompendiumEntry): ReactNode {
  switch (columnId) {
    case 'name':
      return entry.name
    case 'level':
      return entry.levelLabel ?? ''
    case 'time':
      return entry.castTime ?? ''
    case 'school':
      return (
        <span className={getSpellSchoolColorClass(entry.school)}>
          {formatSpellSchoolShort(entry.school)}
        </span>
      )
    case 'concentration':
      return entry.concentration ? '×' : ''
    case 'range':
      return entry.range ?? ''
    case 'source': {
      const src = getSourceDisplay(entry.source, entry.sourceName)
      return (
        <span className={`source-badge ${src.colorClass}`} title={src.fullName}>
          {src.abbrev}
        </span>
      )
    }
    case 'cr':
      return entry.cr ?? ''
    case 'type':
      return entry.monsterType ?? entry.itemType ?? ''
    case 'rarity':
      return titleCase(entry.rarity ?? '')
    case 'featureType':
      return entry.featureType ?? ''
    case 'page':
      return entry.page ? String(entry.page) : ''
    default:
      return ''
  }
}

function CompendiumFilterPanel({
  category,
  filters,
  filterOptions,
  miscOptions,
  onChange
}: {
  category: CompendiumEntityType
  filters: Filters
  filterOptions: CompendiumFilterOptions
  miscOptions: ReturnType<typeof miscOptionsForCategory>
  onChange: Dispatch<SetStateAction<Filters>>
}) {
  const sourceActive = filters.sources.length

  return (
    <div className="compendium-filters">
      <FilterSection
        id="sources"
        title="Sources"
        activeCount={sourceActive}
      >
        <div className="filter-chip-row filter-chip-row-wrap">
          <FilterChip
            active={filters.sources.length === 0}
            onClick={() => onChange((f) => ({ ...f, sources: [] }))}
          >
            All sources
          </FilterChip>
          {filterOptions.sourceOptions.map((s) => {
            const display = getSourceDisplay(s.code, s.name)
            const selected = filters.sources.includes(s.code)
            return (
              <FilterChip
                key={s.code}
                active={selected}
                className={`filter-chip-source source-badge ${display.colorClass}`}
                title={display.abbrev !== s.name ? display.abbrev : undefined}
                onClick={() =>
                  onChange((f) => {
                    const next = f.sources.includes(s.code)
                      ? f.sources.filter((code) => code !== s.code)
                      : [...f.sources, s.code]
                    return { ...f, sources: next }
                  })
                }
              >
                {s.name}
              </FilterChip>
            )
          })}
        </div>
      </FilterSection>

      <FilterSection
        id="edition"
        title="Edition"
        activeCount={filters.edition !== 'all' ? 1 : 0}
      >
        <div className="filter-chip-row filter-chip-row-wrap">
          {EDITION_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={filters.edition === opt.value}
              onClick={() =>
                onChange((f) => ({
                  ...f,
                  edition: f.edition === opt.value ? 'all' : opt.value
                }))
              }
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </FilterSection>

      {miscOptions.length > 0 && (
        <FilterSection
          id="misc"
          title="Miscellaneous"
          activeCount={filters.misc !== 'all' ? 1 : 0}
        >
          <div className="filter-chip-row filter-chip-row-wrap">
            <FilterChip
              active={filters.misc === 'all'}
              onClick={() => onChange((f) => ({ ...f, misc: 'all' }))}
            >
              All tags
            </FilterChip>
            {miscOptions.map((opt) => (
              <FilterChip
                key={opt.value}
                active={filters.misc === opt.value}
                onClick={() =>
                  onChange((f) => ({
                    ...f,
                    misc: f.misc === opt.value ? 'all' : opt.value
                  }))
                }
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>
        </FilterSection>
      )}

      {category === 'spell' && (
        <>
          <FilterSection
            id="level"
            title="Level"
            activeCount={filters.spellLevel !== 'all' ? 1 : 0}
          >
            <div className="filter-chip-row filter-chip-row-wrap">
              <FilterChip
                active={filters.spellLevel === 'all'}
                onClick={() => onChange((f) => ({ ...f, spellLevel: 'all' }))}
              >
                All levels
              </FilterChip>
              {SPELL_LEVELS.filter((l) => l.value !== 'all').map((lvl) => (
                <FilterChip
                  key={String(lvl.value)}
                  active={filters.spellLevel === lvl.value}
                  onClick={() =>
                    onChange((f) => ({
                      ...f,
                      spellLevel: f.spellLevel === lvl.value ? 'all' : lvl.value
                    }))
                  }
                >
                  {lvl.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          <FilterSection
            id="school"
            title="School"
            activeCount={filters.spellSchool !== 'all' ? 1 : 0}
          >
            <div className="filter-chip-row filter-chip-row-wrap">
              <FilterChip
                active={filters.spellSchool === 'all'}
                onClick={() => onChange((f) => ({ ...f, spellSchool: 'all' }))}
              >
                All schools
              </FilterChip>
              {filterOptions.spellSchools.map((s) => (
                <FilterChip
                  key={s}
                  active={filters.spellSchool === s}
                  className={getSpellSchoolColorClass(s)}
                  onClick={() =>
                    onChange((f) => ({
                      ...f,
                      spellSchool: f.spellSchool === s ? 'all' : s
                    }))
                  }
                >
                  {formatSpellSchoolShort(s)}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          {filterOptions.spellClasses.length > 0 && (
            <FilterSection
              id="class"
              title="Classes"
              activeCount={filters.spellClass !== 'all' ? 1 : 0}
            >
              <div className="filter-chip-row filter-chip-row-wrap">
                <FilterChip
                  active={filters.spellClass === 'all'}
                  onClick={() => onChange((f) => ({ ...f, spellClass: 'all' }))}
                >
                  All classes
                </FilterChip>
                {filterOptions.spellClasses.map((className) => (
                  <FilterChip
                    key={className}
                    active={filters.spellClass === className}
                    onClick={() =>
                      onChange((f) => ({
                        ...f,
                        spellClass: f.spellClass === className ? 'all' : className
                      }))
                    }
                  >
                    {className}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>
          )}

          <FilterSection
            id="concentration"
            title="Concentration"
            activeCount={filters.concentration !== 'all' ? 1 : 0}
          >
            <div className="filter-chip-row filter-chip-row-wrap">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'yes', label: 'Requires concentration (×)' },
                  { value: 'no', label: 'No concentration' }
                ] as const
              ).map((opt) => (
                <FilterChip
                  key={opt.value}
                  active={filters.concentration === opt.value}
                  onClick={() => onChange((f) => ({ ...f, concentration: opt.value }))}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>
        </>
      )}

      {category === 'item' && (
        <FilterSection
          id="rarity"
          title="Rarity"
          activeCount={filters.rarity !== 'all' ? 1 : 0}
        >
          <div className="filter-chip-row filter-chip-row-wrap">
            <FilterChip
              active={filters.rarity === 'all'}
              onClick={() => onChange((f) => ({ ...f, rarity: 'all' }))}
            >
              All rarities
            </FilterChip>
            {filterOptions.rarities.map((r) => (
              <FilterChip
                key={r}
                active={filters.rarity === r}
                onClick={() =>
                  onChange((f) => ({
                    ...f,
                    rarity: f.rarity === r ? 'all' : r
                  }))
                }
              >
                {titleCase(r)}
              </FilterChip>
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  )
}

function FilterSection({
  id,
  title,
  activeCount,
  children
}: {
  id: string
  title: string
  activeCount?: number
  children: ReactNode
}) {
  return (
    <div
      className={`filter-section ${activeCount ? 'has-active' : ''}`}
      data-filter-section={id}
    >
      <div className="filter-section-header">
        <span className="filter-section-title">{title}</span>
        {activeCount ? <span className="filter-section-badge">{activeCount}</span> : null}
      </div>
      <div className="filter-section-body">{children}</div>
    </div>
  )
}

function FilterChip({
  active,
  className,
  title,
  onClick,
  children
}: {
  active: boolean
  className?: string
  title?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`filter-chip ${className ?? ''} ${active ? 'active' : ''}`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CompendiumDetailView({ entry, detail }: { entry: CompendiumEntry; detail: unknown }) {
  const stats = getDetailStats(detail)

  return (
    <>
      <FluffImageGallery detail={detail} className="fluff-images compendium-fluff-images" />
      <h3 className="detail-title">{entry.name}</h3>
      <p className="detail-meta">{renderMeta(entry, true)}</p>
      {stats.length > 0 && (
        <dl className="detail-stats">
          {stats.map(({ label, value }) => (
            <div key={label} className="detail-stat">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="detail-description">{renderDetailDescription(detail)}</div>
    </>
  )
}

function getDetailStats(detail: unknown): { label: string; value: string }[] {
  if (!detail || typeof detail !== 'object') return []
  const obj = detail as Record<string, unknown>

  if (isMonsterDetail(obj)) {
    return getMonsterStatRows(obj)
  }

  const stats: { label: string; value: string }[] = []

  const castTime = formatCastTime(obj.time)
  if (castTime) stats.push({ label: 'Casting Time', value: castTime })

  const range = formatSpellRange(obj.range)
  if (range) stats.push({ label: 'Range', value: range })

  const components = formatSpellComponents(obj.components)
  if (components) stats.push({ label: 'Components', value: components })

  const duration = formatSpellDuration(obj.duration)
  if (duration) stats.push({ label: 'Duration', value: duration })

  if (obj.cr !== undefined) stats.push({ label: 'Challenge Rating', value: String(obj.cr) })
  if (obj.rarity) stats.push({ label: 'Rarity', value: String(obj.rarity) })

  if (obj.size) {
    stats.push({
      label: 'Size',
      value: Array.isArray(obj.size) ? obj.size.join(', ') : String(obj.size)
    })
  }

  if (obj.type) {
    const t = obj.type as Record<string, unknown> | string
    if (typeof t === 'string') stats.push({ label: 'Type', value: t })
    else {
      const typeLabel = [t.type, Array.isArray(t.tags) ? `(${t.tags.join(', ')})` : '']
        .filter(Boolean)
        .join(' ')
      if (typeLabel) stats.push({ label: 'Type', value: typeLabel })
    }
  }

  return stats
}

function renderDetailDescription(detail: unknown): ReactNode {
  if (!detail || typeof detail !== 'object') {
    return <p className="detail-no-content">No details available.</p>
  }

  const obj = detail as Record<string, unknown>
  const blocks: ReactNode[] = []

  if (Array.isArray(obj.entries)) {
    blocks.push(
      <div key="entries" className="detail-block">
        {formatEntriesAsNodes(obj.entries)}
      </div>
    )
  }

  if (isMonsterDetail(obj)) {
    for (const section of getMonsterDetailSections(obj)) {
      blocks.push(
        <div key={section.title} className="detail-block monster-detail-section">
          <h4 className="monster-section-title">{section.title}</h4>
          {section.note ? <p className="detail-paragraph muted">{section.note}</p> : null}
          {section.headerEntries ? formatEntriesAsNodes(section.headerEntries) : null}
          {section.abilities.map((ability) => (
            <div key={`${section.title}-${ability.name}`} className="monster-ability">
              <h5 className="monster-ability-name">{ability.name}</h5>
              <div className="monster-ability-body">{formatEntriesAsNodes(ability.entries)}</div>
            </div>
          ))}
        </div>
      )
    }
  }

  if (Array.isArray(obj.entriesHigherLevel)) {
    blocks.push(
      <div key="higher" className="detail-block detail-block-higher">
        <h4>At Higher Levels</h4>
        {formatEntriesAsNodes(obj.entriesHigherLevel)}
      </div>
    )
  }

  if (!blocks.length) {
    return <p className="detail-no-content">No description available.</p>
  }

  return <>{blocks}</>
}

function renderMeta(entry: CompendiumEntry, expanded = false): string {
  const parts: string[] = []
  const src = getSourceDisplay(entry.source, entry.sourceName)
  parts.push(`${src.abbrev} — ${src.fullName}`)
  const editionLabel = getEditionLabel(entry)
  if (editionLabel) parts.push(editionLabel)
  if (entry.level !== undefined) parts.push(entry.level === 0 ? 'Cantrip' : `Level ${entry.level}`)
  if (entry.school) parts.push(formatSpellSchool(entry.school))
  if (entry.cr) parts.push(`CR ${entry.cr}`)
  if (entry.rarity) parts.push(entry.rarity)
  if (entry.featureType) parts.push(entry.featureType)
  if (entry.page) parts.push(`p.${entry.page}`)
  if (expanded && entry.itemType) parts.push(`Type: ${entry.itemType}`)
  return parts.join(' · ')
}
