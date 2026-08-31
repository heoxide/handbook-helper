import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Dices, Save, Check } from 'lucide-react'
import type { CompendiumEntry } from '../../../shared/types'
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_NAMES,
  ALIGNMENTS,
  type Ability,
  type Alignment,
  type BackgroundBoostMode,
  applyBackgroundBoosts,
  abilityModifier,
  buildSavedCharacter,
  computeMaxHp,
  defaultScores,
  filterClassSkillOptions,
  formatModifier,
  formatSkillName,
  getBackgroundAbilities,
  getClassSavingThrows,
  getClassSkillChoice,
  getHitDieFaces,
  getLevel1ExpertiseCount,
  isSkillInList,
  parseBackgroundFeat,
  parseNamedProficiencies,
  passivePerception,
  pointBuySpent,
  POINT_BUY_TOTAL,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  isValidAbilityScore,
  PROFICIENCY_BONUS,
  roll4d6DropLowest,
  type ScoreMethod,
  skillModifier,
  suggestStandardArray,
  STANDARD_ARRAY,
  SKILL_TO_ABILITY
} from '../../../shared/character'
import {
  CREATOR_SOURCE_BOOKS,
  booksForEdition,
  defaultBooksForEdition,
  enabledSourceCodes,
  normalizeEnabledBookIds
} from '../../../shared/sources'
import {
  filterCreatorBackgrounds,
  filterCreatorClasses,
  filterCreatorSpecies,
  filterFeatsByCategory
} from '../../../shared/creator-filters'
import { EntryDescription } from '../components/EntryDescription'
import { FluffImageGallery } from '../components/FluffImageGallery'
import { OriginFeatStep } from '../components/OriginFeatStep'
import { EquipmentStep } from '../components/EquipmentStep'
import {
  analyzeFeatChoices,
  autoGrantFromFeat,
  formatOriginFeatSummary,
  isOriginFeatComplete,
  mergeFeatVersion,
  mergeFeatProficiencies,
  parseBackgroundFeatRefs,
  type BackgroundFeatRef,
  type CreatorEdition,
  type OriginFeatSelection,
  featGrantsTough
} from '../../../shared/origin-feat'
import {
  isEquipmentPlanComplete,
  parseStartingEquipment,
  resolveStartingInventory,
  type EquipmentFilterPicks,
  type EquipmentSelections
} from '../../../shared/starting-equipment'
import { SubclassStep } from '../components/SubclassStep'
import {
  CREATOR_STEP,
  isCreatorStepSkipped,
  navigateCreatorStep,
  speciesAsiStepRequired,
  subclassRequiredAtCreation
} from '../utils/creator-steps'
import {
  applySpeciesAsi,
  emptySpeciesAsiPicks,
  formatSpeciesAsiSummary,
  getSpeciesAsiBonusForAbility,
  parseSpeciesAbility,
  speciesAsiHasBonuses,
  validateSpeciesAsiPicks
} from '../../../shared/species-asi'
import { getSubclasses, type SubclassOption } from '../../../shared/class-mechanics'
import {
  buildBackgroundDetailMeta,
  buildSpeciesDetailMeta
} from '../utils/creator-detail-meta'

const STEPS = [
  'Class',
  'Subclass',
  'Background',
  'Origin Feat',
  'Species',
  'Species ASI',
  'Abilities',
  'Skills',
  'Alignment',
  'Equipment',
  'Summary'
] as const
const SOURCE_STORAGE_KEY = 'handbook-creator-sources'
const EDITION_STORAGE_KEY = 'handbook-creator-edition'

interface CharacterDraft {
  name: string
  classEntry: CompendiumEntry | null
  subclassEntry: { name: string; source: string } | null
  availableSubclasses: SubclassOption[]
  backgroundEntry: CompendiumEntry | null
  speciesEntry: CompendiumEntry | null
  classDetail: Record<string, unknown> | null
  backgroundDetail: Record<string, unknown> | null
  speciesDetail: Record<string, unknown> | null
  speciesAsiPicks: Ability[][]
  scoreMethod: ScoreMethod
  baseScores: Record<Ability, number>
  rolledPool: number[]
  rollAssign: Record<Ability, number | null>
  boostMode: BackgroundBoostMode
  boostPlusTwo: Ability | null
  boostPlusOne: Ability | null
  classSkills: string[]
  expertiseSkills: string[]
  alignment: Alignment | null
  originFeatRefs: BackgroundFeatRef[]
  featDetails: Record<string, Record<string, unknown>>
  originFeatSelections: OriginFeatSelection[]
  equipmentSelections: EquipmentSelections
  equipmentFilterPicks: EquipmentFilterPicks
}

function emptyRollAssign(): Record<Ability, number | null> {
  return Object.fromEntries(ABILITIES.map((ab) => [ab, null])) as Record<Ability, number | null>
}

function scoresFromRollAssignment(
  pool: number[],
  assign: Record<Ability, number | null>
): Record<Ability, number> {
  const scores = {} as Record<Ability, number>
  for (const ab of ABILITIES) {
    const idx = assign[ab]
    scores[ab] = idx != null ? pool[idx]! : 0
  }
  return scores
}

function isPoolIndexUsed(
  assign: Record<Ability, number | null>,
  index: number,
  exceptAbility?: Ability
): boolean {
  return ABILITIES.some((ab) => ab !== exceptAbility && assign[ab] === index)
}

function emptyDraft(): CharacterDraft {
  return {
    name: '',
    classEntry: null,
    subclassEntry: null,
    availableSubclasses: [],
    backgroundEntry: null,
    speciesEntry: null,
    classDetail: null,
    backgroundDetail: null,
    speciesDetail: null,
    speciesAsiPicks: [],
    scoreMethod: 'standard',
    baseScores: defaultScores(),
    rolledPool: [],
    rollAssign: emptyRollAssign(),
    boostMode: 'two-one',
    boostPlusTwo: null,
    boostPlusOne: null,
    classSkills: [],
    expertiseSkills: [],
    alignment: null,
    originFeatRefs: [],
    featDetails: {},
    originFeatSelections: [],
    equipmentSelections: {},
    equipmentFilterPicks: {}
  }
}

function loadEdition(): CreatorEdition {
  try {
    const raw = localStorage.getItem(EDITION_STORAGE_KEY)
    if (raw === '2014' || raw === '2024') return raw
  } catch {
    /* ignore */
  }
  return '2024'
}

function loadEnabledBooks(edition: CreatorEdition): string[] {
  try {
    const raw = localStorage.getItem(SOURCE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeEnabledBookIds(parsed)
      }
    }
  } catch {
    /* ignore */
  }
  return defaultBooksForEdition(edition)
}

import { raceListLabel } from '../../../shared/race-data'

function speciesCardSubtitle(item: CompendiumEntry): string {
  const book = item.sourceName ?? item.source
  if (item.isSubrace && item.raceName && item.raceName !== item.name) {
    return `${item.raceName} · ${book}`
  }
  return book
}

function OptionGrid({
  items,
  selectedId,
  onSelect,
  searchPlaceholder = 'Search…',
  scrollable = false
}: {
  items: CompendiumEntry[]
  selectedId?: string
  onSelect: (entry: CompendiumEntry) => void
  searchPlaceholder?: string
  scrollable?: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        (item.sourceName?.toLowerCase().includes(q) ?? false) ||
        (item.raceName?.toLowerCase().includes(q) ?? false)
    )
  }, [items, query])

  if (!items.length) {
    return <p className="hint-text">No options available for the selected source books.</p>
  }

  const body = (
    <>
      <div className="option-grid-toolbar">
        <input
          className="search-input option-search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="option-count">
          {filtered.length === items.length
            ? `${items.length} options`
            : `${filtered.length} of ${items.length}`}
        </span>
      </div>
      {!filtered.length ? (
        <p className="hint-text">No matches for &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="option-grid">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`option-card ${selectedId === item.id ? 'selected' : ''}`}
              onClick={() => onSelect(item)}
            >
              <div className="name">{item.type === 'race' ? raceListLabel(item) : item.name}</div>
              <div className="source">
                {item.type === 'race' ? speciesCardSubtitle(item) : item.sourceName ?? item.source}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (scrollable) {
    return <div className="option-grid-scroll">{body}</div>
  }

  return body
}

function PickerStep({
  title,
  description,
  hint,
  items,
  selectedId,
  onSelect,
  searchPlaceholder,
  step,
  navigateStep,
  canProceed
}: {
  title: string
  description: ReactNode
  hint?: ReactNode
  items: CompendiumEntry[]
  selectedId?: string
  onSelect: (entry: CompendiumEntry) => void
  searchPlaceholder: string
  step: number
  navigateStep: (direction: 1 | -1) => void
  canProceed: boolean
}) {
  return (
    <div className="creator-card creator-card-picker">
      <div className="creator-card-header">
        <h2>{title}</h2>
        <p>{description}</p>
        {hint}
      </div>
      <div className="creator-card-scroll">
        <OptionGrid
          scrollable
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          searchPlaceholder={searchPlaceholder}
        />
      </div>
      <div className="creator-card-footer">
        <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed} />
      </div>
    </div>
  )
}

