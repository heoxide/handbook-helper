import type { SheetPanelLayout } from './sheet-layout'

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]

export const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA'
}

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
}

export const POINT_BUY_TOTAL = 27

export const PROFICIENCY_BONUS = 2

export const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil'
] as const

export type Alignment = (typeof ALIGNMENTS)[number]

export type ScoreMethod = 'standard' | 'pointbuy' | 'roll' | 'manual'

export const MIN_ABILITY_SCORE = 1
export const MAX_ABILITY_SCORE = 30

export type BackgroundBoostMode = 'two-one' | 'all-one'

export const STANDARD_ARRAY_BY_CLASS: Record<string, Record<Ability, number>> = {
  Barbarian: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  Bard: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
  Cleric: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 },
  Druid: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 },
  Fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  Monk: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 },
  Paladin: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
  Ranger: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
  Rogue: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 },
  Sorcerer: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 },
  Warlock: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
  Wizard: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
  Artificer: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }
}

export const SKILL_TO_ABILITY: Record<string, Ability> = {
  acrobatics: 'dex',
  'animal handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight of hand': 'dex',
  stealth: 'dex',
  survival: 'wis'
}

export function isValidAbilityScore(score: number): boolean {
  return Number.isFinite(score) && score >= MIN_ABILITY_SCORE && score <= MAX_ABILITY_SCORE
}

export function defaultScores(): Record<Ability, number> {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : String(mod)
}

export function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
  rolls.sort((a, b) => a - b)
  return rolls.slice(1).reduce((a, b) => a + b, 0)
}

export function pointBuySpent(scores: Record<Ability, number>): number {
  return ABILITIES.reduce((sum, ab) => sum + (POINT_BUY_COSTS[scores[ab]] ?? 0), 0)
}

export function isXphb2024(entry: { source?: string; edition?: string }): boolean {
  return entry.source === 'XPHB' && entry.edition === 'one'
}

export function isEditionOne(entry: { edition?: string }): boolean {
  return entry.edition === 'one'
}

export function normalizeSkillKey(skill: string): string {
  return skill.toLowerCase().trim()
}

export function isSkillInList(skill: string, list: string[]): boolean {
  const key = normalizeSkillKey(skill)
  return list.some((s) => normalizeSkillKey(s) === key)
}

/** Expertise doubles your Proficiency Bonus on ability checks with that skill (XPHB p.367). */
export function getLevel1ExpertiseCount(classDetail: Record<string, unknown> | null): number {
  if (!classDetail) return 0
  const features = classDetail.classFeatures as string[] | undefined
  const hasL1Expertise = features?.some((f) => /^Expertise\|/i.test(f) && /\|1$/i.test(f))
  return hasL1Expertise ? 2 : 0
}

export interface EntityRef {
  name: string
  source: string
}

/** Per-class level when multiclassing is supported. */
export interface ClassLevel {
  class: EntityRef
  level: number
  subclass?: EntityRef | null
}

export function formatClassSummary(
  character: Pick<SavedCharacter, 'class' | 'level' | 'classLevels'>
): string {
  if (character.classLevels?.length) {
    return character.classLevels.map((cl) => `${cl.class.name} ${cl.level}`).join(' / ')
  }
  return character.class.name
}

export interface SpellSlotState {
  max: number
  used: number
}

export interface ResourcePoolState {
  max: number
  used: number
  recharge: 'short' | 'long'
}

export interface CharacterSheetState {
  hp: { current: number; max: number }
  spellSlots: Record<number, SpellSlotState>
  resourcePools: Record<string, ResourcePoolState>
  cantrips: EntityRef[]
  preparedSpells: EntityRef[]
  knownSpells: EntityRef[]
  /** Warlock Mystic Arcanum (6th–9th level spells, one use each per long rest). */
  mysticArcanum: EntityRef[]
  /** Mystic arcanum casts since last long rest. */
  arcanumUsed: EntityRef[]
  optionalFeatures: EntityRef[]
  concentration: EntityRef | null
  panelLayout?: SheetPanelLayout[]
}

import type { CreatorEdition, OriginFeatSelection } from './origin-feat'
import { featGrantsTough, mergeFeatVersion } from './origin-feat'
import type { StartingInventory } from './starting-equipment'

export interface SavedCharacter {
  id: string
  version: 1 | 2
  createdAt: string
  updatedAt: string
  name: string
  level: number
  alignment: Alignment
  creatorEdition?: CreatorEdition
  class: EntityRef
  classLevels?: ClassLevel[]
  subclass?: EntityRef | null
  background: EntityRef
  species: EntityRef
  originFeat: string
  originFeatSelections?: OriginFeatSelection[]
  feats?: EntityRef[]
  languages?: string[]
  weaponProficiencies?: string[]
  scoreMethod: ScoreMethod
  baseAbilityScores: Record<Ability, number>
  abilityScores: Record<Ability, number>
  backgroundBoost: {
    mode: BackgroundBoostMode
    plusTwo?: Ability
    plusOne?: Ability
  }
  /** 2014 species ASI choices — one array per choose block on the species. */
  speciesAsiChoices?: Ability[][]
  skills: {
    background: string[]
    class: string[]
    expertise: string[]
  }
  tools: string[]
  savingThrows: Ability[]
  combat: {
    maxHp: number
    ac: number
    initiativeMod: number
    proficiencyBonus: number
    hitDie: number
  }
  passivePerception: number
  enabledSources: string[]
  inventory?: StartingInventory
  sheet?: CharacterSheetState
}

