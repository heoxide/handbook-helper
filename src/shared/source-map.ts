import generated from './generated-source-map.json'
import { SOURCE_FALLBACKS } from './source-fallbacks'

export type SourceMap = { full: Record<string, string>; abv: Record<string, string> }

/** 5e.tools parser source names + abbreviations, with local fallbacks for edge cases. */
export const GENERATED_SOURCE_MAP = generated as SourceMap

export function resolveSourceFullName(code: string, overrides?: Map<string, string>): string {
  // Parser map matches 5e.tools spell/source filter labels; prefer it over adventure titles
  // like "Dragon Delves: Death at Sunset" or "Essentials Kit: Dragon of Icespire Peak".
  return GENERATED_SOURCE_MAP.full[code] ?? overrides?.get(code) ?? SOURCE_FALLBACKS[code] ?? code
}

export function resolveSourceAbbrev(code: string): string {
  return GENERATED_SOURCE_MAP.abv[code] ?? SOURCE_FALLBACKS[code] ?? code
}

/** Display order for compendium source filter groups (matches 5e.tools books/adventures menus). */
export const SOURCE_GROUP_ORDER = [
  'core',
  'supplement',
  'supplement-alt',
  'setting',
  'setting-alt',
  'adventure',
  'adventure-alt',
  'screen',
  'organized-play',
  'recipe',
  'homecraft',
  'other',
  'extras'
] as const

export type SourceGroupId = (typeof SOURCE_GROUP_ORDER)[number]

export const SOURCE_GROUP_LABELS: Record<SourceGroupId, string> = {
  core: 'Core',
  supplement: 'Supplements',
  'supplement-alt': 'Supplement Extras',
  setting: 'Settings',
  'setting-alt': 'Additional Settings',
  adventure: 'Adventures',
  'adventure-alt': 'Adventure Extras',
  screen: 'Screens',
  'organized-play': 'Organized Play',
  recipe: 'Recipes',
  homecraft: 'Home Crafts',
  other: 'Miscellaneous',
  extras: 'Extras'
}

/** Sources defined in parser.js but absent from books.json / adventures.json */
const PARSER_SOURCE_GROUPS: Partial<Record<string, SourceGroupId>> = {
  EEPC: 'supplement-alt',
  EET: 'supplement-alt',
  ESK: 'adventure',
  RoTOS: 'adventure',
  ToD: 'adventure',
  TftYP: 'adventure',
  MFF: 'supplement-alt',
  SADS: 'extras',
  AitFR: 'adventure',
  SAiS: 'setting',
  PAitM: 'setting',
  DrDe: 'adventure',
  NRH: 'adventure',
  VD: 'extras',
  'HAT-LMI': 'extras',
  HFDoMM: 'recipe',
  MCV2DC: 'supplement-alt',
  MCV3MC: 'supplement-alt',
  MisMV1: 'supplement-alt',
  UATheMysticClass: 'extras',
  Generic: 'other'
}

const ADVENTURE_CHAPTER_PREFIXES = ['TftYP-', 'DrDe-', 'NRH-', 'AitFR-', 'SCC-'] as const

export function inferSourceGroup(code: string): SourceGroupId {
  for (const prefix of ADVENTURE_CHAPTER_PREFIXES) {
    if (code.startsWith(prefix)) return 'adventure'
  }
  return PARSER_SOURCE_GROUPS[code] ?? 'extras'
}

/** Map books.json / adventures.json `group` values to compendium filter groups. */
export function mapBookGroup(group: string): SourceGroupId {
  return group as SourceGroupId
}

export function mapAdventureGroup(group: string): SourceGroupId {
  if (group === 'supplement-alt') return 'adventure-alt'
  return 'adventure'
}