function CreatorPicksPanel({
  draft,
  step,
  finalScores,
  creatorEdition,
  speciesAsi,
  backgroundSkills,
  backgroundTools,
  maxHp,
  onJumpToStep,
  needsSubclass,
  speciesAsiStepNeeded
}: {
  draft: CharacterDraft
  step: number
  finalScores: Record<Ability, number>
  creatorEdition: CreatorEdition
  speciesAsi: ReturnType<typeof parseSpeciesAbility> | null
  backgroundSkills: string[]
  backgroundTools: string[]
  maxHp: number | null
  onJumpToStep: (n: number) => void
  needsSubclass: boolean
  speciesAsiStepNeeded: boolean
}) {
  const originFeatLabel =
    draft.originFeatSelections.length > 0
      ? formatOriginFeatSummary(draft.originFeatSelections)
      : draft.backgroundDetail
        ? parseBackgroundFeat(draft.backgroundDetail)
        : null

  return (
    <aside className="creator-picks">
      <h3 className="creator-picks-title">Your Character</h3>
      {draft.name && <p className="creator-picks-name">{draft.name}</p>}

      <PickRow
        label="Class"
        stepIndex={CREATOR_STEP.CLASS}
        currentStep={step}
        value={draft.classEntry?.name}
        detail={draft.classEntry?.sourceName ?? draft.classEntry?.source}
        onJump={onJumpToStep}
      />
      {needsSubclass && (
        <PickRow
          label="Subclass"
          stepIndex={CREATOR_STEP.SUBCLASS}
          currentStep={step}
          value={draft.subclassEntry?.name}
          detail={draft.subclassEntry?.source}
          onJump={onJumpToStep}
        />
      )}
      <PickRow
        label="Background"
        stepIndex={CREATOR_STEP.BACKGROUND}
        currentStep={step}
        value={draft.backgroundEntry?.name}
        detail={draft.backgroundEntry?.sourceName ?? draft.backgroundEntry?.source}
        onJump={onJumpToStep}
      />
      {draft.originFeatRefs.length > 0 && (
        <PickRow
          label="Origin Feat"
          stepIndex={CREATOR_STEP.ORIGIN_FEAT}
          currentStep={step}
          value={originFeatLabel ?? undefined}
          onJump={onJumpToStep}
        />
      )}
      <PickRow
        label="Species"
        stepIndex={CREATOR_STEP.SPECIES}
        currentStep={step}
        value={draft.speciesEntry?.name}
        detail={draft.speciesEntry?.sourceName ?? draft.speciesEntry?.source}
        onJump={onJumpToStep}
      />
      {creatorEdition === '2014' && speciesAsi && speciesAsiHasBonuses(speciesAsi) && (
        <div className="creator-picks-section">
          <div className="creator-picks-label">Species ASI</div>
          <p className="creator-picks-detail">
            {formatSpeciesAsiSummary(speciesAsi, draft.speciesAsiPicks)}
          </p>
        </div>
      )}
      {speciesAsiStepNeeded && (
        <PickRow
          label="Species ASI"
          stepIndex={CREATOR_STEP.SPECIES_ASI}
          currentStep={step}
          value={
            speciesAsi && validateSpeciesAsiPicks(speciesAsi, draft.speciesAsiPicks)
              ? 'Chosen'
              : undefined
          }
          onJump={onJumpToStep}
        />
      )}

      {step >= CREATOR_STEP.ABILITIES && (
        <div className="creator-picks-section">
          <div className="creator-picks-label">Ability Scores</div>
          <div className="creator-picks-abilities">
            {ABILITIES.map((ab) => (
              <div key={ab} className="creator-picks-ability">
                <span>{ABILITY_LABELS[ab]}</span>
                <span>{finalScores[ab]}</span>
                <span className="muted">{formatModifier(abilityModifier(finalScores[ab]))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(backgroundSkills.length > 0 || draft.classSkills.length > 0) && step >= CREATOR_STEP.SKILLS && (
        <div className="creator-picks-section">
          <div className="creator-picks-label">Skills</div>
          <div className="creator-picks-chips">
            {backgroundSkills.map((s) => (
              <span key={`bg-${s}`} className="pick-chip locked">
                {formatSkillName(s)}
              </span>
            ))}
            {draft.classSkills.map((s) => (
              <span key={`cl-${s}`} className="pick-chip">
                {formatSkillName(s)}
              </span>
            ))}
            {draft.expertiseSkills.map((s) => (
              <span key={`ex-${s}`} className="pick-chip expertise">
                {formatSkillName(s)} ★
              </span>
            ))}
          </div>
        </div>
      )}

      {(backgroundTools.length > 0) && step >= CREATOR_STEP.SKILLS && (
        <div className="creator-picks-section">
          <div className="creator-picks-label">Tools</div>
          <div className="creator-picks-chips">
            {backgroundTools.map((t) => (
              <span key={t} className="pick-chip">
                {formatSkillName(t)}
              </span>
            ))}
          </div>
        </div>
      )}

      {draft.alignment && (
        <PickRow
          label="Alignment"
          stepIndex={CREATOR_STEP.ALIGNMENT}
          currentStep={step}
          value={draft.alignment}
          onJump={onJumpToStep}
        />
      )}

      {step >= CREATOR_STEP.ABILITIES && draft.classEntry && draft.speciesEntry && (
        <div className="creator-picks-section muted">
          <div className="creator-picks-label">Preview</div>
          <p className="creator-picks-preview">
            Lv 1 {draft.speciesEntry.name} {draft.classEntry.name}
            {draft.subclassEntry ? ` (${draft.subclassEntry.name})` : ''}
            {maxHp != null && ` · ${maxHp} HP`}
          </p>
        </div>
      )}
    </aside>
  )
}

function PickRow({
  label,
  stepIndex,
  currentStep,
  value,
  detail,
  onJump
}: {
  label: string
  stepIndex: number
  currentStep: number
  value?: string | null
  detail?: string | null
  onJump: (n: number) => void
}) {
  const canJump = stepIndex <= currentStep
  return (
    <button
      type="button"
      className={`creator-pick-row ${value ? 'filled' : 'empty'} ${currentStep === stepIndex ? 'current' : ''}`}
      disabled={!canJump}
      onClick={() => onJump(stepIndex)}
    >
      <span className="creator-pick-label">{label}</span>
      {value ? (
        <>
          <span className="creator-pick-value">{value}</span>
          {detail && <span className="creator-pick-detail">{detail}</span>}
        </>
      ) : (
        <span className="creator-pick-placeholder">Not chosen</span>
      )}
    </button>
  )
}

function CreatorDetailPanel({
  title,
  subtitle,
  meta,
  detail
}: {
  title?: string
  subtitle?: string
  meta?: { label: string; value: string }[]
  detail: Record<string, unknown> | null
}) {
  return (
    <aside className="creator-detail-panel">
      <h3 className="creator-detail-title">{title ?? 'Details'}</h3>
      {subtitle && <p className="creator-detail-subtitle">{subtitle}</p>}
      <div className="creator-detail-scroll">
        <FluffImageGallery detail={detail} className="fluff-images creator-fluff-images" />
        {meta && meta.length > 0 && (
          <div className="creator-detail-meta">
            {meta.map((row) => (
              <div key={row.label} className="creator-detail-meta-row">
                <span className="info-label">{row.label}</span>
                <span className="creator-detail-meta-value">{row.value}</span>
              </div>
            ))}
          </div>
        )}
        <EntryDescription detail={detail} />
      </div>
    </aside>
  )
}

export function CharacterCreatorPage() {
  const [step, setStep] = useState(0)
  const [hasData, setHasData] = useState(false)
  const [allClasses, setAllClasses] = useState<CompendiumEntry[]>([])
  const [allBackgrounds, setAllBackgrounds] = useState<CompendiumEntry[]>([])
  const [allSpecies, setAllSpecies] = useState<CompendiumEntry[]>([])
  const [allFeats, setAllFeats] = useState<CompendiumEntry[]>([])
  const [creatorEdition, setCreatorEdition] = useState<CreatorEdition>(loadEdition)
  const [enabledBooks, setEnabledBooks] = useState<string[]>(() => loadEnabledBooks(loadEdition()))
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedId, setSavedId] = useState<string | null>(null)

  const sourceCodes = useMemo(() => enabledSourceCodes(enabledBooks), [enabledBooks])
  const availableBooks = useMemo(() => booksForEdition(creatorEdition), [creatorEdition])

  const classes = useMemo(
    () => filterCreatorClasses(allClasses, sourceCodes, creatorEdition),
    [allClasses, sourceCodes, creatorEdition]
  )
  const backgrounds = useMemo(
    () => filterCreatorBackgrounds(allBackgrounds, sourceCodes, creatorEdition),
    [allBackgrounds, sourceCodes, creatorEdition]
  )
  const species = useMemo(
    () => filterCreatorSpecies(allSpecies, sourceCodes, creatorEdition),
    [allSpecies, sourceCodes, creatorEdition]
  )

  const categoryFeats = useMemo(() => {
    const categories = draft.originFeatRefs.flatMap((r) => r.categories ?? [])
    if (!categories.length) return []
    return filterFeatsByCategory(allFeats, categories, sourceCodes)
  }, [allFeats, draft.originFeatRefs, sourceCodes])

  useEffect(() => {
    localStorage.setItem(SOURCE_STORAGE_KEY, JSON.stringify(enabledBooks))
  }, [enabledBooks])

  useEffect(() => {
    localStorage.setItem(EDITION_STORAGE_KEY, creatorEdition)
  }, [creatorEdition])

  useEffect(() => {
    if (!draft.speciesEntry) return
    if (!species.some((s) => s.id === draft.speciesEntry?.id)) {
      setDraft((d) => ({ ...d, speciesEntry: null, speciesDetail: null }))
    }
  }, [species, draft.speciesEntry])

  useEffect(() => {
    void window.handbook.data.hasData().then(setHasData)
    void window.handbook.data.getClasses().then(setAllClasses)
    void window.handbook.data.getBackgrounds().then(setAllBackgrounds)
    void window.handbook.data.getRaces().then(setAllSpecies)
    void window.handbook.data.getFeats().then(setAllFeats)
  }, [])

  const switchEdition = (edition: CreatorEdition) => {
    if (edition === creatorEdition) return
    setCreatorEdition(edition)
    setEnabledBooks(defaultBooksForEdition(edition))
    setDraft(emptyDraft())
    setStep(0)
    setSaveState('idle')
    setSavedId(null)
  }

  const toggleSourceBook = (bookId: string) => {
    if (!availableBooks.some((b) => b.id === bookId)) return
    setEnabledBooks((prev) => {
      if (prev.includes(bookId)) {
        const next = prev.filter((id) => id !== bookId)
        return next.length ? next : prev
      }
      return [...prev, bookId]
    })
    setDraft(emptyDraft())
    setStep(0)
    setSaveState('idle')
    setSavedId(null)
  }

  const loadDetail = useCallback(async (type: string, entry: CompendiumEntry | null) => {
    if (!entry) return null
    return (await window.handbook.data.getDetail(type, entry.name, entry.source)) as Record<
      string,
      unknown
    > | null
  }, [])

  const loadNamedDetail = useCallback(async (type: string, name: string, source: string) => {
    return (await window.handbook.data.getDetail(type, name, source)) as Record<
      string,
      unknown
    > | null
  }, [])

  const selectClass = async (entry: CompendiumEntry) => {
    const detail = await loadDetail('class', entry)
    const bundle = await window.handbook.data.getClassBundle(entry.name, entry.source)
    const subs = bundle ? getSubclasses(bundle, entry.name, entry.source) : []
    setDraft((d) => ({
      ...d,
      classEntry: entry,
      classDetail: detail,
      subclassEntry: null,
      availableSubclasses: subs,
      baseScores: d.scoreMethod === 'standard' ? suggestStandardArray(entry.name) : d.baseScores,
      classSkills: [],
      expertiseSkills: [],
      equipmentSelections: {},
      equipmentFilterPicks: {}
    }))
  }

  const selectSubclass = (sub: SubclassOption) => {
    setDraft((d) => ({
      ...d,
      subclassEntry: { name: sub.name, source: sub.source }
    }))
  }

  const needsSubclass = subclassRequiredAtCreation(draft.classDetail)
  const speciesAsiStepNeeded = speciesAsiStepRequired(creatorEdition, draft.speciesDetail)

  const speciesAsi = useMemo(() => {
    if (creatorEdition !== '2014' || !draft.speciesDetail) return null
    return parseSpeciesAbility(draft.speciesDetail)
  }, [creatorEdition, draft.speciesDetail])

  const navigateStep = useCallback(
    (direction: 1 | -1) => {
      setStep((s) => navigateCreatorStep(s, direction, draft.classDetail, speciesAsiStepNeeded))
    },
    [draft.classDetail, speciesAsiStepNeeded]
  )

  const jumpToStep = useCallback(
    (target: number) => {
      if (isCreatorStepSkipped(target, draft.classDetail, speciesAsiStepNeeded)) return
      setStep(target)
    },
    [draft.classDetail, speciesAsiStepNeeded]
  )

  const selectBackground = async (entry: CompendiumEntry) => {
    setDraft((d) => ({
      ...d,
      backgroundEntry: entry,
      backgroundDetail: null,
      originFeatRefs: [],
      featDetails: {},
      originFeatSelections: [],
      equipmentSelections: {},
      equipmentFilterPicks: {}
    }))

    try {
      const detail = await loadDetail('background', entry)
      const options = detail ? getBackgroundAbilities(detail) : []
      const bgSkills = detail
        ? parseNamedProficiencies(
            (detail.skillProficiencies ?? detail.skillProf) as never
          )
        : []
      const refs = detail ? parseBackgroundFeatRefs(detail) : []
      const featDetails: Record<string, Record<string, unknown>> = {}
      const originFeatSelections: OriginFeatSelection[] = []

      for (const ref of refs) {
        if (ref.type === 'category') {
          originFeatSelections.push({
            refId: ref.id,
            name: ref.name,
            source: ref.source,
            choices: { skills: [], tools: [], languages: [], weapons: [] }
          })
          continue
        }

        const featDetail = await loadNamedDetail('feat', ref.name, ref.source)
        if (featDetail) {
          featDetails[ref.id] = featDetail
          const grants = autoGrantFromFeat(featDetail, ref.variant)
          originFeatSelections.push({
            refId: ref.id,
            name: ref.name,
            source: ref.source,
            variant: ref.variant,
            choices: {
              skills: [],
              tools: [],
              languages: grants.languages ?? [],
              weapons: grants.weapons ?? []
            }
          })
        }
      }

      setDraft((d) => ({
        ...d,
        backgroundEntry: entry,
        backgroundDetail: detail,
        boostPlusTwo: options[0] ?? null,
        boostPlusOne: options[1] ?? options[0] ?? null,
        classSkills: d.classSkills.filter((s) => !isSkillInList(s, bgSkills)),
        originFeatRefs: refs,
        featDetails,
        originFeatSelections
      }))
    } catch (err) {
      console.error('[CharacterCreator] Failed to load background', entry.name, err)
      setDraft((d) => ({ ...d, backgroundEntry: entry, backgroundDetail: null }))
    }
  }

  const selectSpecies = async (entry: CompendiumEntry) => {
    const detail = await loadDetail('race', entry)
    const asi = detail && creatorEdition === '2014' ? parseSpeciesAbility(detail) : null
    setDraft((d) => ({
      ...d,
      speciesEntry: entry,
      speciesDetail: detail,
      speciesAsiPicks: asi ? emptySpeciesAsiPicks(asi) : []
    }))
  }

  const backgroundAbilities = useMemo(
    () => (draft.backgroundDetail ? getBackgroundAbilities(draft.backgroundDetail) : []),
    [draft.backgroundDetail]
  )

  const effectiveBaseScores = useMemo(() => {
    if (draft.scoreMethod === 'roll' && draft.rolledPool.length === 6) {
      return scoresFromRollAssignment(draft.rolledPool, draft.rollAssign)
    }
    return draft.baseScores
  }, [draft.scoreMethod, draft.baseScores, draft.rolledPool, draft.rollAssign])

  const finalScores = useMemo(() => {
    let scores = effectiveBaseScores
    if (creatorEdition === '2024' && backgroundAbilities.length) {
      scores = applyBackgroundBoosts(
        scores,
        draft.boostMode,
        backgroundAbilities,
        draft.boostPlusTwo ?? undefined,
        draft.boostPlusOne ?? undefined
      )
    }
    if (creatorEdition === '2014' && speciesAsi) {
      scores = applySpeciesAsi(scores, speciesAsi, draft.speciesAsiPicks)
    }
    return scores
  }, [
    effectiveBaseScores,
    creatorEdition,
    backgroundAbilities,
    draft.boostMode,
    draft.boostPlusTwo,
    draft.boostPlusOne,
    speciesAsi,
    draft.speciesAsiPicks
  ])

  const classSkillChoice = useMemo(
    () => (draft.classDetail ? getClassSkillChoice(draft.classDetail) : null),
    [draft.classDetail]
  )

  const backgroundSkills = useMemo(
    () =>
      parseNamedProficiencies(
        (draft.backgroundDetail?.skillProficiencies ?? draft.backgroundDetail?.skillProf) as never
      ),
    [draft.backgroundDetail]
  )

  const backgroundTools = useMemo(
    () =>
      parseNamedProficiencies(
        (draft.backgroundDetail?.toolProficiencies ?? draft.backgroundDetail?.toolProf) as never
      ),
    [draft.backgroundDetail]
  )

  const mergedProficiencies = useMemo(
    () => mergeFeatProficiencies(backgroundSkills, backgroundTools, draft.originFeatSelections),
    [backgroundSkills, backgroundTools, draft.originFeatSelections]
  )

  const allBackgroundSkills = mergedProficiencies.skills
  const allTools = mergedProficiencies.tools

  const selectableClassSkills = useMemo(
    () =>
      classSkillChoice
        ? filterClassSkillOptions(classSkillChoice.from, allBackgroundSkills)
        : [],
    [classSkillChoice, allBackgroundSkills]
  )

  const blockedClassSkills = useMemo(
    () =>
      classSkillChoice
        ? classSkillChoice.from.filter((s) => isSkillInList(s, allBackgroundSkills))
        : [],
    [classSkillChoice, allBackgroundSkills]
  )

  const allProficientSkills = useMemo(() => {
    const keys = new Set<string>()
    for (const s of [...allBackgroundSkills, ...draft.classSkills]) keys.add(s.toLowerCase())
    return [...keys]
  }, [allBackgroundSkills, draft.classSkills])

  const expertiseCount = useMemo(
    () => getLevel1ExpertiseCount(draft.classDetail),
    [draft.classDetail]
  )

  const savingThrows = useMemo(
    () => (draft.classDetail ? getClassSavingThrows(draft.classDetail) : []),
    [draft.classDetail]
  )

  const backgroundDetailMeta = useMemo(
    () =>
      buildBackgroundDetailMeta(
        draft.backgroundDetail,
        backgroundAbilities,
        backgroundSkills,
        backgroundTools
      ),
    [draft.backgroundDetail, backgroundAbilities, backgroundSkills, backgroundTools]
  )

  const speciesDetailMeta = useMemo(
    () => buildSpeciesDetailMeta(draft.speciesDetail, creatorEdition),
    [draft.speciesDetail, creatorEdition]
  )

  const equipmentPlans = useMemo(
    () => [
      parseStartingEquipment(
        draft.classDetail,
        'class',
        draft.classEntry ? `${draft.classEntry.name} Starting Equipment` : 'Class Equipment'
      ),
      parseStartingEquipment(
        draft.backgroundDetail,
        'background',
        draft.backgroundEntry ? `${draft.backgroundEntry.name} Starting Equipment` : 'Background Equipment'
      )
    ],
    [draft.classDetail, draft.backgroundDetail, draft.classEntry, draft.backgroundEntry]
  )

  const resolvedInventory = useMemo(
    () =>
      resolveStartingInventory(
        equipmentPlans,
        draft.equipmentSelections,
        draft.equipmentFilterPicks
      ),
    [equipmentPlans, draft.equipmentSelections, draft.equipmentFilterPicks]
  )

  const selectEquipmentOption = (groupId: string, optionId: string) => {
    setDraft((d) => ({
      ...d,
      equipmentSelections: { ...d.equipmentSelections, [groupId]: optionId }
    }))
  }

  const toggleEquipmentFilterPick = (groupId: string, label: string) => {
    setDraft((d) => {
      const group = equipmentPlans.flatMap((plan) => plan.groups).find((entry) => entry.id === groupId)
      const max = group?.pickCount ?? 1
      const current = d.equipmentFilterPicks[groupId] ?? []
      const has = current.includes(label)
      const next = has
        ? current.filter((entry) => entry !== label)
        : current.length >= max
          ? current
          : [...current, label]
      return {
        ...d,
        equipmentFilterPicks: { ...d.equipmentFilterPicks, [groupId]: next }
      }
    })
  }

  const rollScorePool = () => ({
    rolledPool: Array.from({ length: 6 }, () => roll4d6DropLowest()),
    rollAssign: emptyRollAssign()
  })

  const applyScoreMethod = (method: ScoreMethod) => {
    setDraft((d) => {
      let baseScores = d.baseScores
      let rolledPool = d.rolledPool
      let rollAssign = d.rollAssign
      if (method === 'standard' && d.classEntry) {
        baseScores = suggestStandardArray(d.classEntry.name)
      } else if (method === 'pointbuy') {
        baseScores = defaultScores()
      } else if (method === 'roll') {
        const rolled = rollScorePool()
        rolledPool = rolled.rolledPool
        rollAssign = rolled.rollAssign
        baseScores = defaultScores()
      }
      return { ...d, scoreMethod: method, baseScores, rolledPool, rollAssign }
    })
  }

  const rollAllScores = () => {
    const rolled = rollScorePool()
    setDraft((d) => ({
      ...d,
      scoreMethod: 'roll',
      baseScores: defaultScores(),
      rolledPool: rolled.rolledPool,
      rollAssign: rolled.rollAssign
    }))
  }

  const assignRollIndex = (ability: Ability, poolIndex: number | null) => {
    setDraft((d) => ({
      ...d,
      rollAssign: { ...d.rollAssign, [ability]: poolIndex }
    }))
  }

  const adjustPointBuy = (ab: Ability, delta: number) => {
    setDraft((d) => {
      const next = Math.min(15, Math.max(8, d.baseScores[ab] + delta))
      const trial = { ...d.baseScores, [ab]: next }
      if (pointBuySpent(trial) > POINT_BUY_TOTAL) return d
      return { ...d, scoreMethod: 'pointbuy', baseScores: trial }
    })
  }

  const setManualScore = (ab: Ability, raw: string) => {
    setDraft((d) => {
      if (raw.trim() === '') {
        return { ...d, scoreMethod: 'manual' }
      }
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed)) return d
      const score = Math.min(MAX_ABILITY_SCORE, Math.max(MIN_ABILITY_SCORE, parsed))
      return {
        ...d,
        scoreMethod: 'manual',
        baseScores: { ...d.baseScores, [ab]: score }
      }
    })
  }

  const toggleClassSkill = (skill: string) => {
    if (!classSkillChoice) return
    setDraft((d) => {
      const has = d.classSkills.some((s) => isSkillInList(s, [skill]))
      if (has) {
        const nextClass = d.classSkills.filter((s) => !isSkillInList(s, [skill]))
        return {
          ...d,
          classSkills: nextClass,
          expertiseSkills: d.expertiseSkills.filter((s) => isSkillInList(s, [...allBackgroundSkills, ...nextClass]))
        }
      }
      if (d.classSkills.length >= classSkillChoice.count) return d
      return { ...d, classSkills: [...d.classSkills, skill] }
    })
  }

  const toggleExpertiseSkill = (skill: string) => {
    if (!expertiseCount) return
    setDraft((d) => {
      const has = d.expertiseSkills.some((s) => isSkillInList(s, [skill]))
      if (has) return { ...d, expertiseSkills: d.expertiseSkills.filter((s) => !isSkillInList(s, [skill])) }
      if (d.expertiseSkills.length >= expertiseCount) return d
      if (!isSkillInList(skill, allProficientSkills)) return d
      return { ...d, expertiseSkills: [...d.expertiseSkills, skill] }
    })
  }

  const setSpeciesAsiPick = (blockIdx: number, pickIdx: number, ability: Ability) => {
    setDraft((d) => {
      const next = d.speciesAsiPicks.map((block) => [...block])
      while (next.length <= blockIdx) next.push([])
      const block = [...(next[blockIdx] ?? [])]
      block[pickIdx] = ability
      next[blockIdx] = block
      return { ...d, speciesAsiPicks: next }
    })
  }

  const canProceed = (): boolean => {
    switch (step) {
      case CREATOR_STEP.CLASS:
        return !!draft.classEntry
      case CREATOR_STEP.SUBCLASS:
        if (!needsSubclass) return true
        return !!draft.subclassEntry
      case CREATOR_STEP.BACKGROUND:
        return !!draft.backgroundEntry
      case CREATOR_STEP.ORIGIN_FEAT: {
        if (!draft.originFeatRefs.length) return true
        return draft.originFeatRefs.every((ref) => {
          const sel = draft.originFeatSelections.find((s) => s.refId === ref.id)
          if (!sel) return false
          if (ref.type === 'category') {
            return isOriginFeatComplete([{ kind: 'category-feat' }], sel.choices, ref)
          }
          const detail = draft.featDetails[ref.id]
          if (!detail) return false
          return isOriginFeatComplete(analyzeFeatChoices(detail, ref.variant), sel.choices, ref)
        })
      }
      case CREATOR_STEP.SPECIES:
        return !!draft.speciesEntry
      case CREATOR_STEP.SPECIES_ASI:
        return speciesAsi ? validateSpeciesAsiPicks(speciesAsi, draft.speciesAsiPicks) : true
      case CREATOR_STEP.ABILITIES:
        if (draft.scoreMethod === 'pointbuy' && pointBuySpent(draft.baseScores) > POINT_BUY_TOTAL) {
          return false
        }
        if (
          draft.scoreMethod === 'roll' &&
          (!ABILITIES.every((ab) => draft.rollAssign[ab] != null) || draft.rolledPool.length !== 6)
        ) {
          return false
        }
        if (
          draft.scoreMethod === 'manual' &&
          !ABILITIES.every((ab) => isValidAbilityScore(draft.baseScores[ab]))
        ) {
          return false
        }
        if (
          creatorEdition === '2024' &&
          backgroundAbilities.length > 0 &&
          draft.boostMode === 'two-one' &&
          (!draft.boostPlusTwo || !draft.boostPlusOne || draft.boostPlusTwo === draft.boostPlusOne)
        ) {
          return false
        }
        return true
      case CREATOR_STEP.SKILLS: {
        const classOk = !classSkillChoice || draft.classSkills.length === classSkillChoice.count
        const expOk = !expertiseCount || draft.expertiseSkills.length === expertiseCount
        return classOk && expOk
      }
      case CREATOR_STEP.ALIGNMENT:
        return !!draft.alignment
      case CREATOR_STEP.EQUIPMENT:
        return equipmentPlans.every((plan) =>
          isEquipmentPlanComplete(plan, draft.equipmentSelections, draft.equipmentFilterPicks)
        )
      default:
        return true
    }
  }

  const handleSave = async () => {
    if (!draft.classEntry || !draft.backgroundEntry || !draft.speciesEntry || !draft.alignment) return
    if (needsSubclass && !draft.subclassEntry) return
    setSaveState('saving')
    const existing = savedId ? await window.handbook.characters.load(savedId) : null
    const originFeatLabel =
      draft.originFeatSelections.length > 0
        ? formatOriginFeatSummary(draft.originFeatSelections)
        : parseBackgroundFeat(draft.backgroundDetail ?? {})

    const character = buildSavedCharacter({
      id: savedId ?? undefined,
      name: draft.name,
      alignment: draft.alignment,
      creatorEdition,
      classEntry: { name: draft.classEntry.name, source: draft.classEntry.source },
      backgroundEntry: { name: draft.backgroundEntry.name, source: draft.backgroundEntry.source },
      speciesEntry: { name: draft.speciesEntry.name, source: draft.speciesEntry.source },
      originFeat: originFeatLabel,
      originFeatSelections: draft.originFeatSelections,
      originFeatDetails: draft.featDetails,
      scoreMethod: draft.scoreMethod,
      baseScores: effectiveBaseScores,
      finalScores,
      backgroundBoost: {
        mode: draft.boostMode,
        plusTwo: draft.boostPlusTwo ?? undefined,
        plusOne: draft.boostPlusOne ?? undefined
      },
      speciesAsiChoices:
        creatorEdition === '2014' && speciesAsi ? draft.speciesAsiPicks : undefined,
      backgroundSkills: allBackgroundSkills,
      classSkills: draft.classSkills,
      expertiseSkills: draft.expertiseSkills,
      tools: allTools,
      languages: mergedProficiencies.languages,
      weapons: mergedProficiencies.weapons,
      savingThrows,
      classDetail: draft.classDetail ?? {},
      enabledSources: sourceCodes,
      subclassEntry: draft.subclassEntry,
      inventory: resolvedInventory,
      existingSheet: existing?.sheet,
      createdAt: existing?.createdAt
    })
    const saved = await window.handbook.characters.save(character)
    setSavedId(saved.id)
    setSaveState('saved')
    sessionStorage.setItem('handbook-select-character', saved.id)
  }

  if (!hasData) {
    return (
      <div className="empty-state">
        <Dices size={48} />
        <h3>Data not ready</h3>
        <p>Open Settings and download 5e.tools data to start creating characters.</p>
      </div>
    )
  }

  const baseMaxHp =
    draft.classDetail && finalScores.con ? computeMaxHp(draft.classDetail, finalScores.con) : null
  const hasTough = draft.originFeatSelections.some((sel) => {
    const detail = draft.featDetails[sel.refId]
    return detail && featGrantsTough(mergeFeatVersion(detail, sel.variant))
  })
  const maxHp = baseMaxHp != null ? baseMaxHp + (hasTough ? 2 : 0) : null
  const ac = 10 + abilityModifier(finalScores.dex)
  const initiative = formatModifier(abilityModifier(finalScores.dex))
  const pp = passivePerception(
    finalScores,
    isSkillInList('perception', allProficientSkills),
    isSkillInList('perception', draft.expertiseSkills)
  )

  const showDetailPanel = step === CREATOR_STEP.BACKGROUND || step === CREATOR_STEP.SPECIES

  return (
    <div className="creator-page">
      <div className="creator-header">
        <h2 className="creator-title">Character Creator</h2>
        <p className="creator-subtitle">
          {creatorEdition === '2024' ? '2024 rules' : '2014 rules'} · class → background → origin feat → species → equipment
        </p>
      </div>

      <div className="edition-filter">
        <span className="source-filter-label">Rules edition</span>
        <div className="edition-tabs">
          <button
            type="button"
            className={`edition-tab ${creatorEdition === '2024' ? 'active' : ''}`}
            onClick={() => switchEdition('2024')}
          >
            5.5e / 2024
          </button>
          <button
            type="button"
            className={`edition-tab ${creatorEdition === '2014' ? 'active' : ''}`}
            onClick={() => switchEdition('2014')}
          >
            5e / 2014
          </button>
        </div>
      </div>

      <div className="source-filter">
        <span className="source-filter-label">Source books</span>
        <div className="source-filter-chips">
          {availableBooks.map((book) => (
            <button
              key={book.id}
              className={`source-chip ${enabledBooks.includes(book.id) ? 'active' : ''}`}
              onClick={() => toggleSourceBook(book.id)}
              title={book.provides.join(', ')}
            >
              {book.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`creator-layout ${showDetailPanel ? 'has-detail' : ''}`}>
        <CreatorPicksPanel
          draft={draft}
          step={step}
          finalScores={finalScores}
          creatorEdition={creatorEdition}
          speciesAsi={speciesAsi}
          backgroundSkills={allBackgroundSkills}
          backgroundTools={allTools}
          maxHp={maxHp}
          onJumpToStep={jumpToStep}
          needsSubclass={needsSubclass}
          speciesAsiStepNeeded={speciesAsiStepNeeded}
        />

        <div className="creator-main">
          <div className="creator-steps">
            {STEPS.map((label, i) => {
              const skipped = isCreatorStepSkipped(i, draft.classDetail, speciesAsiStepNeeded)
              return (
                <button
                  key={label}
                  type="button"
                  className={`step-item ${skipped ? 'step-skipped' : ''}`}
                  onClick={() => !skipped && i <= step && jumpToStep(i)}
                  disabled={i > step || skipped}
                >
                  <div className={`step-dot ${i <= step || skipped ? 'done' : ''}`} />
                  <span className={`step-label ${i === step ? 'active' : ''}`}>
                    {skipped ? `${label} (n/a)` : label}
                  </span>
                </button>
              )
            })}
          </div>

      {step === CREATOR_STEP.CLASS && (
        <div className="creator-card">
          <h2>Step 1: Choose Class</h2>
          <p>Your class defines combat role, proficiencies, and features.</p>
          <OptionGrid
            items={classes}
            selectedId={draft.classEntry?.id}
            onSelect={(e) => void selectClass(e)}
            searchPlaceholder="Search classes…"
          />
          <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed()} />
        </div>
      )}

      {step === CREATOR_STEP.SUBCLASS && needsSubclass && (
        <SubclassStep
          subclasses={draft.availableSubclasses}
          selectedEntry={draft.subclassEntry}
          step={step}
          navigateStep={navigateStep}
          canProceed={canProceed()}
          onSelect={selectSubclass}
        />
      )}

      {step === CREATOR_STEP.BACKGROUND && (
        <PickerStep
          title="Step 3: Choose Background"
          description="Background provides ability boosts, an Origin feat, skills, tools, and equipment."
          items={backgrounds}
          selectedId={draft.backgroundEntry?.id}
          onSelect={(e) => void selectBackground(e)}
          searchPlaceholder="Search backgrounds…"
          step={step}
          navigateStep={navigateStep}
          canProceed={canProceed()}
        />
      )}

      {step === CREATOR_STEP.ORIGIN_FEAT && (
        <OriginFeatStep
          refs={draft.originFeatRefs}
          selections={draft.originFeatSelections}
          featDetails={draft.featDetails}
          categoryFeats={categoryFeats}
          sourceCodes={sourceCodes}
          creatorEdition={creatorEdition}
          step={step}
          navigateStep={navigateStep}
          canProceed={canProceed()}
          onSelectionsChange={(originFeatSelections) =>
            setDraft((d) => ({ ...d, originFeatSelections }))
          }
        />
      )}

      {step === CREATOR_STEP.SPECIES && (
        <PickerStep
          title="Step 5: Choose Species"
          description={
            <>
              {creatorEdition === '2024' ? (
                <>
                  Species sets size, speed, and traits. Ability increases come from your background.
                </>
              ) : (
                <>
                  Species sets size, speed, traits, and ability score increases (applied on the next
                  steps).
                </>
              )}
              {species.length > 0 && (
                <span className="species-count"> {species.length} species available.</span>
              )}
            </>
          }
          hint={
            !enabledBooks.includes('legacy-species') &&
            !enabledBooks.some((id) => ['mpmm', 'vgm', 'erlw', 'eepc'].includes(id)) ? (
              <p className="hint-text species-hint">
                Enable <strong>Legacy &amp; Supplemental Species</strong> or individual books like{' '}
                <strong>Monsters of the Multiverse</strong> for Tabaxi, Aarakocra, Firbolg, and 80+
                more. Search by species or book name (e.g. &ldquo;MPMM&rdquo;). For Lorwyn,
                Ravenloft, or 2024 Eberron species, enable those source books above.
              </p>
            ) : !enabledBooks.some((id) => ['lfl', 'rhw', 'efa'].includes(id)) ? (
              <p className="hint-text species-hint">
                Enable <strong>Lorwyn</strong>, <strong>Ravenloft</strong>, or{' '}
                <strong>Eberron (2024)</strong> source books above for those setting-specific species.
              </p>
            ) : undefined
          }
          items={species}
          selectedId={draft.speciesEntry?.id}
          onSelect={(e) => void selectSpecies(e)}
          searchPlaceholder="Search species…"
          step={step}
          navigateStep={navigateStep}
          canProceed={canProceed()}
        />
      )}

      {step === CREATOR_STEP.SPECIES_ASI && speciesAsi && (
        <div className="creator-card">
          <h2>Species Ability Score Increases</h2>
          <p className="hint-text">
            Your species grants{' '}
            <strong>{formatSpeciesAsiSummary(speciesAsi)}</strong>. Choose where the flexible
            bonuses go.
          </p>
          {Object.keys(speciesAsi.fixed).length > 0 && (
            <div className="species-asi-fixed">
              <span className="chip-label">Fixed increases:</span>
              {ABILITIES.filter((ab) => speciesAsi.fixed[ab]).map((ab) => (
                <span key={ab} className="summary-chip proficient">
                  {speciesAsi.fixed[ab]! > 0 ? '+' : ''}
                  {speciesAsi.fixed[ab]} {ABILITY_NAMES[ab]}
                </span>
              ))}
            </div>
          )}
          {speciesAsi.choices.map((choice, blockIdx) => (
            <div key={blockIdx} className="boost-section species-asi-section">
              <h3>
                {choice.count === 1 && choice.amountPerPick > 1
                  ? `+${choice.amountPerPick} to one ability`
                  : `+${choice.amountPerPick} to ${choice.count} abilities`}
              </h3>
              <div className="boost-pickers">
                {Array.from({ length: choice.count }).map((_, pickIdx) => {
                  const selected = draft.speciesAsiPicks[blockIdx]?.[pickIdx]
                  const usedElsewhere = new Set(
                    (draft.speciesAsiPicks[blockIdx] ?? []).filter((_, i) => i !== pickIdx)
                  )
                  return (
                    <div key={pickIdx} className="picker-group">
                      <label>
                        {choice.count > 1 ? `Pick ${pickIdx + 1}` : 'Choose'}
                      </label>
                      <select
                        value={selected ?? ''}
                        onChange={(e) => {
                          if (!e.target.value) return
                          setSpeciesAsiPick(blockIdx, pickIdx, e.target.value as Ability)
                        }}
                      >
                        <option value="">Select…</option>
                        {choice.from
                          .filter((ab) => !usedElsewhere.has(ab) || ab === selected)
                          .map((ab) => (
                            <option key={ab} value={ab}>
                              {ABILITY_NAMES[ab]}
                            </option>
                          ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed()} />
        </div>
      )}

      {step === CREATOR_STEP.ABILITIES && (
        <div className="creator-card">
          <h2>Ability Scores</h2>
          <p>
            {creatorEdition === '2024'
              ? 'Generate base scores, then apply your background\u2019s ability increases.'
              : 'Generate base scores. Species increases are applied automatically in your final scores.'}
          </p>
          <div className="method-tabs">
            {(['standard', 'pointbuy', 'roll', 'manual'] as ScoreMethod[]).map((m) => (
              <button
                key={m}
                className={`method-tab ${draft.scoreMethod === m ? 'active' : ''}`}
                onClick={() => applyScoreMethod(m)}
              >
                {m === 'standard'
                  ? 'Standard Array'
                  : m === 'pointbuy'
                    ? 'Point Buy'
                    : m === 'roll'
                      ? 'Roll 4d6'
                      : 'Manual'}
              </button>
            ))}
          </div>
          {draft.scoreMethod === 'standard' && draft.classEntry && (
            <p className="hint-text">
              Suggested for {draft.classEntry.name}: {STANDARD_ARRAY.join(', ')}
            </p>
          )}
          {draft.scoreMethod === 'pointbuy' && (
            <p className="hint-text">
              Points spent: {pointBuySpent(draft.baseScores)} / {POINT_BUY_TOTAL}
            </p>
          )}
          {draft.scoreMethod === 'roll' && (
            <>
              <p className="hint-text">
                Roll six scores, then assign each one to any ability. Each roll can only be used once.
              </p>
              <div className="roll-pool">
                {draft.rolledPool.map((value, idx) => {
                  const usedBy = ABILITIES.find((ab) => draft.rollAssign[ab] === idx)
                  return (
                    <span
                      key={idx}
                      className={`roll-chip ${usedBy ? 'assigned' : 'available'}`}
                      title={usedBy ? `Assigned to ${ABILITY_NAMES[usedBy]}` : 'Unassigned'}
                    >
                      {value}
                    </span>
                  )
                })}
              </div>
              <button className="btn-secondary roll-reroll-btn" onClick={rollAllScores}>
                <Dices size={16} /> Re-roll All
              </button>
            </>
          )}
          {draft.scoreMethod === 'manual' && (
            <p className="hint-text">
              Type each base ability score ({MIN_ABILITY_SCORE}–{MAX_ABILITY_SCORE}).
              {creatorEdition === '2024'
                ? ' Background increases are applied after.'
                : ' Species increases are shown in final scores below.'}
            </p>
          )}
          {creatorEdition === '2014' && speciesAsi && speciesAsiHasBonuses(speciesAsi) && (
            <div className="species-asi-fixed abilities-asi-summary">
              <span className="chip-label">Species increases:</span>
              <span className="hint-text">
                {formatSpeciesAsiSummary(speciesAsi, draft.speciesAsiPicks)}
              </span>
            </div>
          )}
          <div className="ability-scores">
            {ABILITIES.map((ab) => {
              const baseScore =
                draft.scoreMethod === 'roll' ? effectiveBaseScores[ab] : draft.baseScores[ab]
              const rollIdx = draft.rollAssign[ab]
              const unassignedRoll = draft.scoreMethod === 'roll' && rollIdx == null
              return (
                <div key={ab} className={`ability-box ${unassignedRoll ? 'unassigned' : ''}`}>
                  <div className="label">{ABILITY_LABELS[ab]}</div>
                  {draft.scoreMethod === 'pointbuy' ? (
                    <div className="pointbuy-controls">
                      <button onClick={() => adjustPointBuy(ab, -1)} disabled={draft.baseScores[ab] <= 8}>−</button>
                      <div className="score">{draft.baseScores[ab]}</div>
                      <button onClick={() => adjustPointBuy(ab, 1)} disabled={draft.baseScores[ab] >= 15}>+</button>
                    </div>
                  ) : draft.scoreMethod === 'manual' ? (
                    <input
                      type="number"
                      className="ability-score-input"
                      min={MIN_ABILITY_SCORE}
                      max={MAX_ABILITY_SCORE}
                      value={draft.baseScores[ab]}
                      onChange={(e) => setManualScore(ab, e.target.value)}
                      aria-label={`${ABILITY_NAMES[ab]} score`}
                    />
                  ) : draft.scoreMethod === 'roll' ? (
                    <>
                      <select
                        className="roll-assign-select"
                        value={rollIdx ?? ''}
                        onChange={(e) =>
                          assignRollIndex(ab, e.target.value === '' ? null : Number(e.target.value))
                        }
                      >
                        <option value="">Assign roll…</option>
                        {draft.rolledPool.map((value, idx) => (
                          <option
                            key={idx}
                            value={idx}
                            disabled={isPoolIndexUsed(draft.rollAssign, idx, ab)}
                          >
                            {value}
                          </option>
                        ))}
                      </select>
                      <div className="score">{unassignedRoll ? '—' : baseScore}</div>
                    </>
                  ) : (
                    <div className="score">{baseScore}</div>
                  )}
                  <div className="mod">
                    {unassignedRoll ? '—' : formatModifier(abilityModifier(baseScore))}
                  </div>
                </div>
              )
            })}
          </div>
          {creatorEdition === '2024' && backgroundAbilities.length > 0 && (
            <div className="boost-section">
              <h3>Background Ability Increases</h3>
              <div className="boost-options">
                <label className={`boost-option ${draft.boostMode === 'two-one' ? 'selected' : ''}`}>
                  <input type="radio" checked={draft.boostMode === 'two-one'} onChange={() => setDraft((d) => ({ ...d, boostMode: 'two-one' }))} />
                  +2 to one ability, +1 to another
                </label>
                <label className={`boost-option ${draft.boostMode === 'all-one' ? 'selected' : ''}`}>
                  <input type="radio" checked={draft.boostMode === 'all-one'} onChange={() => setDraft((d) => ({ ...d, boostMode: 'all-one' }))} />
                  +1 to all three ({backgroundAbilities.map((a) => ABILITY_LABELS[a]).join(', ')})
                </label>
              </div>
              {draft.boostMode === 'two-one' && (
                <div className="boost-pickers">
                  <div className="picker-group">
                    <label>+2 to</label>
                    <select value={draft.boostPlusTwo ?? ''} onChange={(e) => setDraft((d) => ({ ...d, boostPlusTwo: e.target.value as Ability }))}>
                      {backgroundAbilities.map((a) => (
                        <option key={a} value={a}>{ABILITY_NAMES[a]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="picker-group">
                    <label>+1 to</label>
                    <select value={draft.boostPlusOne ?? ''} onChange={(e) => setDraft((d) => ({ ...d, boostPlusOne: e.target.value as Ability }))}>
                      {backgroundAbilities.filter((a) => a !== draft.boostPlusTwo).map((a) => (
                        <option key={a} value={a}>{ABILITY_NAMES[a]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
          <h3 className="section-heading">Final Scores</h3>
          <div className="ability-scores">
            {ABILITIES.map((ab) => {
              const speciesBonus =
                creatorEdition === '2014' && speciesAsi
                  ? getSpeciesAsiBonusForAbility(ab, speciesAsi, draft.speciesAsiPicks)
                  : 0
              const baseScore = effectiveBaseScores[ab]
              return (
                <div key={ab} className="ability-box final">
                  <div className="label">{ABILITY_LABELS[ab]}</div>
                  <div className="score">{finalScores[ab]}</div>
                  <div className="mod">{formatModifier(abilityModifier(finalScores[ab]))}</div>
                  {speciesBonus > 0 && (
                    <div className="ability-bonus-hint">
                      {baseScore} base +{speciesBonus} species
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed()} />
        </div>
      )}

      {step === CREATOR_STEP.SKILLS && (
        <div className="creator-card">
          <h2>Step 7: Skill Proficiencies</h2>
          {allBackgroundSkills.length > 0 && (
            <div className="chip-row">
              <span className="chip-label">From background &amp; feats (locked):</span>
              {allBackgroundSkills.map((s) => (
                <span key={s} className="summary-chip proficient">{formatSkillName(s)}</span>
              ))}
            </div>
          )}
          {classSkillChoice ? (
            <>
              <p>
                Choose {classSkillChoice.count} class skill{classSkillChoice.count > 1 ? 's' : ''} (
                {draft.classSkills.length}/{classSkillChoice.count}). Skills already granted by your
                background cannot be chosen again — they don&apos;t stack unless you have Expertise.
              </p>
              {blockedClassSkills.length > 0 && (
                <p className="hint-text">
                  Unavailable (from background): {blockedClassSkills.map(formatSkillName).join(', ')}
                </p>
              )}
              <div className="skill-grid">
                {selectableClassSkills.map((skill) => {
                  const selected = draft.classSkills.some((s) => isSkillInList(s, [skill]))
                  const disabled = !selected && draft.classSkills.length >= classSkillChoice.count
                  return (
                    <button key={skill} className={`skill-chip ${selected ? 'selected' : ''}`} disabled={disabled} onClick={() => toggleClassSkill(skill)}>
                      {formatSkillName(skill)}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p>No class skill choices for this class.</p>
          )}
          {expertiseCount > 0 && (
            <div className="expertise-section">
              <h3>Expertise</h3>
              <p className="hint-text">
                Expertise doubles your Proficiency Bonus on that skill. Choose {expertiseCount} skills
                you are already proficient in ({draft.expertiseSkills.length}/{expertiseCount} selected).
                Background skills count — e.g. a Rogue can take Expertise in a background skill.
              </p>
              <div className="skill-grid">
                {allProficientSkills.map((skill) => {
                  const selected = draft.expertiseSkills.some((s) => isSkillInList(s, [skill]))
                  const disabled = !selected && draft.expertiseSkills.length >= expertiseCount
                  return (
                    <button key={skill} className={`skill-chip expertise ${selected ? 'selected' : ''}`} disabled={disabled} onClick={() => toggleExpertiseSkill(skill)}>
                      {formatSkillName(skill)} ★
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed()} />
        </div>
      )}

      {step === CREATOR_STEP.ALIGNMENT && (
        <div className="creator-card">
          <h2>Step 8: Alignment</h2>
          <p>Choose your character&apos;s moral compass.</p>
          <div className="alignment-grid">
            {ALIGNMENTS.map((a) => (
              <button key={a} className={`alignment-chip ${draft.alignment === a ? 'selected' : ''}`} onClick={() => setDraft((d) => ({ ...d, alignment: a }))}>
                {a}
              </button>
            ))}
          </div>
          <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed()} />
        </div>
      )}

      {step === CREATOR_STEP.EQUIPMENT && (
        <EquipmentStep
          plans={equipmentPlans}
          selections={draft.equipmentSelections}
          filterPicks={draft.equipmentFilterPicks}
          inventoryPreview={resolvedInventory.items}
          goldCp={resolvedInventory.goldCp}
          step={step}
          navigateStep={navigateStep}
          canProceed={canProceed()}
          onSelectOption={selectEquipmentOption}
          onToggleFilterPick={toggleEquipmentFilterPick}
        />
      )}

      {step === CREATOR_STEP.SUMMARY && (
        <div className="creator-card">
          <h2>Character Summary</h2>
          <div className="summary-card">
            <input className="search-input" placeholder="Character name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={{ marginBottom: 12, width: '100%' }} />
            <h3>{draft.name || 'Unnamed Hero'}</h3>
            <p className="summary-line">Level 1 {draft.speciesEntry?.name} {draft.classEntry?.name}{draft.subclassEntry ? ` (${draft.subclassEntry.name})` : ''} · {draft.alignment}</p>
            <p className="summary-line muted">{draft.backgroundEntry?.name} ({draft.backgroundEntry?.source}) · {formatOriginFeatSummary(draft.originFeatSelections.length ? draft.originFeatSelections : []) || parseBackgroundFeat(draft.backgroundDetail ?? {})}</p>
            {creatorEdition === '2014' && speciesAsi && speciesAsiHasBonuses(speciesAsi) && (
              <p className="summary-line muted">
                Species ASI: {formatSpeciesAsiSummary(speciesAsi, draft.speciesAsiPicks)}
              </p>
            )}
            <div className="summary-section">
              <h4>Ability Scores</h4>
              <div className="summary-row">
                {ABILITIES.map((ab) => (
                  <div key={ab} className="summary-chip">{ABILITY_LABELS[ab]} {finalScores[ab]} ({formatModifier(abilityModifier(finalScores[ab]))})</div>
                ))}
              </div>
            </div>
            <div className="summary-section">
              <h4>Combat Stats</h4>
              <div className="summary-row">
                <div className="summary-chip">HP {maxHp ?? '—'}</div>
                <div className="summary-chip">AC {ac}</div>
                <div className="summary-chip">Initiative {initiative}</div>
                <div className="summary-chip">Proficiency +{PROFICIENCY_BONUS}</div>
                {draft.classDetail && <div className="summary-chip">Hit Die d{getHitDieFaces(draft.classDetail)}</div>}
              </div>
            </div>
            <div className="summary-section">
              <h4>Saving Throws</h4>
              <div className="summary-row">
                {savingThrows.map((ab) => (
                  <div key={ab} className="summary-chip proficient">{ABILITY_NAMES[ab]} {formatModifier(abilityModifier(finalScores[ab]) + PROFICIENCY_BONUS)}</div>
                ))}
              </div>
            </div>
            <div className="summary-section">
              <h4>Skills</h4>
              <div className="skill-summary-grid">
                {Object.keys(SKILL_TO_ABILITY).sort().map((skill) => {
                  const proficient = isSkillInList(skill, allProficientSkills)
                  const hasExpertise = isSkillInList(skill, draft.expertiseSkills)
                  const mod = skillModifier(skill, finalScores, proficient, hasExpertise)
                  return (
                    <div key={skill} className={`skill-line ${proficient ? 'proficient' : ''} ${hasExpertise ? 'expertise' : ''}`}>
                      <span>{formatSkillName(skill)}{hasExpertise ? ' ★' : ''}</span>
                      <span>{formatModifier(mod)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="summary-row" style={{ marginTop: 12 }}>
                <div className="summary-chip">Passive Perception {pp}</div>
              </div>
            </div>
            {resolvedInventory.items.length > 0 && (
              <div className="summary-section">
                <h4>Starting Equipment</h4>
                <div className="summary-row">
                  {resolvedInventory.items.map((item) => (
                    <div key={item.label} className="summary-chip">
                      {item.quantity > 1 ? `${item.quantity}× ` : ''}
                      {item.label}
                    </div>
                  ))}
                  {resolvedInventory.goldCp > 0 && (
                    <div className="summary-chip">{resolvedInventory.goldCp / 100} GP</div>
                  )}
                </div>
              </div>
            )}
            {allTools.length > 0 && (
              <div className="summary-section">
                <h4>Tool Proficiencies</h4>
                <div className="summary-row">
                  {allTools.map((t) => (
                    <div key={t} className="summary-chip">{formatSkillName(t)}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="creator-actions" style={{ marginTop: 24 }}>
            <button className="btn-secondary" onClick={() => jumpToStep(CREATOR_STEP.EQUIPMENT)}><ChevronLeft size={16} /> Back</button>
            <div className="creator-actions-right">
              <button className="btn-primary" style={{ width: 'auto' }} onClick={() => void handleSave()} disabled={saveState === 'saving'}>
                {saveState === 'saved' ? <Check size={16} /> : <Save size={16} />}
                {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save Character'}
              </button>
              {saveState === 'saved' && (
                <p className="hint-text" style={{ marginTop: 12 }}>
                  Character saved. Open <strong>Characters</strong> to view the sheet — your hero will
                  be selected automatically.
                </p>
              )}
              <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => { setDraft(emptyDraft()); setStep(0); setSaveState('idle'); setSavedId(null) }}>
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}
        </div>

        {step === CREATOR_STEP.BACKGROUND && (
          <CreatorDetailPanel
            title={draft.backgroundEntry?.name}
            subtitle={draft.backgroundEntry?.sourceName ?? draft.backgroundEntry?.source}
            meta={backgroundDetailMeta}
            detail={draft.backgroundDetail}
          />
        )}

        {step === CREATOR_STEP.SPECIES && (
          <CreatorDetailPanel
            title={draft.speciesEntry?.name}
            subtitle={draft.speciesEntry?.sourceName ?? draft.speciesEntry?.source}
            meta={speciesDetailMeta}
            detail={draft.speciesDetail}
          />
        )}
      </div>
    </div>
  )
}

function NavButtons({
  step,
  navigateStep,
  canProceed
}: {
  step: number
  navigateStep: (direction: 1 | -1) => void
  canProceed: boolean
}) {
  return (
    <div className="creator-actions">
      <button className="btn-secondary" disabled={step === 0} onClick={() => navigateStep(-1)}><ChevronLeft size={16} /> Back</button>
      <button className="btn-primary" style={{ width: 'auto' }} disabled={!canProceed} onClick={() => navigateStep(1)}>Next <ChevronRight size={16} /></button>
    </div>
  )
}
