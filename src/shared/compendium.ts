import type { CompendiumEntry, CompendiumEntityType } from './types'
import type { CreatorEdition } from './origin-feat'

export const SPELL_SCHOOL_NAMES: Record<string, string> = {
  A: 'Abjuration',
  B: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  I: 'Illusion',
  N: 'Necromancy',
  P: 'Enchantment',
  T: 'Transmutation',
  V: 'Evocation'
}

/** 2024-era source abbreviations (5.5e/2024). */
export const SOURCES_2024 = new Set([
  'XPHB',
  'XDMG',
  'XMM',
  'EFA',
  'XScreen',
  'FRHoF',
  'RHW',
  'ABH',
  'LFL',
  'XSAC'
])

/** WotC sources superseded by 2024 reprints — marked [ʟ] on 5e.tools. */
export const LEGACY_WOTC_SOURCES = new Set(['PHB', 'DMG', 'MM', 'SCREEN', 'EEPC', 'VGM', 'MTF'])

export type EditionFilter = 'all' | 'one' | 'classic'

export const EDITION_FILTER_OPTIONS: { value: EditionFilter; label: string }[] = [
  { value: 'all', label: 'All editions' },
  { value: 'one', label: '5.5e/2024' },
  { value: 'classic', label: '5e/2014' }
]

export type MiscFilter =
  | 'srd-5-1'
  | 'srd-5-2'
  | 'basic-rules-2014'
  | 'basic-rules-2024'
  | 'legacy'
  | 'reprinted'
  | 'ritual'
  | 'lineage'
  | 'playable-race'

export interface MiscFilterOption {
  value: MiscFilter
  label: string
  categories?: CompendiumEntityType[]
}

/** Miscellaneous tags aligned with 5e.tools filter labels. */
export const MISC_FILTER_OPTIONS: MiscFilterOption[] = [
  { value: 'srd-5-1', label: 'SRD 5.1' },
  { value: 'srd-5-2', label: 'SRD 5.2' },
  { value: 'basic-rules-2014', label: 'Basic Rules (5e/2014)' },
  { value: 'basic-rules-2024', label: 'Basic Rules (5.5e/2024)' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'reprinted', label: 'Reprinted' },
  { value: 'ritual', label: 'Ritual', categories: ['spell'] },
  { value: 'lineage', label: 'Lineage', categories: ['race'] },
  { value: 'playable-race', label: 'Playable Race', categories: ['race'] }
]

/** Detect 2024-rules content (spells often lack edition: "one" but have srd52 or XPHB source). */
export function is2024Content(entry: CompendiumEntry): boolean {
  if (entry.edition === 'one') return true
  if (entry.srd52 || entry.basicRules2024) return true
  if (SOURCES_2024.has(entry.source)) return true
  return false
}

export function getEditionLabel(entry: CompendiumEntry): string | null {
  return is2024Content(entry) ? '5.5e/2024' : '5e/2014'
}

export function isLegacySource(source: string): boolean {
  return LEGACY_WOTC_SOURCES.has(source)
}

export function entryMiscTags(entry: CompendiumEntry): MiscFilter[] {
  const tags: MiscFilter[] = []
  if (entry.srd) tags.push('srd-5-1')
  if (entry.srd52) tags.push('srd-5-2')
  if (entry.basicRules) tags.push('basic-rules-2014')
  if (entry.basicRules2024) tags.push('basic-rules-2024')
  if (entry.legacy || isLegacySource(entry.source)) tags.push('legacy')
  if (entry.reprinted) tags.push('reprinted')
  if (entry.ritual) tags.push('ritual')
  if (entry.lineage) tags.push('lineage')
  if (!entry.npcRace) tags.push('playable-race')
  return tags
}

export function matchesMiscFilter(entry: CompendiumEntry, misc: MiscFilter): boolean {
  return entryMiscTags(entry).includes(misc)
}

export function miscOptionsForCategory(
  type: CompendiumEntityType,
  available: MiscFilter[]
): MiscFilterOption[] {
  return MISC_FILTER_OPTIONS.filter((opt) => {
    if (opt.categories && !opt.categories.includes(type)) return false
    return available.includes(opt.value)
  })
}

export function formatSpellSchool(code: string | undefined): string {
  if (!code) return ''
  return SPELL_SCHOOL_NAMES[code] ?? code
}

/** Match entry names by substring; every whitespace-separated word must appear in the name. */
export function matchesNameSearch(name: string, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  const haystack = name.toLowerCase()
  return trimmed.split(/\s+/).every((word) => haystack.includes(word))
}

/** Whether a spell source belongs to the character's rules edition (PHB vs XPHB, etc.). */
export function spellMatchesEdition(source: string, edition: CreatorEdition): boolean {
  const src = source.toUpperCase()
  if (edition === '2024') {
    return src !== 'PHB'
  }
  return !SOURCES_2024.has(src)
}

export function filterSpellsForEdition<T extends { source: string }>(
  spells: T[],
  edition: CreatorEdition
): T[] {
  return spells.filter((spell) => spellMatchesEdition(spell.source, edition))
}
