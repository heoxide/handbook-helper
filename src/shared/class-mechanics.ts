import type { Ability, EntityRef } from './character'
import { abilityModifier } from './character'

export type { EntityRef }

export interface ClassBundle {
  class: Record<string, unknown>[]
  subclass: Record<string, unknown>[]
  classFeature: Record<string, unknown>[]
  subclassFeature: Record<string, unknown>[]
}

export interface SubclassOption {
  name: string
  shortName: string
  source: string
  className: string
  classSource: string
}

export interface ParsedClassTable {
  cantripsKnown: number
  preparedSpells: number
  spellsKnown: number
  spellSlots: number[]
  resourcePools: ResourcePoolDef[]
  columns: { label: string; value: number | string }[]
  casterProgression?: string
  /** Warlock Mystic Arcanum — spell level (6–9) → slots available at current level. */
  mysticArcanum: Record<number, number>
}

export interface ParseClassTableOptions {
  abilityScores?: Record<Ability, number>
}

export interface ResourcePoolDef {
  id: string
  label: string
  max: number
  recharge: 'short' | 'long'
}

export interface ClassFeatureEntry {
  uid: string
  name: string
  level: number
  source: string
  consumes?: { name: string; amount?: number }
  entries: unknown[]
  entriesHigherLevel?: unknown[]
  header?: number
  isSubclass?: boolean
}

export interface OptionalFeatureProgression {
  name: string
  featureTypes: string[]
  count: number
}

/** Strip {@filter ...} and similar 5e.tools tags to plain labels. */
export function strip5eTags(text: string): string {
  const filter = text.match(/\{@filter\s([^|}]+)/i)
  if (filter) return filter[1].trim()
  return text.replace(/\{@\w+\s([^|}]+)(?:\|[^}]*)?\}/g, '$1').trim()
}

export function proficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2
}

const RESOURCE_RECHARGE: Record<string, 'short' | 'long'> = {
  Ki: 'short',
  'Ki Points': 'short',
  'Focus Points': 'short',
  'Focus Point': 'short',
  'Sorcery Points': 'long',
  'Sorcery Point': 'long',
  Rages: 'long',
  Rage: 'long',
  'Channel Divinity': 'short',
  'Second Wind': 'short',
  'Infusions Known': 'long',
  'Infused Items': 'long',
  'Wild Shape': 'long',
  'Bardic Inspiration': 'long',
  'Lay on Hands': 'long',
  'Divine Sense': 'long',
  'Pact Slots': 'short',
  'Pact Magic': 'short',
  'Magical Tinkering': 'long',
  'Flash of Genius': 'long',
  'Steel Defender': 'long',
  'Psi Points': 'short'
}

const SKIP_RESOURCE_LABELS = new Set([
  'cantrips',
  'cantrips known',
  'prepared spells',
  'spells known',
  'spell slots per spell level',
  'spell slots',
  'slot level',
  'invocations known',
  'plans known',
  'magic items',
  'talents known',
  'disciplines known',
  'favored enemy',
  'weapon mastery',
  'sneak attack',
  'martial arts',
  'unarmored movement',
  'rage damage',
  'bardic die',
  'infusions known',
  'infused items',
  'psi limit',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th'
])

function cellValue(cell: unknown): number {
  if (typeof cell === 'number') return cell
  if (cell && typeof cell === 'object' && 'value' in cell) {
    return Number((cell as { value: number }).value) || 0
  }
  return 0
}

const FORMULA_MOD_TOKENS: Record<string, Ability> = {
  str_mod: 'str',
  strength_mod: 'str',
  dex_mod: 'dex',
  dexterity_mod: 'dex',
  con_mod: 'con',
  constitution_mod: 'con',
  int_mod: 'int',
  intelligence_mod: 'int',
  wis_mod: 'wis',
  wisdom_mod: 'wis',
  cha_mod: 'cha',
  charisma_mod: 'cha'
}