export interface SavedCharacterSummary {
  id: string
  name: string
  className: string
  speciesName: string
  backgroundName: string
  level: number
  alignment: Alignment
  updatedAt: string
}

export function getBackgroundAbilities(detail: Record<string, unknown>): Ability[] {
  const ability = detail.ability as
    | Array<{ choose?: { weighted?: { from?: string[] } } }>
    | undefined
  return (ability?.[0]?.choose?.weighted?.from ?? []) as Ability[]
}

export function parseNamedProficiencies(
  list: Array<Record<string, unknown>> | undefined
): string[] {
  if (!list?.length) return []
  const result: string[] = []
  for (const block of list) {
    for (const key of Object.keys(block)) {
      if (block[key] === true) {
        result.push(key.replace(/\|.*$/, '').replace(/;.*$/, ''))
      }
    }
  }
  return result
}

export function parseBackgroundFeat(detail: Record<string, unknown>): string {
  const feats = detail.feats as Array<Record<string, boolean>> | undefined
  if (!feats?.[0]) return 'Origin Feat'
  const raw = Object.keys(feats[0])[0]
  const name = raw.split('|')[0].split(';')[0].trim()
  const tag = raw.includes(';') ? raw.split(';')[1]?.trim() : ''
  const titled = name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return tag ? `${titled} (${tag.charAt(0).toUpperCase()}${tag.slice(1)})` : titled
}

export function getClassSkillChoice(
  detail: Record<string, unknown>
): { from: string[]; count: number } | null {
  const skills = (detail.startingProficiencies as { skills?: unknown[] } | undefined)?.skills
  if (!skills?.length) return null
  for (const entry of skills) {
    const choose = (entry as { choose?: { from?: string[]; count?: number } }).choose
    if (choose?.from && choose.count) {
      return { from: choose.from, count: choose.count }
    }
  }
  return null
}

export function getClassSavingThrows(detail: Record<string, unknown>): Ability[] {
  return (detail.proficiency as Ability[] | undefined) ?? []
}

export function getHitDieFaces(detail: Record<string, unknown>): number {
  return (detail.hd as { faces?: number } | undefined)?.faces ?? 8
}

export function computeMaxHp(classDetail: Record<string, unknown>, conScore: number): number {
  return getHitDieFaces(classDetail) + abilityModifier(conScore)
}

export function applyBackgroundBoosts(
  scores: Record<Ability, number>,
  mode: BackgroundBoostMode,
  options: Ability[],
  twoTarget?: Ability,
  oneTarget?: Ability
): Record<Ability, number> {
  const result = { ...scores }
  if (mode === 'all-one') {
    for (const ab of options) {
      result[ab] = Math.min(20, result[ab] + 1)
    }
  } else if (twoTarget && oneTarget) {
    result[twoTarget] = Math.min(20, result[twoTarget] + 2)
    result[oneTarget] = Math.min(20, result[oneTarget] + 1)
  }
  return result
}

export function skillModifier(
  skill: string,
  scores: Record<Ability, number>,
  proficient: boolean,
  expertise = false
): number {
  const ability = SKILL_TO_ABILITY[normalizeSkillKey(skill)] ?? 'wis'
  const mod = abilityModifier(scores[ability])
  if (!proficient) return mod
  const bonus = PROFICIENCY_BONUS * (expertise ? 2 : 1)
  return mod + bonus
}

export function passivePerception(
  scores: Record<Ability, number>,
  proficient: boolean,
  expertise = false
): number {
  return 10 + skillModifier('perception', scores, proficient, expertise)
}

export function filterClassSkillOptions(classSkills: string[], backgroundSkills: string[]): string[] {
  return classSkills.filter((skill) => !isSkillInList(skill, backgroundSkills))
}

