import type { Ability } from './character'
import type { EntityRef, ParsedClassTable } from './class-mechanics'
import {
  getMaxCastableSpellLevel,
  isPactCaster,
  parseClassTable,
  proficiencyBonus
} from './class-mechanics'
import type {
  CharacterSheetState,
  ResourcePoolState,
  SavedCharacter,
  SpellSlotState
} from './character'
import { abilityModifier, computeMaxHp, getHitDieFaces } from './character'

export type { CharacterSheetState, ResourcePoolState, SpellSlotState } from './character'

function tableOptions(character: SavedCharacter) {
  return { abilityScores: character.abilityScores }
}

export function buildInitialSheetState(
  character: SavedCharacter,
  classDetail: Record<string, unknown>
): CharacterSheetState {
  const table = parseClassTable(classDetail, character.level, tableOptions(character))
  const maxHp = computeMaxHp(classDetail, character.abilityScores.con)

  const spellSlots: Record<number, SpellSlotState> = {}
  table.spellSlots.forEach((max, i) => {
    if (max > 0) spellSlots[i + 1] = { max, used: 0 }
  })

  const resourcePools: Record<string, ResourcePoolState> = {}
  for (const pool of table.resourcePools) {
    resourcePools[pool.id] = {
      max: pool.max,
      used: 0,
      recharge: pool.recharge
    }
  }

  return {
    hp: { current: maxHp, max: maxHp },
    spellSlots,
    resourcePools,
    cantrips: character.sheet?.cantrips ?? [],
    preparedSpells: character.sheet?.preparedSpells ?? [],
    knownSpells: character.sheet?.knownSpells ?? [],
    mysticArcanum: character.sheet?.mysticArcanum ?? [],
    arcanumUsed: character.sheet?.arcanumUsed ?? [],
    optionalFeatures: character.sheet?.optionalFeatures ?? [],
    concentration: character.sheet?.concentration ?? null
  }
}

export function syncSheetWithLevel(
  sheet: CharacterSheetState,
  classDetail: Record<string, unknown>,
  level: number,
  conScore: number,
  abilityScores?: Record<Ability, number>
): CharacterSheetState {
  const table = parseClassTable(classDetail, level, abilityScores ? { abilityScores } : undefined)
  const maxHp =
    computeMaxHp(classDetail, conScore) +
    (level - 1) * (Math.floor(getHitDieFaces(classDetail) / 2) + 1 + abilityModifier(conScore))

  const spellSlots: Record<number, SpellSlotState> = {}
  table.spellSlots.forEach((max, i) => {
    const lvl = i + 1
    const prev = sheet.spellSlots[lvl]
    spellSlots[lvl] = { max, used: prev ? Math.min(prev.used, max) : 0 }
  })

  const resourcePools: Record<string, ResourcePoolState> = {}
  for (const pool of table.resourcePools) {
    const prev = sheet.resourcePools[pool.id]
    resourcePools[pool.id] = {
      max: pool.max,
      used: prev ? Math.min(prev.used, pool.max) : 0,
      recharge: pool.recharge
    }
  }

  return {
    ...sheet,
    hp: { current: Math.min(sheet.hp.current, maxHp), max: maxHp },
    spellSlots,
    resourcePools
  }
}

export function spendSpellSlot(sheet: CharacterSheetState, level: number): CharacterSheetState | null {
  const slot = sheet.spellSlots[level]
  if (!slot || slot.used >= slot.max) return null
  return {
    ...sheet,
    spellSlots: {
      ...sheet.spellSlots,
      [level]: { ...slot, used: slot.used + 1 }
    }
  }
}

export function spendResource(
  sheet: CharacterSheetState,
  poolId: string,
  amount = 1
): CharacterSheetState | null {
  const pool = sheet.resourcePools[poolId]
  if (!pool || pool.used + amount > pool.max) return null
  return {
    ...sheet,
    resourcePools: {
      ...sheet.resourcePools,
      [poolId]: { ...pool, used: pool.used + amount }
    }
  }
}

