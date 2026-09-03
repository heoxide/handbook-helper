import type { SavedCharacter, Ability } from './character'
import { abilityModifier, computeMaxHp, getHitDieFaces } from './character'
import type { ClassBundle } from './class-mechanics'
import {
  getSubclassDetail,
  parseClassTable,
  requiresSubclassAtLevel,
  resolveEffectiveClassDetail
} from './class-mechanics'
import type { CharacterSheetState } from './character-sheet'
import { syncSheetWithLevel } from './character-sheet'

export interface LevelDownResult {
  character: SavedCharacter
  sheet: CharacterSheetState
}

export function canLevelDown(character: SavedCharacter): boolean {
  return character.level > 1
}

/** Reduce level by 1 and sync sheet resources. Does not undo ASI/feat choices (manual cleanup). */
export function applyLevelDown(
  character: SavedCharacter,
  sheet: CharacterSheetState,
  classDetail: Record<string, unknown>,
  bundle: ClassBundle
): LevelDownResult {
  if (character.level <= 1) {
    return { character, sheet }
  }

  const newLevel = character.level - 1
  const subclass = character.subclass
    ? {
        name: character.subclass.name,
        source: character.subclass.source,
        shortName: character.subclass.name,
        className: character.class.name,
        classSource: character.class.source
      }
    : null

  const subclassDetail = subclass ? getSubclassDetail(bundle, subclass) ?? null : null
  const effective = resolveEffectiveClassDetail(classDetail, subclassDetail)

  let nextChar: SavedCharacter = {
    ...character,
    level: newLevel,
    combat: {
      ...character.combat,
      maxHp: computeMaxHp(effective, character.abilityScores.con),
      proficiencyBonus: newLevel >= 17 ? 6 : newLevel >= 13 ? 5 : newLevel >= 9 ? 4 : newLevel >= 5 ? 3 : 2
    }
  }

  if (
    subclass &&
    requiresSubclassAtLevel(classDetail, newLevel + 1) &&
    !requiresSubclassAtLevel(classDetail, newLevel)
  ) {
    // Keep subclass if still required at new level
  } else if (subclass && !requiresSubclassAtLevel(classDetail, newLevel)) {
    // Optional: clear subclass when dropping below subclass level — only if class gets subclass at 3+
    const subclassLevel = findSubclassLevel(classDetail)
    if (subclassLevel > newLevel) {
      nextChar = { ...nextChar, subclass: null }
    }
  }

  const synced = syncSheetWithLevel(
    sheet,
    effective,
    newLevel,
    character.abilityScores.con,
    character.abilityScores
  )

  const table = parseClassTable(effective, newLevel, { abilityScores: character.abilityScores })
  const maxHp =
    computeMaxHp(effective, character.abilityScores.con) +
    (newLevel - 1) *
      (Math.floor(getHitDieFaces(effective) / 2) + 1 + abilityModifier(character.abilityScores.con))

  const prunedSheet: CharacterSheetState = {
    ...synced,
    hp: {
      current: Math.min(synced.hp.current, maxHp),
      max: maxHp,
      temp: synced.hp.temp ?? 0
    },
    cantrips: synced.cantrips.slice(0, table.cantripsKnown || synced.cantrips.length),
    knownSpells: synced.knownSpells.slice(0, table.spellsKnown || synced.knownSpells.length),
    preparedSpells: synced.preparedSpells.slice(0, table.preparedSpells || synced.preparedSpells.length)
  }

  return {
    character: {
      ...nextChar,
      combat: { ...nextChar.combat, maxHp }
    },
    sheet: prunedSheet
  }
}

function findSubclassLevel(classDetail: Record<string, unknown>): number {
  const features = classDetail.classFeatures as string[] | undefined
  if (!features?.length) return 3
  for (const uid of features) {
    const parts = uid.split('|')
    const level = Number.parseInt(parts[parts.length - 1] ?? '', 10)
    const name = (parts[0] ?? '').toLowerCase()
    if (name.includes('subclass') && Number.isFinite(level)) return level
  }
  return 3
}
