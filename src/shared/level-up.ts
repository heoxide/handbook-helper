import type { Ability, SavedCharacter } from './character'
import { abilityModifier, getHitDieFaces } from './character'
import type {
  ClassBundle,
  ClassFeatureEntry,
  SubclassOption
} from './class-mechanics'
import {
  getNewFeaturesAtLevel,
  getOptionalFeatureProgression,
  getSubclassDetail,
  isAsiOrFeatFeature,
  parseClassTable,
  proficiencyBonus,
  requiresSubclassAtLevel,
  resolveEffectiveClassDetail
} from './class-mechanics'

export interface SpellLimitChange {
  kind: 'cantrips' | 'prepared' | 'known'
  from: number
  to: number
}

export interface SpellSlotChange {
  level: number
  from: number
  to: number
}

export interface ResourceChange {
  id: string
  label: string
  from: number
  to: number
}

export interface OptionalFeatureGain {
  name: string
  featureTypes: string[]
  from: number
  to: number
  pickCount: number
}

export interface LevelUpAnalysis {
  fromLevel: number
  toLevel: number
  proficiencyBonusChange: { from: number; to: number } | null
  hpGain: number
  requiresSubclass: boolean
  newFeatures: ClassFeatureEntry[]
  asiFeatures: ClassFeatureEntry[]
  epicBoonFeatures: ClassFeatureEntry[]
  normalFeatures: ClassFeatureEntry[]
  spellLimitChanges: SpellLimitChange[]
  spellSlotChanges: SpellSlotChange[]
  resourceChanges: ResourceChange[]
  optionalFeatureGains: OptionalFeatureGain[]
}

export function averageHpGainOnLevelUp(
  classDetail: Record<string, unknown>,
  conScore: number
): number {
  return Math.floor(getHitDieFaces(classDetail) / 2) + 1 + abilityModifier(conScore)
}

export function analyzeLevelUp(
  bundle: ClassBundle,
  classDetail: Record<string, unknown>,
  character: SavedCharacter,
  toLevel: number,
  subclass?: SubclassOption | null
): LevelUpAnalysis {
  const fromLevel = character.level
  const sub =
    subclass ??
    (character.subclass
      ? {
          name: character.subclass.name,
          shortName: character.subclass.name,
          source: character.subclass.source,
          className: character.class.name,
          classSource: character.class.source
        }
      : null)

  const newFeatures = getNewFeaturesAtLevel(bundle, classDetail, toLevel, sub)
  const asiFeatures = newFeatures.filter((f) => isAsiOrFeatFeature(f.name) === 'asi')
  const epicBoonFeatures = newFeatures.filter((f) => isAsiOrFeatFeature(f.name) === 'epic-boon')
  const normalFeatures = newFeatures.filter((f) => !isAsiOrFeatFeature(f.name))

  const subclassDetail = sub ? getSubclassDetail(bundle, sub) : undefined
  const effectiveDetail = resolveEffectiveClassDetail(classDetail, subclassDetail ?? null)
  const parseOpts = { abilityScores: character.abilityScores }

  const oldTable = parseClassTable(effectiveDetail, fromLevel, parseOpts)
  const newTable = parseClassTable(effectiveDetail, toLevel, parseOpts)

  const spellLimitChanges: SpellLimitChange[] = []
  if (oldTable.cantripsKnown !== newTable.cantripsKnown && newTable.cantripsKnown > 0) {
    spellLimitChanges.push({
      kind: 'cantrips',
      from: oldTable.cantripsKnown,
      to: newTable.cantripsKnown
    })
  }
  if (oldTable.preparedSpells !== newTable.preparedSpells && newTable.preparedSpells > 0) {
    spellLimitChanges.push({
      kind: 'prepared',
      from: oldTable.preparedSpells,
      to: newTable.preparedSpells
    })
  }
  if (oldTable.spellsKnown !== newTable.spellsKnown && newTable.spellsKnown > 0) {
    spellLimitChanges.push({
      kind: 'known',
      from: oldTable.spellsKnown,
      to: newTable.spellsKnown
    })
  }

  const spellSlotChanges: SpellSlotChange[] = []
  newTable.spellSlots.forEach((to, i) => {
    const from = oldTable.spellSlots[i] ?? 0
    const level = i + 1
    if (to !== from && to > 0) {
      spellSlotChanges.push({ level, from, to })
    }
  })

  const resourceChanges: ResourceChange[] = []
  for (const pool of newTable.resourcePools) {
    const prev = oldTable.resourcePools.find((p) => p.id === pool.id)
    const from = prev?.max ?? 0
    if (pool.max !== from) {
      resourceChanges.push({ id: pool.id, label: pool.label, from, to: pool.max })
    }
  }

  const oldOpt = getOptionalFeatureProgression(classDetail, fromLevel)
  const newOpt = getOptionalFeatureProgression(classDetail, toLevel)
  const optionalFeatureGains: OptionalFeatureGain[] = []
  for (const prog of newOpt) {
    const prev = oldOpt.find((p) => p.name === prog.name)
    const from = prev?.count ?? 0
    if (prog.count > from) {
      optionalFeatureGains.push({
        name: prog.name,
        featureTypes: prog.featureTypes,
        from,
        to: prog.count,
        pickCount: prog.count - from
      })
    }
  }

  const pbFrom = proficiencyBonus(fromLevel)
  const pbTo = proficiencyBonus(toLevel)

  return {
    fromLevel,
    toLevel,
    proficiencyBonusChange: pbFrom !== pbTo ? { from: pbFrom, to: pbTo } : null,
    hpGain: averageHpGainOnLevelUp(classDetail, character.abilityScores.con),
    requiresSubclass: requiresSubclassAtLevel(classDetail, toLevel) && !character.subclass,
    newFeatures,
    asiFeatures,
    epicBoonFeatures,
    normalFeatures,
    spellLimitChanges,
    spellSlotChanges,
    resourceChanges,
    optionalFeatureGains
  }
}

export interface AsiSelection {
  mode: '+2' | '+1+1'
  abilities: [Ability] | [Ability, Ability]
}

export function applyAsiToScores(
  scores: Record<Ability, number>,
  selection: AsiSelection
): Record<Ability, number> {
  const next = { ...scores }
  if (selection.mode === '+2') {
    next[selection.abilities[0]] = Math.min(20, next[selection.abilities[0]] + 2)
  } else {
    next[selection.abilities[0]] = Math.min(20, next[selection.abilities[0]] + 1)
    next[selection.abilities[1]] = Math.min(20, next[selection.abilities[1]] + 1)
  }
  return next
}

export function validateAsiSelection(selection: AsiSelection | null): string | null {
  if (!selection) return 'Choose an ability score increase.'
  if (selection.mode === '+2') {
    if (!selection.abilities[0]) return 'Select an ability for +2.'
    return null
  }
  if (selection.abilities.length !== 2) return 'Select two abilities for +1 each.'
  if (selection.abilities[0] === selection.abilities[1]) {
    return 'Choose two different abilities for +1 each.'
  }
  return null
}
