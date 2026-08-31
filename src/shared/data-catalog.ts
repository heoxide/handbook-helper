/**
 * JSON paths under 5etools-data/ that Handbook Helper reads.
 * Directory entries (spells/, bestiary/, class/) are scanned dynamically at runtime.
 */
export const APP_ROOT_DATA_FILES: Record<string, { file: string; prop: string }> = {
  race: { file: 'races.json', prop: 'race' },
  background: { file: 'backgrounds.json', prop: 'background' },
  feat: { file: 'feats.json', prop: 'feat' },
  skill: { file: 'skills.json', prop: 'skill' },
  item: { file: 'items.json', prop: 'item' },
  optionalfeature: { file: 'optionalfeatures.json', prop: 'optionalfeature' },
  condition: { file: 'conditionsdiseases.json', prop: 'condition' },
  disease: { file: 'conditionsdiseases.json', prop: 'disease' },
  deity: { file: 'deities.json', prop: 'deity' },
  language: { file: 'languages.json', prop: 'language' },
  rule: { file: 'variantrules.json', prop: 'variantrule' },
  vehicle: { file: 'vehicles.json', prop: 'vehicle' },
  trap: { file: 'trapshazards.json', prop: 'trap' },
  hazard: { file: 'trapshazards.json', prop: 'hazard' },
  action: { file: 'actions.json', prop: 'action' },
  object: { file: 'objects.json', prop: 'object' }
}

export const APP_DIR_LOADERS: Partial<
  Record<keyof typeof APP_ROOT_DATA_FILES | 'spell' | 'monster' | 'class', { dir: string; prop: string }>
> = {
  spell: { dir: 'spells', prop: 'spell' },
  monster: { dir: 'bestiary', prop: 'monster' },
  class: { dir: 'class', prop: 'class' }
}

/** Fluff / narrative JSON loaded alongside compendium entries. */
export const APP_FLUFF_FILES = ['fluff-backgrounds.json', 'fluff-races.json'] as const

/** Source books and adventures for filters. */
export const APP_META_FILES = ['books.json', 'adventures.json'] as const

/** Generated lookup tables. */
export const APP_GENERATED_FILES = ['generated/gendata-spell-source-lookup.json'] as const

/** Index files inside scanned directories. */
export const APP_INDEX_FILES = ['class/index.json', 'bestiary/fluff-index.json'] as const

const KNOWN_ROOT_JSON = new Set<string>([
  ...Object.values(APP_ROOT_DATA_FILES).map((e) => e.file),
  ...APP_FLUFF_FILES,
  ...APP_META_FILES
])

const KNOWN_PREFIXES = [
  'spells/',
  'bestiary/',
  'class/',
  'generated/',
  'bestiary/fluff-'
] as const

/** Strip `data/` prefix from a manifest path. */
export function formatSyncPath(manifestPath: string): string {
  return manifestPath.replace(/^data\//, '')
}

export function isAppRelevantPath(manifestPath: string): boolean {
  const rel = formatSyncPath(manifestPath)
  if (KNOWN_ROOT_JSON.has(rel)) return true
  if (APP_GENERATED_FILES.some((f) => rel === f)) return true
  if (APP_INDEX_FILES.some((f) => rel === f)) return true
  if (rel.startsWith('bestiary/fluff-') && rel.endsWith('.json')) return true
  return KNOWN_PREFIXES.some((prefix) => {
    if (prefix.endsWith('fluff-')) return rel.startsWith(prefix)
    return rel.startsWith(prefix) && rel.endsWith('.json')
  })
}

/**
 * Root-level data/*.json files present remotely but not in our catalog.
 * New directory shards (e.g. spells-xphb.json) are picked up automatically.
 */
export function detectCatalogGaps(remoteManifestPaths: string[]): string[] {
  const gaps: string[] = []
  for (const path of remoteManifestPaths) {
    const rel = formatSyncPath(path)
    if (!rel.endsWith('.json') || rel.includes('/')) continue
    if (rel.startsWith('fluff-')) continue
    if (KNOWN_ROOT_JSON.has(rel)) continue
    if (rel === 'sources.json' || rel === 'foundry.json' || rel === 'life.json') continue
    gaps.push(rel)
  }
  return gaps.sort()
}

export function groupSyncPaths(paths: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    'Compendium (app)': [],
    'Other data': []
  }
  for (const path of paths) {
    const key = isAppRelevantPath(path.startsWith('data/') ? path : `data/${path}`)
      ? 'Compendium (app)'
      : 'Other data'
    groups[key].push(formatSyncPath(path.startsWith('data/') ? path : path))
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort()
  }
  return groups
}
