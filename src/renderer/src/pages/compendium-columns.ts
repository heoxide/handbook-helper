import type { CompendiumEntityType } from '../../../shared/types'
import type { ColumnSortType } from '../../../shared/compendium-sort'

export interface CompendiumColumn {
  id: string
  label: string
  title?: string
  filterKey?: ColumnFilterKey
  sortType?: ColumnSortType
}

export type ColumnFilterKey = 'level' | 'school' | 'concentration' | 'source' | 'rarity'

export const COMPENDIUM_COLUMNS: Partial<Record<CompendiumEntityType, CompendiumColumn[]>> = {
  spell: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'level', label: 'Level', filterKey: 'level', sortType: 'numeric' },
    { id: 'time', label: 'Time', sortType: 'alpha' },
    { id: 'school', label: 'School', filterKey: 'school', sortType: 'alpha' },
    { id: 'concentration', label: 'C.', title: 'Concentration', filterKey: 'concentration', sortType: 'numeric' },
    { id: 'range', label: 'Range', sortType: 'numeric' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' }
  ],
  monster: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'cr', label: 'CR', sortType: 'numeric' },
    { id: 'type', label: 'Type', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' }
  ],
  item: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'type', label: 'Type', sortType: 'alpha' },
    { id: 'rarity', label: 'Rarity', filterKey: 'rarity', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' }
  ],
  feat: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' },
    { id: 'page', label: 'Page', sortType: 'numeric' }
  ],
  race: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' },
    { id: 'page', label: 'Page', sortType: 'numeric' }
  ],
  class: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' },
    { id: 'page', label: 'Page', sortType: 'numeric' }
  ],
  background: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' },
    { id: 'page', label: 'Page', sortType: 'numeric' }
  ],
  optionalfeature: [
    { id: 'name', label: 'Name', sortType: 'alpha' },
    { id: 'featureType', label: 'Type', sortType: 'alpha' },
    { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' }
  ]
}

const DEFAULT_COLUMNS: CompendiumColumn[] = [
  { id: 'name', label: 'Name', sortType: 'alpha' },
  { id: 'source', label: 'Source', filterKey: 'source', sortType: 'alpha' },
  { id: 'page', label: 'Page', sortType: 'numeric' }
]

export function getCompendiumColumns(type: CompendiumEntityType): CompendiumColumn[] {
  return COMPENDIUM_COLUMNS[type] ?? DEFAULT_COLUMNS
}

export function getCompendiumGridClass(type: CompendiumEntityType): string {
  switch (type) {
    case 'spell':
      return 'compendium-grid-spell'
    case 'monster':
      return 'compendium-grid-monster'
    case 'item':
      return 'compendium-grid-item'
    case 'optionalfeature':
      return 'compendium-grid-optionalfeature'
    default:
      return 'compendium-grid-default'
  }
}