function safeMathEval(expression: string): number {
  let expr = expression.trim()
  expr = expr.replace(/\bfloor\b/g, 'Math.floor')
  expr = expr.replace(/\bceil\b/g, 'Math.ceil')
  expr = expr.replace(/\bmax\b/g, 'Math.max')
  expr = expr.replace(/\bmin\b/g, 'Math.min')
  const compact = expr.replace(/\s+/g, '')
  if (!/^[\d+\-*/().Mathmaxinflor ce]+$/i.test(compact)) return 0
  try {
    const value = Function(`"use strict"; return (${expr})`)() as number
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

/** Evaluate 5etools prepared-spell formulas such as "<$level$> / 2 + <$wis_mod$>". */
export function evaluatePreparedSpellsFormula(
  formula: string,
  level: number,
  abilityScores: Record<Ability, number>,
  spellAbility: Ability | null
): number {
  let expr = formula
  expr = expr.replace(/<\$level\$>/gi, String(level))
  expr = expr.replace(/<\$proficiency_bonus\$>/gi, String(proficiencyBonus(level)))
  for (const [token, ability] of Object.entries(FORMULA_MOD_TOKENS)) {
    expr = expr.replace(
      new RegExp(`<\\$${token}\\$>`, 'gi'),
      String(abilityModifier(abilityScores[ability]))
    )
  }
  if (spellAbility) {
    expr = expr.replace(
      /<\$spellcasting_mod\$>/gi,
      String(abilityModifier(abilityScores[spellAbility]))
    )
  }
  expr = expr.replace(/<\$[^$]+\$>/g, '0')
  return Math.max(0, Math.floor(safeMathEval(expr)))
}

function parseSlotLevelFromCell(raw: unknown): number {
  if (typeof raw === 'number') return raw
  const text = String(raw ?? '')
  const fromFilter = text.match(/level=(\d+)/i)
  if (fromFilter) return Number(fromFilter[1])
  const ordinal = text.match(/(\d+)(?:st|nd|rd|th)/i)
  if (ordinal) return Number(ordinal[1])
  return cellValue(raw)
}

function parseMysticArcanum(
  classDetail: Record<string, unknown>,
  level: number
): Record<number, number> {
  const fixed = classDetail.spellsKnownProgressionFixedByLevel as
    | Array<{ level?: number; spellsKnown?: number; lower?: number }>
    | Record<string, Record<string, number>>
    | undefined
  const result: Record<number, number> = {}
  if (!fixed) return result

  if (Array.isArray(fixed)) {
    for (const entry of fixed) {
      const unlock = Number(entry.level ?? 0)
      const spellLevel = Number(entry.lower ?? 0)
      if (unlock > 0 && unlock <= level && spellLevel >= 6 && spellLevel <= 9) {
        result[spellLevel] = (result[spellLevel] ?? 0) + Number(entry.spellsKnown ?? 1)
      }
    }
    return result
  }

  if (typeof fixed === 'object') {
    for (const [unlockStr, byLevel] of Object.entries(fixed)) {
      const unlock = Number(unlockStr)
      if (!Number.isFinite(unlock) || unlock > level) continue
      if (!byLevel || typeof byLevel !== 'object') continue
      for (const [spellLevelStr, count] of Object.entries(byLevel)) {
        const spellLevel = Number(spellLevelStr)
        if (spellLevel >= 6 && spellLevel <= 9) {
          result[spellLevel] = (result[spellLevel] ?? 0) + Number(count ?? 1)
        }
      }
    }
  }

  return result
}

export function getSubclassDetail(
  bundle: ClassBundle,
  subclass: { name: string; source: string }
): Record<string, unknown> | undefined {
  return bundle.subclass.find(
    (s) => String(s.name) === subclass.name && String(s.source) === subclass.source
  ) as Record<string, unknown> | undefined
}

/** Merge subclass spellcasting columns/progression onto the base class entry. */
export function resolveEffectiveClassDetail(
  classDetail: Record<string, unknown>,
  subclassDetail?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!subclassDetail) return classDetail
  const effective: Record<string, unknown> = { ...classDetail }

  if (subclassDetail.casterProgression && !classDetail.casterProgression) {
    effective.casterProgression = subclassDetail.casterProgression
  }
  if (subclassDetail.spellcastingAbility && !classDetail.spellcastingAbility) {
    effective.spellcastingAbility = subclassDetail.spellcastingAbility
  }
  if (subclassDetail.cantripProgression && !classDetail.cantripProgression) {
    effective.cantripProgression = subclassDetail.cantripProgression
  }
  if (subclassDetail.spellsKnownProgression && !classDetail.spellsKnownProgression) {
    effective.spellsKnownProgression = subclassDetail.spellsKnownProgression
  }
  if (subclassDetail.preparedSpells && !classDetail.preparedSpells) {
    effective.preparedSpells = subclassDetail.preparedSpells
  }
  if (subclassDetail.preparedSpellsProgression && !classDetail.preparedSpellsProgression) {
    effective.preparedSpellsProgression = subclassDetail.preparedSpellsProgression
  }

  const subGroups = subclassDetail.subclassTableGroups as Record<string, unknown>[] | undefined
  if (subGroups?.length) {
    effective.classTableGroups = [
      ...((classDetail.classTableGroups as Record<string, unknown>[]) ?? []),
      ...subGroups
    ]
  }

  return effective
}

export function getCasterProgression(classDetail: Record<string, unknown>): string | undefined {
  const raw = classDetail.casterProgression
  return typeof raw === 'string' ? raw : undefined
}

export function isPactCaster(classDetail: Record<string, unknown>): boolean {
  return getCasterProgression(classDetail) === 'pact'
}

export function optionalFeatureMatchesTypes(
  feature: Record<string, unknown>,
  types: string[]
): boolean {
  const ft = feature.featureType
  if (Array.isArray(ft)) return ft.some((t) => types.includes(String(t)))
  if (typeof ft === 'string') return types.includes(ft)
  return false
}

export function getMysticArcanumLimit(table: ParsedClassTable): number {
  return Object.values(table.mysticArcanum).reduce((sum, count) => sum + count, 0)
}

export function parseClassTable(
  classDetail: Record<string, unknown>,
  level: number,
  options?: ParseClassTableOptions
): ParsedClassTable {
  const idx = Math.max(0, Math.min(19, level - 1))
  const groups = (classDetail.classTableGroups as Record<string, unknown>[]) ?? []

  let cantripsKnown = 0
  let preparedSpells = 0
  let spellsKnown = 0
  let spellSlots: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  let pactSlotCount = 0
  let pactSlotLevel = 0
  const resourcePools: ResourcePoolDef[] = []
  const columns: { label: string; value: number | string }[] = []

  const cantripProg = classDetail.cantripProgression as number[] | undefined
  if (cantripProg?.[idx] !== undefined) cantripsKnown = cantripProg[idx]

  const prepProg = classDetail.preparedSpellsProgression as number[] | undefined
  if (prepProg?.[idx] !== undefined) preparedSpells = prepProg[idx]

  const knownProg = classDetail.spellsKnownProgression as number[] | undefined
  if (knownProg?.[idx] !== undefined) spellsKnown = knownProg[idx]

  for (const group of groups) {
    if (group.rowsSpellProgression) {
      const row = (group.rowsSpellProgression as number[][])[idx]
      if (row) spellSlots = [...row]
      continue
    }

    const labels = ((group.colLabels as string[]) ?? []).map(strip5eTags)
    const row = (group.rows as unknown[][])?.[idx]
    if (!row) continue

    labels.forEach((label, colIdx) => {
      const raw = row[colIdx]
      const value = typeof raw === 'number' ? raw : cellValue(raw)
      const lower = label.toLowerCase()

      columns.push({ label, value })

      if (lower.includes('cantrip')) cantripsKnown = Math.max(cantripsKnown, value)
      if (lower.includes('prepared')) preparedSpells = Math.max(preparedSpells, value)
      if (lower.includes('spells known')) spellsKnown = Math.max(spellsKnown, value)
      if (lower === 'spell slots' && typeof value === 'number') pactSlotCount = value
      if (lower === 'slot level') pactSlotLevel = parseSlotLevelFromCell(raw)

      if (
        typeof value === 'number' &&
        value >= 0 &&
        !SKIP_RESOURCE_LABELS.has(lower) &&
        !/^\d+(st|nd|rd|th)$/i.test(label)
      ) {
        const recharge =
          RESOURCE_RECHARGE[label] ?? RESOURCE_RECHARGE[label.replace(/ Points$/, '')] ?? 'long'
        resourcePools.push({
          id: label,
          label,
          max: value,
          recharge
        })
      }
    })
  }

  if (options?.abilityScores) {
    const formula = classDetail.preparedSpells
    if (typeof formula === 'string' && formula.trim()) {
      preparedSpells = Math.max(
        preparedSpells,
        evaluatePreparedSpellsFormula(
          formula,
          level,
          options.abilityScores,
          spellcastingAbility(classDetail)
        )
      )
    }
  }

  if (isPactCaster(classDetail) && pactSlotCount > 0 && pactSlotLevel > 0) {
    spellSlots = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    spellSlots[pactSlotLevel - 1] = pactSlotCount
  }

  const mysticArcanum = parseMysticArcanum(classDetail, level)

  return {
    cantripsKnown,
    preparedSpells,
    spellsKnown,
    spellSlots,
    resourcePools,
    columns,
    casterProgression: getCasterProgression(classDetail),
    mysticArcanum
  }
}

/** Highest spell level the character has slots for (e.g. level 5 Artificer → 2). */
export function getMaxCastableSpellLevel(table: ParsedClassTable): number {
  for (let i = table.spellSlots.length - 1; i >= 0; i--) {
    if (table.spellSlots[i] > 0) return i + 1
  }
  return 0
}

export interface ClassSpellSubclassRef {
  name: string
  className: string
  classSource: string
}

export function getSubclasses(
  bundle: ClassBundle,
  className: string,
  classSource: string,
  enabledSources?: string[]
): SubclassOption[] {
  const enabled = enabledSources?.length ? new Set(enabledSources) : null
  return (bundle.subclass ?? [])
    .filter(
      (s) =>
        String(s.className) === className &&
        String(s.classSource) === classSource &&
        !s._copy &&
        (!enabled || enabled.has(String(s.source)))
    )
    .map((s) => ({
      name: String(s.name),
      shortName: String(s.shortName ?? s.name),
      source: String(s.source),
      className: String(s.className),
      classSource: String(s.classSource)
    }))
}

const SKIP_CLASS_FEATURE_NAMES = new Set(['spellcasting', 'pact magic'])

function isSkippedClassFeature(name: string): boolean {
  return SKIP_CLASS_FEATURE_NAMES.has(name.toLowerCase())
}

function parseFeatureUid(uid: string): { name: string; level: number } | null {
  const parts = uid.split('|')
  const level = Number.parseInt(parts[parts.length - 1] ?? '', 10)
  if (!Number.isFinite(level)) return null
  return { name: parts[0] ?? uid, level }
}

function buildFeatureUid(f: Record<string, unknown>): string {
  return [
    f.name,
    f.className,
    f.classSource ?? '',
    f.subclassShortName ?? '',
    f.subclassSource ?? '',
    f.level
  ]
    .filter((x) => x !== undefined && x !== '')
    .join('|')
}

function findFeatureBody(
  bundle: ClassBundle,
  uid: string,
  kind: 'class' | 'subclass',
  subclass?: SubclassOption | null
): Record<string, unknown> | undefined {
  const list = kind === 'class' ? bundle.classFeature : bundle.subclassFeature
  if (!list?.length) return undefined

  const exact = list.find((f) => buildFeatureUid(f) === uid)
  if (exact) return exact

  const parsed = parseFeatureUid(uid)
  if (!parsed) return undefined

  return list.find((f) => {
    if (String(f.name) !== parsed.name) return false
    if (Number(f.level) !== parsed.level) return false
    if (kind === 'subclass') {
      if (!f.subclassShortName && !f.subclassSource) return true
      if (subclass) {
        const short = subclass.shortName || subclass.name
        if (f.subclassShortName && String(f.subclassShortName) !== short) return false
        if (f.subclassSource && String(f.subclassSource) !== subclass.source) return false
      }
      return true
    }
    return !f.subclassShortName
  })
}

function mapFeatureEntry(
  body: Record<string, unknown> | undefined,
  base: Omit<ClassFeatureEntry, 'entries' | 'entriesHigherLevel'>
): ClassFeatureEntry {
  return {
    ...base,
    consumes: body?.consumes as ClassFeatureEntry['consumes'],
    entries: (body?.entries as unknown[]) ?? [],
    entriesHigherLevel: (body?.entriesHigherLevel as unknown[]) ?? undefined,
    header: body?.header as number | undefined
  }
}

export function requiresSubclassAtLevel(
  classDetail: Record<string, unknown>,
  level: number
): boolean {
  const classFeatures = (classDetail.classFeatures as unknown[]) ?? []
  for (const item of classFeatures) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if (!obj.gainSubclassFeature) continue
    const uid = String(obj.classFeature ?? '')
    const parsed = parseFeatureUid(uid)
    if (parsed && parsed.level === level) return true
  }
  return false
}