function refreshSpellSlots(sheet: CharacterSheetState): Record<number, SpellSlotState> {
  const spellSlots: Record<number, SpellSlotState> = {}
  for (const [level, slot] of Object.entries(sheet.spellSlots)) {
    spellSlots[Number(level)] = { ...slot, used: 0 }
  }
  return spellSlots
}

export function shortRest(
  sheet: CharacterSheetState,
  classDetail?: Record<string, unknown>
): CharacterSheetState {
  const resourcePools = { ...sheet.resourcePools }
  for (const [id, pool] of Object.entries(resourcePools)) {
    if (pool.recharge === 'short') {
      resourcePools[id] = { ...pool, used: 0 }
    }
  }

  const next: CharacterSheetState = { ...sheet, resourcePools }
  if (classDetail && isPactCaster(classDetail)) {
    next.spellSlots = refreshSpellSlots(sheet)
  }
  return next
}

export function longRest(
  sheet: CharacterSheetState,
  classDetail: Record<string, unknown>,
  level: number,
  abilityScores?: Record<Ability, number>
): CharacterSheetState {
  const table = parseClassTable(classDetail, level, abilityScores ? { abilityScores } : undefined)
  const spellSlots: Record<number, SpellSlotState> = {}
  table.spellSlots.forEach((max, i) => {
    if (max > 0) spellSlots[i + 1] = { max, used: 0 }
  })

  const resourcePools: Record<string, ResourcePoolState> = {}
  for (const pool of table.resourcePools) {
    resourcePools[pool.id] = { max: pool.max, used: 0, recharge: pool.recharge }
  }

  return {
    ...sheet,
    spellSlots,
    resourcePools,
    concentration: null,
    arcanumUsed: [],
    hp: { ...sheet.hp, current: sheet.hp.max }
  }
}

export function getPreparedLimit(table: ParsedClassTable): number {
  return table.preparedSpells
}

export function getKnownLimit(table: ParsedClassTable): number {
  return table.spellsKnown
}

export function classUsesPreparedSpells(
  classDetail: Record<string, unknown>,
  level: number,
  abilityScores?: Record<Ability, number>
): boolean {
  const table = parseClassTable(
    classDetail,
    level,
    abilityScores ? { abilityScores } : undefined
  )
  if (table.preparedSpells > 0) return true
  const hasFormula = typeof classDetail.preparedSpells === 'string'
  return hasFormula && table.spellsKnown === 0
}

export function classUsesKnownSpells(
  classDetail: Record<string, unknown>,
  level: number,
  abilityScores?: Record<Ability, number>
): boolean {
  const table = parseClassTable(
    classDetail,
    level,
    abilityScores ? { abilityScores } : undefined
  )
  return table.spellsKnown > 0 && table.preparedSpells === 0
}

export function getCantripLimit(table: ParsedClassTable): number {
  return table.cantripsKnown
}

function spellRefKey(name: string, source: string): string {
  return `${name}|${source.toUpperCase()}`
}

/** Drop prepared/known spells above the character's max castable spell level. */
export function pruneSpellsAboveMaxLevel(
  sheet: CharacterSheetState,
  spellLevels: Map<string, number>,
  maxLevel: number
): CharacterSheetState {
  const keep = (ref: EntityRef) => {
    const level = spellLevels.get(spellRefKey(ref.name, ref.source))
    if (level === undefined) return true
    if (level === 0) return true
    return level <= maxLevel
  }
  const preparedSpells = sheet.preparedSpells.filter(keep)
  const knownSpells = sheet.knownSpells.filter(keep)
  if (
    preparedSpells.length === sheet.preparedSpells.length &&
    knownSpells.length === sheet.knownSpells.length
  ) {
    return sheet
  }
  return { ...sheet, preparedSpells, knownSpells }
}

export { getMaxCastableSpellLevel, proficiencyBonus }
