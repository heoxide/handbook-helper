export const FIVETOOLS = {
  repo: '5etools-mirror-3/5etools-src',
  rawBase: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src',
  liveBase: 'https://5e.tools',
  dataPrefix: 'data/'
} as const

export interface ManifestFileEntry {
  sha: string
  size: number
}

export interface DataManifest {
  version: string
  generatedAt: string
  /** Updated on every update check, even when nothing changed. */
  lastCheckedAt?: string
  files: Record<string, ManifestFileEntry>
}

export interface SyncProgress {
  phase: 'checking' | 'downloading' | 'indexing' | 'complete' | 'error'
  current: number
  total: number
  file?: string
  message?: string
}

export interface SyncResult {
  success: boolean
  previousVersion: string | null
  currentVersion: string
  downloaded: number
  skipped: number
  removed: number
  unchanged: number
  /** Paths relative to 5etools-data/ (no data/ prefix). */
  addedFiles: string[]
  updatedFiles: string[]
  removedFiles: string[]
  /** New root JSON in upstream not yet wired into the app catalog. */
  catalogGaps: string[]
  message: string
  errors: string[]
}

export interface SyncStatus {
  version: string | null
  lastChecked: string | null
  fileCount: number
  totalBytes: number
  isSyncing: boolean
}

export type CompendiumEntityType =
  | 'spell'
  | 'monster'
  | 'item'
  | 'race'
  | 'class'
  | 'feat'
  | 'background'
  | 'skill'
  | 'optionalfeature'
  | 'condition'
  | 'disease'
  | 'deity'
  | 'language'
  | 'rule'
  | 'vehicle'
  | 'trap'
  | 'hazard'
  | 'action'
  | 'object'

export interface CompendiumEntry {
  id: string
  name: string
  source: string
  page?: number
  type: CompendiumEntityType
  edition?: string
  cr?: string
  level?: number
  school?: string
  abilityStat?: string
  rarity?: string
  itemType?: string
  featureType?: string
  featCategories?: string[]
  srd?: boolean
  basicRules?: boolean
  srd52?: boolean
  basicRules2024?: boolean
  legacy?: boolean
  reprinted?: boolean
  ritual?: boolean
  lineage?: boolean
  npcRace?: boolean
  raceName?: string
  raceSource?: string
  isSubrace?: boolean
  sourceName?: string
  castTime?: string
  range?: string
  concentration?: boolean
  levelLabel?: string
  monsterType?: string
  size?: string
  /** Classes that can learn or cast this spell (from 5e.tools spell source lookup). */
  spellClasses?: string[]
}

export interface CompendiumQuery {
  type: CompendiumEntityType
  query?: string
  sources?: string[]
  edition?: 'one' | 'classic' | 'all'
  misc?: string
  spellLevel?: number | 'all'
  spellSchool?: string
  spellClass?: string
  rarity?: string
  concentration?: 'yes' | 'no'
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface CompendiumSearchResult {
  entries: CompendiumEntry[]
  total: number
  offset: number
  limit: number
}

export interface CompendiumSourceOption {
  code: string
  name: string
  group: string
}

export interface CompendiumSourceGroup {
  id: string
  label: string
}

export interface CompendiumFilterOptions {
  sources: string[]
  sourceOptions: CompendiumSourceOption[]
  sourceGroups: CompendiumSourceGroup[]
  spellSchools: string[]
  spellClasses: string[]
  rarities: string[]
  miscTags: string[]
}

/** @deprecated use CompendiumQuery */
export interface CompendiumSearchResultLegacy {
  entries: CompendiumEntry[]
  total: number
}