export function buildSavedCharacter(input: {
  id?: string
  name: string
  alignment: Alignment
  creatorEdition?: CreatorEdition
  classEntry: EntityRef
  backgroundEntry: EntityRef
  speciesEntry: EntityRef
  originFeat: string
  originFeatSelections?: OriginFeatSelection[]
  originFeatDetails?: Record<string, Record<string, unknown>>
  scoreMethod: ScoreMethod
  baseScores: Record<Ability, number>
  finalScores: Record<Ability, number>
  backgroundBoost: SavedCharacter['backgroundBoost']
  speciesAsiChoices?: Ability[][]
  backgroundSkills: string[]
  classSkills: string[]
  expertiseSkills: string[]
  tools: string[]
  languages?: string[]
  weapons?: string[]
  savingThrows: Ability[]
  classDetail: Record<string, unknown>
  enabledSources: string[]
  subclassEntry?: EntityRef | null
  inventory?: StartingInventory
  existingSheet?: CharacterSheetState
  createdAt?: string
}): SavedCharacter {
  const now = new Date().toISOString()
  const conMod = abilityModifier(input.finalScores.con)
  const dexMod = abilityModifier(input.finalScores.dex)
  const allSkills = [...input.backgroundSkills, ...input.classSkills]
  const ppExpert = isSkillInList('perception', input.expertiseSkills)

  let maxHp = computeMaxHp(input.classDetail, input.finalScores.con)
  if (input.originFeatSelections?.length && input.originFeatDetails) {
    for (const sel of input.originFeatSelections) {
      const detail = input.originFeatDetails[sel.refId]
      if (detail && featGrantsTough(mergeFeatVersion(detail, sel.variant))) {
        maxHp += 2
      }
    }
  }

  const featCantrips =
    input.originFeatSelections?.flatMap((s) => s.choices.cantrips ?? []) ?? []
  const featSpells =
    input.originFeatSelections?.flatMap((s) => s.choices.spells ?? []) ?? []

  const defaultSheet: CharacterSheetState = {
    hp: { current: maxHp, max: maxHp },
    spellSlots: {},
    resourcePools: {},
    cantrips: featCantrips,
    preparedSpells: featSpells,
    knownSpells: featSpells,
    optionalFeatures: [],
    concentration: null
  }

  const sheet = input.existingSheet
    ? {
        ...input.existingSheet,
        hp: { current: maxHp, max: maxHp },
        cantrips:
          input.existingSheet.cantrips.length > 0
            ? input.existingSheet.cantrips
            : featCantrips,
        preparedSpells:
          input.existingSheet.preparedSpells.length > 0
            ? input.existingSheet.preparedSpells
            : featSpells,
        knownSpells:
          input.existingSheet.knownSpells.length > 0
            ? input.existingSheet.knownSpells
            : featSpells
      }
    : defaultSheet

  return {
    id: input.id ?? globalThis.crypto.randomUUID(),
    version: 2,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    name: input.name.trim() || 'Unnamed Hero',
    level: 1,
    alignment: input.alignment,
    creatorEdition: input.creatorEdition,
    class: input.classEntry,
    subclass: input.subclassEntry ?? null,
    background: input.backgroundEntry,
    species: input.speciesEntry,
    originFeat: input.originFeat,
    originFeatSelections: input.originFeatSelections,
    languages: input.languages,
    weaponProficiencies: input.weapons,
    scoreMethod: input.scoreMethod,
    baseAbilityScores: input.baseScores,
    abilityScores: input.finalScores,
    backgroundBoost: input.backgroundBoost,
    speciesAsiChoices: input.speciesAsiChoices,
    skills: {
      background: input.backgroundSkills,
      class: input.classSkills,
      expertise: input.expertiseSkills
    },
    tools: input.tools,
    savingThrows: input.savingThrows,
    combat: {
      maxHp,
      ac: 10 + dexMod,
      initiativeMod: dexMod,
      proficiencyBonus: PROFICIENCY_BONUS,
      hitDie: getHitDieFaces(input.classDetail)
    },
    passivePerception: passivePerception(
      input.finalScores,
      isSkillInList('perception', allSkills),
      ppExpert
    ),
    enabledSources: input.enabledSources,
    inventory: input.inventory,
    sheet
  }
}

export function migrateCharacter(raw: Record<string, unknown>): SavedCharacter {
  const char = raw as SavedCharacter
  const defaultSheet: CharacterSheetState = {
    hp: { current: char.combat?.maxHp ?? 10, max: char.combat?.maxHp ?? 10 },
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

  const skills = char.skills ?? { background: [], class: [], expertise: [] }

  if (char.version === 2 && char.sheet?.hp) {
    return {
      ...char,
      subclass: char.subclass ?? null,
      creatorEdition: char.creatorEdition ?? '2024',
      originFeatSelections: char.originFeatSelections ?? [],
      languages: char.languages ?? [],
      weaponProficiencies: char.weaponProficiencies ?? [],
      inventory: char.inventory ?? { items: [], goldCp: 0 },
      skills: {
        background: skills.background ?? [],
        class: skills.class ?? [],
        expertise: skills.expertise ?? []
      },
      enabledSources: char.enabledSources ?? []
    }
  }

  return {
    ...char,
    version: 2,
    subclass: char.subclass ?? null,
    creatorEdition: char.creatorEdition ?? '2024',
    originFeatSelections: char.originFeatSelections ?? [],
    languages: char.languages ?? [],
    weaponProficiencies: char.weaponProficiencies ?? [],
    inventory: char.inventory ?? { items: [], goldCp: 0 },
    skills: {
      background: skills.background ?? [],
      class: skills.class ?? [],
      expertise: skills.expertise ?? []
    },
    enabledSources: char.enabledSources ?? [],
    sheet: char.sheet?.hp ? char.sheet : defaultSheet
  }
}

export function formatSkillName(skill: string): string {
  return skill
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function suggestStandardArray(className: string): Record<Ability, number> {
  return STANDARD_ARRAY_BY_CLASS[className] ?? {
    str: 15,
    dex: 14,
    con: 13,
    int: 12,
    wis: 10,
    cha: 8
  }
}