export function isAsiOrFeatFeature(name: string): 'asi' | 'epic-boon' | null {
  const lower = name.toLowerCase()
  if (lower.includes('epic boon')) return 'epic-boon'
  if (
    lower.includes('ability score improvement') ||
    lower.includes('ability score increase')
  ) {
    return 'asi'
  }
  return null
}

export function getNewFeaturesAtLevel(
  bundle: ClassBundle,
  classDetail: Record<string, unknown>,
  level: number,
  subclass?: SubclassOption | null
): ClassFeatureEntry[] {
  return getFeaturesForLevel(bundle, classDetail, level, subclass).filter(
    (f) => f.level === level
  )
}

export function getFeaturesForLevel(
  bundle: ClassBundle,
  classDetail: Record<string, unknown>,
  level: number,
  subclass?: SubclassOption | null
): ClassFeatureEntry[] {
  const features: ClassFeatureEntry[] = []
  const classFeatures = (classDetail.classFeatures as unknown[]) ?? []

  for (const item of classFeatures) {
    if (typeof item === 'string') {
      const parsed = parseFeatureUid(item)
      if (!parsed || parsed.level > level || isSkippedClassFeature(parsed.name)) continue
      const body = findFeatureBody(bundle, item, 'class')
      features.push(
        mapFeatureEntry(body, {
          uid: item,
          name: parsed.name,
          level: parsed.level,
          source: String(body?.source ?? '')
        })
      )
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const uid = String(obj.classFeature ?? '')
      const parsed = parseFeatureUid(uid)
      const displayName = String(obj.tableDisplayName ?? parsed?.name ?? '')
      if (
        !parsed ||
        parsed.level > level ||
        isSkippedClassFeature(parsed.name) ||
        isSkippedClassFeature(displayName)
      ) {
        continue
      }
      if (obj.gainSubclassFeature && !subclass) continue
      const body = findFeatureBody(bundle, uid, 'class')
      features.push(
        mapFeatureEntry(body, {
          uid,
          name: String(obj.tableDisplayName ?? parsed.name),
          level: parsed.level,
          source: String(body?.source ?? ''),
          isSubclass: Boolean(obj.gainSubclassFeature)
        })
      )
    }
  }

  if (subclass) {
    const uids = (subclass as unknown as Record<string, unknown>).subclassFeatures as
      | string[]
      | undefined
    const sub = bundle.subclass.find(
      (s) => s.name === subclass.name && s.source === subclass.source
    )
    for (const uid of sub?.subclassFeatures as string[] ?? uids ?? []) {
      const parsed = parseFeatureUid(uid)
      if (!parsed || parsed.level > level || isSkippedClassFeature(parsed.name)) continue
      const body = findFeatureBody(bundle, uid, 'subclass', subclass)
      features.push(
        mapFeatureEntry(body, {
          uid,
          name: parsed.name,
          level: parsed.level,
          source: String(body?.source ?? subclass.source),
          isSubclass: true
        })
      )
    }
  }

  return features.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

export function getOptionalFeatureProgression(
  classDetail: Record<string, unknown>,
  level: number
): OptionalFeatureProgression[] {
  const progressions = (classDetail.optionalfeatureProgression as Record<string, unknown>[]) ?? []
  const idx = Math.max(0, Math.min(19, level - 1))
  const result: OptionalFeatureProgression[] = []

  for (const prog of progressions) {
    const name = String(prog.name ?? 'Options')
    const featureTypes = (prog.featureType as string[]) ?? []
    let count = 0
    const progression = prog.progression
    if (Array.isArray(progression)) {
      count = Number(progression[idx] ?? 0)
    } else if (progression && typeof progression === 'object') {
      const map = progression as Record<string, number>
      for (const [lvl, c] of Object.entries(map)) {
        if (Number(lvl) <= level) count = Math.max(count, c)
      }
    }
    if (count > 0) {
      result.push({ name, featureTypes, count })
    }
  }

  return result
}

export function spellcastingAbility(classDetail: Record<string, unknown>): Ability | null {
  const ab = classDetail.spellcastingAbility as string | undefined
  if (ab && ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(ab)) return ab as Ability
  return null
}

export function hasSpellcasting(classDetail: Record<string, unknown>): boolean {
  return Boolean(getCasterProgression(classDetail))
}
