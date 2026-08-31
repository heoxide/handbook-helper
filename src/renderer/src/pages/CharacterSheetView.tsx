import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Trash2,
  Moon,
  Coffee,
  Zap,
  Plus,
  X,
  ArrowUpCircle,
  Sparkles
} from 'lucide-react'
import type { SavedCharacter } from '../../../shared/character'
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_NAMES,
  formatModifier,
  formatSkillName,
  isSkillInList,
  skillModifier,
  SKILL_TO_ABILITY,
  abilityModifier
} from '../../../shared/character'
import type { ClassBundle, ClassFeatureEntry, ClassSpellSubclassRef, SubclassOption } from '../../../shared/class-mechanics'
import {
  getFeaturesForLevel,
  getMaxCastableSpellLevel,
  getMysticArcanumLimit,
  getOptionalFeatureProgression,
  getSubclassDetail,
  hasSpellcasting,
  isPactCaster,
  optionalFeatureMatchesTypes,
  parseClassTable,
  proficiencyBonus,
  resolveEffectiveClassDetail,
  spellcastingAbility
} from '../../../shared/class-mechanics'
import type { CharacterSheetState } from '../../../shared/character-sheet'
import {
  buildInitialSheetState,
  classUsesKnownSpells,
  classUsesPreparedSpells,
  getCantripLimit,
  getKnownLimit,
  getPreparedLimit,
  longRest,
  pruneSpellsAboveMaxLevel,
  shortRest,
  spendResource,
  spendSpellSlot,
  syncSheetWithLevel
} from '../../../shared/character-sheet'
import {
  availableSlotLevels,
  getUpcastPreview
} from '../../../shared/spell-casting'
import type { EntityRef } from '../../../shared/class-mechanics'
import { EntryDescription } from '../components/EntryDescription'
import { LevelUpModal } from '../components/LevelUpModal'
import { SheetBoard, SheetPanelHead, SheetPanelTitle } from '../components/SheetBoard'
import {
  layoutItemsEqual,
  resolveSheetLayout,
  type SheetPanelId,
  type SheetPanelLayout
} from '../../../shared/sheet-layout'

interface SpellOption {
  name: string
  source: string
  level: number
}

function emptySheet(character: SavedCharacter): CharacterSheetState {
  return {
    hp: { current: character.combat.maxHp, max: character.combat.maxHp },
    spellSlots: {},
    resourcePools: {},
    cantrips: [],
    preparedSpells: [],
    knownSpells: [],
    mysticArcanum: [],
    arcanumUsed: [],
    optionalFeatures: [],
    concentration: null
  }
}

/** Sheets saved before a field existed come back without it, so backfill every collection. */
function resolveSheet(character: SavedCharacter): CharacterSheetState {
  const base = emptySheet(character)
  const saved = character.sheet
  if (!saved?.hp) return base

  return {
    ...base,
    ...saved,
    spellSlots: saved.spellSlots ?? base.spellSlots,
    resourcePools: saved.resourcePools ?? base.resourcePools,
    cantrips: saved.cantrips ?? [],
    preparedSpells: saved.preparedSpells ?? [],
    knownSpells: saved.knownSpells ?? [],
    mysticArcanum: saved.mysticArcanum ?? [],
    arcanumUsed: saved.arcanumUsed ?? [],
    optionalFeatures: saved.optionalFeatures ?? [],
    concentration: saved.concentration ?? null
  }
}

function hasSheetProgress(sheet: CharacterSheetState | undefined): boolean {
  if (!sheet?.hp) return false
  return (
    Object.keys(sheet.spellSlots).length > 0 ||
    Object.keys(sheet.resourcePools).length > 0 ||
    sheet.cantrips.length > 0 ||
    sheet.preparedSpells.length > 0 ||
    sheet.knownSpells.length > 0 ||
    (sheet.mysticArcanum?.length ?? 0) > 0
  )
}

