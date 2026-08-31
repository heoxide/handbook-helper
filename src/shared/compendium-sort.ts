import type { CompendiumEntry } from './types'
import { formatSpellSchool } from './compendium'

export type SortDirection = 'asc' | 'desc'
export type ColumnSortType = 'alpha' | 'numeric'

export interface CompendiumSort {
  column: string
  direction: SortDirection
}

/** Default sort type per column id (shared across entity types). */
export const COLUMN_SORT_TYPES: Record<string, ColumnSortType> = {
  name: 'alpha',
  level: 'numeric',
  time: 'alpha',
  school: 'alpha',
  concentration: 'numeric',
  range: 'numeric',
  source: 'alpha',
  cr: 'numeric',
  type: 'alpha',
  rarity: 'alpha',
  page: 'numeric',
  featureType: 'alpha'
}

export function getColumnSortType(columnId: string): ColumnSortType | undefined {
  return COLUMN_SORT_TYPES[columnId]
}

function parseCr(cr: string | undefined): number {
  if (!cr) return -1
  if (cr.includes('/')) {
    const [num, den] = cr.split('/').map((part) => Number(part.trim()))
    if (num && den) return num / den
  }
  const value = Number.parseFloat(cr)
  return Number.isFinite(value) ? value : -1
}

function parseRangeSortValue(range: string | undefined): number {
  if (!range) return Number.POSITIVE_INFINITY
  const lower = range.toLowerCase()
  if (lower === 'self') return 0
  if (lower === 'touch') return 1
  if (lower === 'sight') return 2
  const match = range.match(/(\d+(?:\.\d+)?)/)
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY
}

function getAlphaSortValue(entry: CompendiumEntry, columnId: string): string {
  switch (columnId) {
    case 'name':
      return entry.name
    case 'time':
      return entry.castTime ?? ''
    case 'school':
      return entry.school ? formatSpellSchool(entry.school) : ''
    case 'source':
      return entry.sourceName ?? entry.source
    case 'type':
      return entry.monsterType ?? entry.itemType ?? ''
    case 'rarity':
      return entry.rarity ?? ''
    case 'featureType':
      return entry.featureType ?? ''
    default:
      return ''
  }
}

function getNumericSortValue(entry: CompendiumEntry, columnId: string): number {
  switch (columnId) {
    case 'level':
      return entry.level ?? Number.POSITIVE_INFINITY
    case 'page':
      return entry.page ?? Number.POSITIVE_INFINITY
    case 'cr':
      return parseCr(entry.cr)
    case 'concentration':
      return entry.concentration ? 1 : 0
    case 'range':
      return parseRangeSortValue(entry.range)
    default:
      return 0
  }
}

export function compareCompendiumEntries(
  a: CompendiumEntry,
  b: CompendiumEntry,
  column: string,
  sortType: ColumnSortType,
  direction: SortDirection
): number {
  const sign = direction === 'asc' ? 1 : -1

  if (sortType === 'numeric') {
    const diff = getNumericSortValue(a, column) - getNumericSortValue(b, column)
    if (diff !== 0) return diff * sign
  } else {
    const diff = getAlphaSortValue(a, column).localeCompare(getAlphaSortValue(b, column), undefined, {
      sensitivity: 'base'
    })
    if (diff !== 0) return diff * sign
  }

  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * sign
}

export function sortCompendiumEntries(
  entries: CompendiumEntry[],
  sort: CompendiumSort | undefined
): CompendiumEntry[] {
  if (!sort) return entries
  const sortType = getColumnSortType(sort.column)
  if (!sortType) return entries
  return [...entries].sort((a, b) =>
    compareCompendiumEntries(a, b, sort.column, sortType, sort.direction)
  )
}