export function CharacterSheetView({
  character: initial,
  onDelete,
  onSaved
}: {
  character: SavedCharacter
  onDelete: () => void
  onSaved: (c: SavedCharacter) => void
}) {
  const [character, setCharacter] = useState(initial)
  const [sheet, setSheet] = useState<CharacterSheetState>(() => resolveSheet(initial))
  const [bundle, setBundle] = useState<ClassBundle | null>(null)
  const [classDetail, setClassDetail] = useState<Record<string, unknown> | null>(null)
  const [subclasses, setSubclasses] = useState<SubclassOption[]>([])
  const [features, setFeatures] = useState<ClassFeatureEntry[]>([])
  const [classSpells, setClassSpells] = useState<SpellOption[]>([])
  const [optionalPool, setOptionalPool] = useState<Record<string, unknown>[]>([])
  const [cantripPickerOpen, setCantripPickerOpen] = useState(false)
  const [knownPickerOpen, setKnownPickerOpen] = useState(false)
  const [prepareModalOpen, setPrepareModalOpen] = useState(false)
  const [castTarget, setCastTarget] = useState<EntityRef | null>(null)
  const [castSlotLevel, setCastSlotLevel] = useState<number>(1)
  const [castPreview, setCastPreview] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [levelUpOptionalPool, setLevelUpOptionalPool] = useState<Record<string, unknown>[]>([])

  const [arcanumPickerOpen, setArcanumPickerOpen] = useState(false)

  const effectiveClassDetail = useMemo(() => {
    if (!classDetail || !bundle) return null
    const sub = character.subclass
    const subclassDetail = sub
      ? getSubclassDetail(bundle, { name: sub.name, source: sub.source })
      : undefined
    return resolveEffectiveClassDetail(classDetail, subclassDetail ?? null)
  }, [classDetail, bundle, character.subclass])

  const table = useMemo(
    () =>
      effectiveClassDetail
        ? parseClassTable(effectiveClassDetail, character.level, {
            abilityScores: character.abilityScores
          })
        : null,
    [effectiveClassDetail, character.level, character.abilityScores]
  )

  const spellcastingAb = useMemo(
    () => (effectiveClassDetail ? spellcastingAbility(effectiveClassDetail) : null),
    [effectiveClassDetail]
  )

  const usesPrepared = useMemo(
    () =>
      effectiveClassDetail
        ? classUsesPreparedSpells(
            effectiveClassDetail,
            character.level,
            character.abilityScores
          )
        : false,
    [effectiveClassDetail, character.level, character.abilityScores]
  )

  const usesKnown = useMemo(
    () =>
      effectiveClassDetail
        ? classUsesKnownSpells(effectiveClassDetail, character.level, character.abilityScores)
        : false,
    [effectiveClassDetail, character.level, character.abilityScores]
  )

  const mysticArcanumLimit = table ? getMysticArcanumLimit(table) : 0
  const maxCastableSpellLevel = table ? getMaxCastableSpellLevel(table) : 0

  const castableClassSpells = useMemo(
    () =>
      classSpells.filter(
        (spell) => spell.level === 0 || spell.level <= maxCastableSpellLevel
      ),
    [classSpells, maxCastableSpellLevel]
  )

  const subclassRef = character.subclass ?? null

  const loadClassData = useCallback(async () => {
    const b = await window.handbook.data.getClassBundle(character.class.name, character.class.source)
    if (!b) return
    setBundle(b)
    const detail = b.class.find(
      (c) => c.name === character.class.name && c.source === character.class.source
    ) as Record<string, unknown> | undefined
    if (!detail) return
    setClassDetail(detail)
    setSubclasses(
      b.subclass
        .filter(
          (s) =>
            s.className === character.class.name &&
            s.classSource === character.class.source &&
            !s._copy
        )
        .map((s) => ({
          name: String(s.name),
          shortName: String(s.shortName ?? s.name),
          source: String(s.source),
          className: String(s.className),
          classSource: String(s.classSource)
        }))
    )

    const initialSheet = hasSheetProgress(character.sheet)
      ? resolveSheet(character)
      : {
          ...buildInitialSheetState(
            character,
            resolveEffectiveClassDetail(
              detail,
              character.subclass
                ? getSubclassDetail(b, {
                    name: character.subclass.name,
                    source: character.subclass.source
                  }) ?? null
                : null
            )
          ),
          // A rebuilt sheet must not throw away how the user arranged their panels.
          panelLayout: character.sheet?.panelLayout
        }
    setSheet(initialSheet)

    const sub = character.subclass
      ? {
          name: character.subclass.name,
          shortName: character.subclass.name,
          source: character.subclass.source,
          className: character.class.name,
          classSource: character.class.source
        }
      : null
    setFeatures(getFeaturesForLevel(b, detail, character.level, sub))

    const effective = resolveEffectiveClassDetail(
      detail,
      sub ? getSubclassDetail(b, { name: sub.name, source: sub.source }) ?? null : null
    )

    if (hasSpellcasting(effective)) {
      try {
        const subclassRef: ClassSpellSubclassRef | undefined = character.subclass
          ? {
              name: character.subclass.name,
              className: character.class.name,
              classSource: character.class.source
            }
          : undefined
        const spells = await window.handbook.data.getClassSpells(
          character.class.name,
          character.enabledSources ?? [],
          character.creatorEdition ?? '2024',
          subclassRef
        )
        setClassSpells(spells)
      } catch (err) {
        console.error('Failed to load class spells', err)
        setClassSpells([])
      }
    } else {
      setClassSpells([])
    }

    const optProg = getOptionalFeatureProgression(detail, character.level)
    if (optProg.length) {
      const types = [...new Set(optProg.flatMap((p) => p.featureTypes))]
      setOptionalPool(await window.handbook.data.getOptionalFeatures(types))
    }
  }, [character])

  useEffect(() => {
    void loadClassData()
  }, [loadClassData])

  const persist = async (next: SavedCharacter, nextSheet: CharacterSheetState) => {
    setSaving(true)
    const updated: SavedCharacter = {
      ...next,
      version: 2,
      sheet: nextSheet,
      combat: {
        ...next.combat,
        maxHp: nextSheet.hp.max,
        proficiencyBonus: proficiencyBonus(next.level)
      },
      updatedAt: new Date().toISOString()
    }
    await window.handbook.characters.save(updated)
    setCharacter(updated)
    setSheet(nextSheet)
    onSaved(updated)
    setSaving(false)
  }

  useEffect(() => {
    if (!table || classSpells.length === 0) return
    const levelMap = new Map(
      classSpells.map((s) => [`${s.name}|${s.source.toUpperCase()}`, s.level])
    )
    const hasInvalid = [...sheet.preparedSpells, ...sheet.knownSpells].some((ref) => {
      const level = levelMap.get(`${ref.name}|${ref.source.toUpperCase()}`)
      return level !== undefined && level > 0 && level > maxCastableSpellLevel
    })
    if (!hasInvalid) return
    const pruned = pruneSpellsAboveMaxLevel(sheet, levelMap, maxCastableSpellLevel)
    void persist(character, pruned)
  }, [
    table,
    classSpells,
    maxCastableSpellLevel,
    character,
    sheet.preparedSpells,
    sheet.knownSpells
  ])

  const openLevelUp = async () => {
    if (!classDetail || !bundle || character.level >= 20) return
    const nextLevel = character.level + 1
    const optProg = getOptionalFeatureProgression(classDetail, nextLevel)
    if (optProg.length) {
      const types = [...new Set(optProg.flatMap((p) => p.featureTypes))]
      setLevelUpOptionalPool(await window.handbook.data.getOptionalFeatures(types))
    } else {
      setLevelUpOptionalPool(optionalPool)
    }
    setLevelUpOpen(true)
  }

  const confirmLevelUp = async (result: { character: SavedCharacter; sheet: CharacterSheetState }) => {
    const { character: nextChar, sheet: nextSheet } = result
    if (bundle && classDetail) {
      const sub = nextChar.subclass
        ? {
            name: nextChar.subclass.name,
            shortName: nextChar.subclass.name,
            source: nextChar.subclass.source,
            className: nextChar.class.name,
            classSource: nextChar.class.source
          }
        : null
      setFeatures(getFeaturesForLevel(bundle, classDetail, nextChar.level, sub))
    }
    await persist(nextChar, nextSheet)
    setLevelUpOpen(false)
  }

  const handleShortRest = () => {
    const next = shortRest(sheet, effectiveClassDetail ?? undefined)
    void persist(character, next)
  }

  const handleLongRest = () => {
    if (!effectiveClassDetail) return
    const next = longRest(
      sheet,
      effectiveClassDetail,
      character.level,
      character.abilityScores
    )
    void persist(character, next)
  }

  const toggleSpell = (
    spell: SpellOption,
    list: 'cantrip' | 'prepared' | 'known' | 'arcanum'
  ) => {
    const ref = { name: spell.name, source: spell.source }
    const key =
      list === 'cantrip'
        ? 'cantrips'
        : list === 'known'
          ? 'knownSpells'
          : list === 'arcanum'
            ? 'mysticArcanum'
            : 'preparedSpells'
    const current = sheet[key]
    const exists = current.some((s) => s.name === ref.name && s.source === ref.source)
    let nextList: EntityRef[]
    if (exists) {
      nextList = current.filter((s) => !(s.name === ref.name && s.source === ref.source))
    } else {
      if (
        (list === 'prepared' || list === 'known') &&
        spell.level > maxCastableSpellLevel
      ) {
        return
      }
      let limit: number
      if (list === 'cantrip') {
        limit = getCantripLimit(table!)
      } else if (list === 'known') {
        limit = getKnownLimit(table!)
      } else if (list === 'arcanum') {
        const maxAtLevel = table?.mysticArcanum[spell.level] ?? 0
        if (maxAtLevel === 0) return
        const atLevel = current.filter((s) => {
          const info = classSpells.find(
            (c) => c.name === s.name && c.source === s.source
          )
          return (info?.level ?? 0) === spell.level
        }).length
        if (atLevel >= maxAtLevel) return
        limit = mysticArcanumLimit
      } else {
        limit = getPreparedLimit(table!)
      }
      if (current.length >= limit) {
        return
      }
      nextList = [...current, ref]
    }
    void persist(character, { ...sheet, [key]: nextList })
  }

  const arcanumUnlockedLevels = useMemo(
    () =>
      table
        ? Object.entries(table.mysticArcanum)
            .filter(([, count]) => count > 0)
            .map(([lvl]) => Number(lvl))
        : [],
    [table]
  )

  const openCast = async (spell: EntityRef) => {
    const detail = (await window.handbook.data.getDetail('spell', spell.name, spell.source)) as
      | Record<string, unknown>
      | null
    if (!detail) return
    const spellLevel = Number(detail.level ?? 0)
    const isArcanum =
      spellLevel >= 6 &&
      sheet.mysticArcanum.some((s) => s.name === spell.name && s.source === spell.source)
    const slots = Object.fromEntries(
      Object.entries(sheet.spellSlots).map(([k, v]) => [Number(k), v])
    )
    const levels = isArcanum ? [] : availableSlotLevels(spellLevel, slots)
    const pick = isArcanum ? spellLevel : levels[0] ?? spellLevel
    setCastTarget(spell)
    setCastSlotLevel(pick)
    setCastPreview(getUpcastPreview(detail, pick).description)
  }

  useEffect(() => {
    if (!castTarget) return
    void window.handbook.data
      .getDetail('spell', castTarget.name, castTarget.source)
      .then((detail) => {
        if (detail && typeof detail === 'object') {
          setCastPreview(getUpcastPreview(detail as Record<string, unknown>, castSlotLevel).description)
        }
      })
  }, [castTarget, castSlotLevel])

  const confirmCast = async () => {
    if (!castTarget) return
    const detail = (await window.handbook.data.getDetail(
      'spell',
      castTarget.name,
      castTarget.source
    )) as Record<string, unknown>
    const spellLevel = Number(detail?.level ?? 0)
    if (spellLevel === 0) {
      setCastTarget(null)
      return
    }

    const isArcanum = sheet.mysticArcanum.some(
      (s) => s.name === castTarget.name && s.source === castTarget.source
    )
    const arcanumAlreadyUsed = sheet.arcanumUsed.some(
      (s) => s.name === castTarget.name && s.source === castTarget.source
    )

    let next = sheet
    if (isArcanum && spellLevel >= 6) {
      if (arcanumAlreadyUsed) return
      next = {
        ...sheet,
        arcanumUsed: [...sheet.arcanumUsed, castTarget]
      }
    } else {
      const spent = spendSpellSlot(sheet, castSlotLevel)
      if (!spent) return
      next = spent
    }

    void persist(character, {
      ...next,
      concentration: isConcentrationSpell(detail) ? castTarget : next.concentration
    })
    setCastTarget(null)
  }

  const useFeature = (feature: ClassFeatureEntry) => {
    if (!feature.consumes) {
      return
    }
    const poolId =
      Object.keys(sheet.resourcePools).find(
        (k) => k.toLowerCase().includes(feature.consumes!.name.toLowerCase()) ||
          feature.consumes!.name.toLowerCase().includes(k.toLowerCase().replace(/ points$/i, ''))
      ) ?? feature.consumes.name
    const next = spendResource(sheet, poolId, feature.consumes.amount ?? 1)
    if (!next) {
      return
    }
    void persist(character, next)
  }

  const optProgression = useMemo(
    () => (classDetail ? getOptionalFeatureProgression(classDetail, character.level) : []),
    [classDetail, character.level]
  )

  const toggleOptionalFeature = (feat: Record<string, unknown>) => {
    const ref = { name: String(feat.name), source: String(feat.source) }
    const exists = sheet.optionalFeatures.some(
      (s) => s.name === ref.name && s.source === ref.source
    )
    const maxCount = optProgression.reduce((sum, p) => sum + p.count, 0)
    let next: EntityRef[]
    if (exists) {
      next = sheet.optionalFeatures.filter(
        (s) => !(s.name === ref.name && s.source === ref.source)
      )
    } else {
      if (sheet.optionalFeatures.length >= maxCount) {
        return
      }
      next = [...sheet.optionalFeatures, ref]
    }
    void persist(character, { ...sheet, optionalFeatures: next })
  }

  const isConcentrationSpell = (detail: Record<string, unknown>): boolean => {
    const dur = detail.duration
    const text = typeof dur === 'string' ? dur : JSON.stringify(dur ?? '')
    return /concentration/i.test(text)
  }

  const allProficient = [
    ...(character.skills?.background ?? []),
    ...(character.skills?.class ?? [])
  ]
  const expertise = character.skills?.expertise ?? []
  const pb = proficiencyBonus(character.level)

  const hasInventory =
    (character.inventory?.items.length ?? 0) > 0 || (character.inventory?.goldCp ?? 0) > 0
  const hasOptionalPanel = optProgression.length > 0 && optionalPool.length > 0

  const visiblePanels = useMemo(() => {
    const ids: SheetPanelId[] = ['combat', 'spells']
    if (hasInventory) ids.push('inventory')
    ids.push('features', 'abilities')
    if (hasOptionalPanel) ids.push('optional')
    return ids
  }, [hasInventory, hasOptionalPanel])

  const panelLayout = useMemo(
    () => resolveSheetLayout(sheet.panelLayout, visiblePanels),
    [sheet.panelLayout, visiblePanels]
  )

  // Migrate layouts saved by the old grid so the board starts from clean data.
  useEffect(() => {
    if (!sheet.panelLayout?.length) return
    if (layoutItemsEqual(sheet.panelLayout, panelLayout)) return
    void persist(character, { ...sheet, panelLayout })
  }, [character.id, visiblePanels.join(','), panelLayout])

  const handleLayoutChange = (next: SheetPanelLayout[]) => {
    void persist(character, { ...sheet, panelLayout: next })
  }

  return (
    <div className="sheet-root">
      <header className="sheet-header">
        <div className="sheet-identity">
          <h2>{character.name}</h2>
          <p className="sheet-subtitle">
            Level {character.level} {character.species.name} {character.class.name}
            {character.subclass ? ` (${character.subclass.name})` : ''} · {character.alignment}
          </p>
          <p className="sheet-subtitle muted">
            {character.background.name} · PB +{pb}
            {saving ? ' · Saving…' : ''}
          </p>
        </div>
        <div className="sheet-header-actions">
          <button
            type="button"
            className="btn-secondary sheet-level-up-btn"
            onClick={() => void openLevelUp()}
            disabled={character.level >= 20 || !classDetail || !bundle}
            title={character.level >= 20 ? 'Maximum level reached' : 'Level up'}
          >
            <ArrowUpCircle size={16} /> Level Up
          </button>
          <button type="button" className="btn-secondary sheet-rest-btn" onClick={handleShortRest}>
            <Coffee size={14} /> Short Rest
          </button>
          <button type="button" className="btn-secondary sheet-rest-btn" onClick={handleLongRest}>
            <Moon size={14} /> Long Rest
          </button>
          <button
            type="button"
            className="btn-secondary danger-btn"
            onClick={() => setDeleteConfirmOpen(true)}
            title="Delete character"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <SheetBoard
        layout={panelLayout}
        onLayoutChange={handleLayoutChange}
        panels={{
          combat: (
            <section className="sheet-panel">
              <SheetPanelTitle>Combat</SheetPanelTitle>
              <div className="sheet-stat-row">
                <div className="sheet-stat">
                  <span className="label">HP</span>
                  <span className="value">
                    {sheet.hp.current}/{sheet.hp.max}
                  </span>
                </div>
                <div className="sheet-stat">
                  <span className="label">AC</span>
                  <span className="value">{character.combat.ac}</span>
                </div>
                <div className="sheet-stat">
                  <span className="label">Init</span>
                  <span className="value">{formatModifier(character.combat.initiativeMod)}</span>
                </div>
              </div>

              {Object.keys(sheet.spellSlots).length > 0 && (
                <>
                  <h4 className="sheet-subheading">
                    {effectiveClassDetail && isPactCaster(effectiveClassDetail)
                      ? 'Pact Magic Slots'
                      : 'Spell Slots'}
                  </h4>
                  <div className="slot-grid">
                    {Object.entries(sheet.spellSlots)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([lvl, slot]) => (
                        <div key={lvl} className="slot-cell">
                          <span className="slot-label">
                            {lvl}
                            {ordinal(Number(lvl))}
                          </span>
                          <div className="slot-pips">
                            {Array.from({ length: slot.max }).map((_, i) => (
                              <span
                                key={i}
                                className={`slot-pip ${i < slot.max - slot.used ? 'available' : 'spent'}`}
                              />
                            ))}
                          </div>
                          <span className="slot-count">
                            {slot.max - slot.used}/{slot.max}
                          </span>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {Object.keys(sheet.resourcePools).length > 0 && (
                <>
                  <h4 className="sheet-subheading">Class Resources</h4>
                  <div className="resource-list">
                    {Object.entries(sheet.resourcePools).map(([id, pool]) => (
                      <div key={id} className="resource-row">
                        <span className="resource-name">{id}</span>
                        <div className="resource-bar">
                          <div
                            className="resource-fill"
                            style={{
                              width: `${((pool.max - pool.used) / Math.max(pool.max, 1)) * 100}%`
                            }}
                          />
                        </div>
                        <span className="resource-count">
                          {pool.max - pool.used}/{pool.max}
                        </span>
                        <span className="resource-recharge">{pool.recharge} rest</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sheet.concentration && (
                <div className="concentration-banner">
                  <Sparkles size={14} /> Concentrating on <strong>{sheet.concentration.name}</strong>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => void persist(character, { ...sheet, concentration: null })}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </section>
          ),
          spells: (
            <section className="sheet-panel">
              <SheetPanelHead
                title="Spells"
                actions={
                  effectiveClassDetail && hasSpellcasting(effectiveClassDetail) && table ? (
                    <div className="sheet-panel-head-actions">
                      {getCantripLimit(table) > 0 && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setCantripPickerOpen((o) => !o)}
                        >
                          <Plus size={14} /> Add cantrips
                        </button>
                      )}
                      {usesPrepared && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setPrepareModalOpen(true)}
                        >
                          <Plus size={14} /> Prepare spells
                        </button>
                      )}
                      {usesKnown && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setKnownPickerOpen((o) => !o)}
                        >
                          <Plus size={14} /> Add spells
                        </button>
                      )}
                      {mysticArcanumLimit > 0 && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setArcanumPickerOpen((o) => !o)}
                        >
                          <Plus size={14} /> Mystic arcanum
                        </button>
                      )}
                    </div>
                  ) : undefined
                }
              />

              {table && effectiveClassDetail && hasSpellcasting(effectiveClassDetail) && (
                <p className="sheet-hint">
                  {spellcastingAb ? (
                    <>
                      Spellcasting: {ABILITY_LABELS[spellcastingAb]}{' '}
                      ({formatModifier(abilityModifier(character.abilityScores[spellcastingAb]))})
                      ·{' '}
                    </>
                  ) : null}
                  Cantrips {sheet.cantrips.length}/{getCantripLimit(table)}
                  {usesPrepared && (
                    <>
                      {' '}
                      · Prepared {sheet.preparedSpells.length}/{getPreparedLimit(table)}
                    </>
                  )}
                  {usesKnown && (
                    <>
                      {' '}
                      · Known {sheet.knownSpells.length}/{getKnownLimit(table)}
                    </>
                  )}
                  {mysticArcanumLimit > 0 && (
                    <>
                      {' '}
                      · Arcanum {sheet.mysticArcanum.length}/{mysticArcanumLimit}
                    </>
                  )}
                </p>
              )}

              {cantripPickerOpen && (
                <div className="spell-picker">
                  {castableClassSpells
                    .filter((spell) => spell.level === 0)
                    .map((spell) => (
                      <div key={`c-${spell.name}|${spell.source}`} className="spell-picker-row">
                        <span>{spell.name}</span>
                        <div className="spell-picker-actions">
                          <button
                            type="button"
                            className="btn-chip"
                            onClick={() => toggleSpell(spell, 'cantrip')}
                          >
                            {sheet.cantrips.some(
                              (s) => s.name === spell.name && s.source === spell.source
                            )
                              ? 'Remove'
                              : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {knownPickerOpen && usesKnown && (
                <div className="spell-picker">
                  {castableClassSpells
                    .filter((spell) => spell.level > 0)
                    .map((spell) => (
                      <div key={`k-${spell.name}|${spell.source}`} className="spell-picker-row">
                        <span>
                          {spell.name}{' '}
                          <span className="muted">(Lv {spell.level})</span>
                        </span>
                        <div className="spell-picker-actions">
                          <button
                            type="button"
                            className="btn-chip"
                            onClick={() => toggleSpell(spell, 'known')}
                          >
                            {sheet.knownSpells.some(
                              (s) => s.name === spell.name && s.source === spell.source
                            )
                              ? 'Remove'
                              : 'Learn'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {sheet.cantrips.length > 0 && (
                <>
                  <h4 className="sheet-subheading">Cantrips</h4>
                  <div className="spell-list">
                    {sheet.cantrips.map((s) => (
                      <div key={`c-${s.name}|${s.source}`} className="spell-row">
                        <span>{s.name}</span>
                        <button type="button" className="btn-chip cast" onClick={() => void openCast(s)}>
                          <Zap size={12} /> Cast
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sheet.preparedSpells.length > 0 && (
                <>
                  <h4 className="sheet-subheading">Prepared Spells</h4>
                  <div className="spell-list">
                    {sheet.preparedSpells.map((s) => (
                      <div key={`p-${s.name}|${s.source}`} className="spell-row">
                        <span>{s.name}</span>
                        <button type="button" className="btn-chip cast" onClick={() => void openCast(s)}>
                          <Zap size={12} /> Cast
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {arcanumPickerOpen && mysticArcanumLimit > 0 && (
                <div className="spell-picker">
                  {classSpells
                    .filter(
                      (spell) =>
                        spell.level >= 6 &&
                        spell.level <= 9 &&
                        arcanumUnlockedLevels.includes(spell.level)
                    )
                    .slice(0, 80)
                    .map((spell) => (
                      <div key={`a-${spell.name}|${spell.source}`} className="spell-picker-row">
                        <span>
                          {spell.name}{' '}
                          <span className="muted">(Lv {spell.level})</span>
                        </span>
                        <div className="spell-picker-actions">
                          <button
                            type="button"
                            className="btn-chip"
                            onClick={() => toggleSpell(spell, 'arcanum')}
                          >
                            {sheet.mysticArcanum.some(
                              (s) => s.name === spell.name && s.source === spell.source
                            )
                              ? 'Remove'
                              : 'Learn'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {sheet.knownSpells.length > 0 && (
                <>
                  <h4 className="sheet-subheading">Known Spells</h4>
                  <div className="spell-list">
                    {sheet.knownSpells.map((s) => (
                      <div key={`k-${s.name}|${s.source}`} className="spell-row">
                        <span>{s.name}</span>
                        <button type="button" className="btn-chip cast" onClick={() => void openCast(s)}>
                          <Zap size={12} /> Cast
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sheet.mysticArcanum.length > 0 && (
                <>
                  <h4 className="sheet-subheading">Mystic Arcanum</h4>
                  <div className="spell-list">
                    {sheet.mysticArcanum.map((s) => {
                      const used = sheet.arcanumUsed.some(
                        (u) => u.name === s.name && u.source === s.source
                      )
                      return (
                        <div key={`a-${s.name}|${s.source}`} className="spell-row">
                          <span>
                            {s.name}
                            {used ? <span className="muted"> (used today)</span> : null}
                          </span>
                          <button
                            type="button"
                            className="btn-chip cast"
                            disabled={used}
                            onClick={() => void openCast(s)}
                          >
                            <Zap size={12} /> Cast
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {!effectiveClassDetail || !hasSpellcasting(effectiveClassDetail) ? (
                <p className="sheet-hint">This class has no spellcasting at current level.</p>
              ) : null}
            </section>
          ),
          inventory: hasInventory ? (
            <section className="sheet-panel">
              <SheetPanelTitle>Inventory</SheetPanelTitle>
              {character.inventory!.items.length > 0 && (
                <div className="inventory-list">
                  {character.inventory!.items.map((item) => (
                    <div key={item.label} className="inventory-row">
                      <span>{item.label}</span>
                      {item.quantity > 1 && <span className="muted">×{item.quantity}</span>}
                    </div>
                  ))}
                </div>
              )}
              {(character.inventory?.goldCp ?? 0) > 0 && (
                <p className="sheet-hint">Gold: {character.inventory!.goldCp / 100} GP</p>
              )}
            </section>
          ) : undefined,
          features: (
            <section className="sheet-panel">
              <SheetPanelTitle>Class Features</SheetPanelTitle>
              <p className="sheet-hint">
                All features through level {character.level}
                {character.subclass ? ` · ${character.subclass.name} subclass` : ''}
              </p>
              {features.length === 0 ? (
                <p className="sheet-hint">No class features at this level yet.</p>
              ) : (
                <div className="feature-list feature-list-detailed">
                  {features.map((f) => (
                    <article
                      key={f.uid}
                      className={`feature-card ${f.isSubclass ? 'feature-card-subclass' : ''}`}
                    >
                      <div className="feature-head">
                        <div className="feature-title-wrap">
                          <strong>{f.name}</strong>
                          {f.isSubclass && character.subclass && (
                            <span className="feature-subclass-tag">{character.subclass.name}</span>
                          )}
                        </div>
                        <span className="feature-level">Level {f.level}</span>
                      </div>
                      <div className="feature-description">
                        <EntryDescription
                          detail={{
                            entries: f.entries,
                            entriesHigherLevel: f.entriesHigherLevel
                          }}
                        />
                      </div>
                      {f.consumes && (
                        <button type="button" className="btn-chip use" onClick={() => useFeature(f)}>
                          Use (−{f.consumes.amount ?? 1} {f.consumes.name})
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ),
          abilities: (
            <section className="sheet-panel">
              <SheetPanelTitle>Abilities & Skills</SheetPanelTitle>
              <div className="ability-grid">
                {ABILITIES.map((ab) => (
                  <div key={ab} className="ability-cell">
                    <span className="ability-abbr">{ABILITY_LABELS[ab]}</span>
                    <span className="ability-score">{character.abilityScores[ab]}</span>
                    <span className="ability-mod">
                      {formatModifier(abilityModifier(character.abilityScores[ab]))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="skill-compact-list">
                {Object.keys(SKILL_TO_ABILITY)
                  .sort()
                  .slice(0, 9)
                  .map((skill) => {
                    const proficient = isSkillInList(skill, allProficient)
                    const hasExpertise = isSkillInList(skill, expertise)
                    const mod = skillModifier(
                      skill,
                      character.abilityScores,
                      proficient,
                      hasExpertise
                    )
                    return (
                      <div key={skill} className={`skill-compact ${proficient ? 'prof' : ''}`}>
                        <span>{formatSkillName(skill)}</span>
                        <span>{formatModifier(mod)}</span>
                      </div>
                    )
                  })}
              </div>
            </section>
          ),
          optional: hasOptionalPanel ? (
            <section className="sheet-panel">
              <SheetPanelTitle>Optional Features</SheetPanelTitle>
              {optProgression.map((prog) => (
                <div key={prog.name} className="optional-prog-block">
                  <p className="sheet-hint">
                    {prog.name}: choose {prog.count} ({sheet.optionalFeatures.length}/
                    {optProgression.reduce((s, p) => s + p.count, 0)} selected)
                  </p>
                  <div className="optional-feature-grid">
                    {optionalPool
                      .filter((f) => optionalFeatureMatchesTypes(f, prog.featureTypes))
                      .slice(0, 40)
                      .map((f) => {
                        const selected = sheet.optionalFeatures.some(
                          (s) => s.name === f.name && s.source === f.source
                        )
                        return (
                          <button
                            key={`${f.name}|${f.source}`}
                            type="button"
                            className={`optional-feature-chip ${selected ? 'selected' : ''}`}
                            onClick={() => toggleOptionalFeature(f)}
                          >
                            {String(f.name)}
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </section>
          ) : undefined
        }}
      />

      {prepareModalOpen && table && usesPrepared && (
        <PrepareSpellsModal
          spells={castableClassSpells.filter((spell) => spell.level > 0)}
          prepared={sheet.preparedSpells}
          limit={getPreparedLimit(table)}
          maxCastableLevel={maxCastableSpellLevel}
          onToggle={(spell) => toggleSpell(spell, 'prepared')}
          onClose={() => setPrepareModalOpen(false)}
        />
      )}

      {levelUpOpen && bundle && classDetail ? (
        <LevelUpModal
          character={character}
          sheet={sheet}
          bundle={bundle}
          classDetail={classDetail}
          subclasses={subclasses}
          optionalPool={levelUpOptionalPool.length ? levelUpOptionalPool : optionalPool}
          onCancel={() => setLevelUpOpen(false)}
          onConfirm={(result) => void confirmLevelUp(result)}
        />
      ) : null}

      {deleteConfirmOpen ? (
        <div className="sheet-modal-backdrop" onMouseDown={() => setDeleteConfirmOpen(false)}>
          <div
            className="sheet-modal delete-confirm-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="delete-character-title"
            aria-describedby="delete-character-desc"
          >
            <h3 id="delete-character-title">Delete character?</h3>
            <p id="delete-character-desc" className="delete-confirm-message">
              <strong>{character.name}</strong> will be permanently removed. This cannot be undone.
            </p>
            <div className="sheet-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary danger-btn"
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  onDelete()
                }}
              >
                Delete character
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {castTarget && (
        <div className="sheet-modal-backdrop" onMouseDown={() => setCastTarget(null)}>
          <div className="sheet-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Cast {castTarget.name}</h3>
            <CastModalContent
              spell={castTarget}
              sheet={sheet}
              slotLevel={castSlotLevel}
              onSlotChange={setCastSlotLevel}
              preview={castPreview}
            />
            <div className="sheet-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setCastTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  sheet.mysticArcanum.some(
                    (s) => s.name === castTarget.name && s.source === castTarget.source
                  ) &&
                  sheet.arcanumUsed.some(
                    (s) => s.name === castTarget.name && s.source === castTarget.source
                  )
                }
                onClick={() => void confirmCast()}
              >
                {sheet.mysticArcanum.some(
                  (s) => s.name === castTarget.name && s.source === castTarget.source
                )
                  ? 'Cast & expend arcanum'
                  : 'Cast & expend slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PrepareSpellsModal({
  spells,
  prepared,
  limit,
  maxCastableLevel,
  onToggle,
  onClose
}: {
  spells: SpellOption[]
  prepared: EntityRef[]
  limit: number
  maxCastableLevel: number
  onToggle: (spell: SpellOption) => void
  onClose: () => void
}) {
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
        aria-labelledby="prepare-spells-title"
      >
        <h3 id="prepare-spells-title">Prepare Spells</h3>
        <p className="sheet-hint">
          {prepared.length}/{limit} prepared · Up to {ordinal(maxCastableLevel)}-level spells
        </p>
        <input
          type="search"
          className="prepare-spells-search"
          placeholder="Search spells…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="prepare-spells-list">
          {filtered.length === 0 ? (
            <p className="sheet-hint">No spells match your search.</p>
          ) : (
            filtered.map((spell) => {
              const isPrepared = prepared.some(
                (s) => s.name === spell.name && s.source === spell.source
              )
              return (
                <div key={`${spell.name}|${spell.source}`} className="spell-picker-row">
                  <span>
                    {spell.name} <span className="muted">(Lv {spell.level})</span>
                  </span>
                  <div className="spell-picker-actions">
                    <button type="button" className="btn-chip" onClick={() => onToggle(spell)}>
                      {isPrepared ? 'Unprepare' : 'Prepare'}
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

function CastModalContent({
  spell,
  sheet,
  slotLevel,
  onSlotChange,
  preview
}: {
  spell: EntityRef
  sheet: CharacterSheetState
  slotLevel: number
  onSlotChange: (n: number) => void
  preview: string
}) {
  const [spellLevel, setSpellLevel] = useState(0)

  useEffect(() => {
    void window.handbook.data.getDetail('spell', spell.name, spell.source).then((d) => {
      if (d && typeof d === 'object') setSpellLevel(Number((d as Record<string, unknown>).level ?? 0))
    })
  }, [spell])

  const isArcanum = sheet.mysticArcanum.some(
    (s) => s.name === spell.name && s.source === spell.source
  )
  const arcanumUsed = sheet.arcanumUsed.some(
    (s) => s.name === spell.name && s.source === spell.source
  )
  const slots = Object.fromEntries(Object.entries(sheet.spellSlots).map(([k, v]) => [Number(k), v]))
  const levels = isArcanum ? [] : availableSlotLevels(spellLevel, slots)

  return (
    <>
      {isArcanum && spellLevel >= 6 ? (
        <p className="sheet-hint">
          Mystic arcanum ({spellLevel}
          {ordinal(spellLevel)} level)
          {arcanumUsed ? ' · Already used since last long rest' : ' · Recovers on long rest'}
        </p>
      ) : null}
      {spellLevel > 0 && levels.length > 0 && (
        <label className="sheet-field-label">
          Spell slot level
          <select
            className="sheet-select"
            value={slotLevel}
            onChange={(e) => onSlotChange(Number(e.target.value))}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}{ordinal(l)} level ({sheet.spellSlots[l].max - sheet.spellSlots[l].used} left)
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="cast-preview">{preview}</p>
    </>
  )
}

function ordinal(n: number): string {
  if (n === 0) return ''
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}
