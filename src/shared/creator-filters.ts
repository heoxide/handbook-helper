import type { CompendiumEntry } from './types'
import { is2024Content } from './compendium'
import type { CreatorEdition } from './origin-feat'
import { raceListLabel } from './race-data'
import { isPlayableSpecies } from './race-filters'

/** Prefer updated reprints (e.g. MPMM over VGM) when the same species appears in multiple books. */
const CREATOR_SPECIES_SOURCE_PRIORITY = [
  'XPHB',
  'LFL',
  'RHW',
  'EFA',
  'MPMM',
  'VRGR',
  'WBtW',
  'FTD',
  'AAG',
  'MOT',
  'GGR',
  'ERLW',
  'EGW',
  'SCC',
  'TCE',
  'MTF',
  'SCAG',
  'VGM',
  'EEPC',
  'PSI',
  'PSZ',
  'PSK',
  'PSA',
  'PSD',
  'PSX',
  'LR',
  'TTP',
  'DSotDQ',
  'AWM',
  'AI',
  'OGA',
  'PHB',
  'DMG'
] as const

function speciesSourceRank(source: string): number {
  const idx = CREATOR_SPECIES_SOURCE_PRIORITY.indexOf(
    source as (typeof CREATOR_SPECIES_SOURCE_PRIORITY)[number]
  )
  return idx === -1 ? CREATOR_SPECIES_SOURCE_PRIORITY.length : idx
}

/** Keep one entry per displayed species name, preferring the most up-to-date source book. */
export function dedupeCreatorSpecies(entries: CompendiumEntry[]): CompendiumEntry[] {
  const best = new Map<string, CompendiumEntry>()
  for (const entry of entries) {
    const key = raceListLabel(entry).toLowerCase()
    const prev = best.get(key)
    if (!prev || speciesSourceRank(entry.source) < speciesSourceRank(prev.source)) {
      best.set(key, entry)
    }
  }
  return [...best.values()].sort(
    (a, b) =>
      raceListLabel(a).localeCompare(raceListLabel(b)) || a.source.localeCompare(b.source)
  )
}

/**
 * Species edition rules for the character creator.
 * 2024 mode includes 2024 PHB/setting species plus enabled legacy supplements (VGM, MPMM, …).
 * 2014 mode includes classic PHB and the same supplements, but not 2024-only reprints.
 */
export function speciesMatchesCreatorEdition(
  entry: CompendiumEntry,
  edition: CreatorEdition
): boolean {
  const modern = is2024Content(entry)
  if (edition === '2024') {
    if (modern) return true
    // Legacy & supplemental books — exclude 2014 PHB core (use XPHB instead).
    return entry.source !== 'PHB'
  }
  return !modern
}

export function filterCreatorClasses(
  entries: CompendiumEntry[],
  codes: string[],
  edition: CreatorEdition
): CompendiumEntry[] {
  return entries.filter((e) => {
    if (!codes.includes(e.source)) return false
    return edition === '2024' ? e.edition === 'one' : !is2024Content(e)
  })
}

export function filterCreatorBackgrounds(
  entries: CompendiumEntry[],
  codes: string[],
  edition: CreatorEdition
): CompendiumEntry[] {
  return entries.filter((e) => {
    if (!codes.includes(e.source)) return false
    return edition === '2024' ? e.edition === 'one' : !is2024Content(e)
  })
}

/** Playable species must match the active rules edition (2024 vs 2014). */
export function filterCreatorSpecies(
  entries: CompendiumEntry[],
  codes: string[],
  edition: CreatorEdition
): CompendiumEntry[] {
  const filtered = entries.filter((e) => {
    if (!codes.includes(e.source)) return false
    if (!isPlayableSpecies(e)) return false
    return speciesMatchesCreatorEdition(e, edition)
  })
  return dedupeCreatorSpecies(filtered)
}

const CREATOR_FEAT_SOURCE_PRIORITY = [
  'XPHB',
  'XPHB2024',
  'EFA',
  'LFL',
  'RHW',
  'TCE',
  'PHB'
] as const

function featSourceRank(source: string): number {
  const idx = CREATOR_FEAT_SOURCE_PRIORITY.indexOf(
    source as (typeof CREATOR_FEAT_SOURCE_PRIORITY)[number]
  )
  return idx === -1 ? CREATOR_FEAT_SOURCE_PRIORITY.length : idx
}

/** Keep one feat per name, preferring newer reprints. */
export function dedupeCreatorFeats(entries: CompendiumEntry[]): CompendiumEntry[] {
  const best = new Map<string, CompendiumEntry>()
  for (const entry of entries) {
    const key = entry.name.toLowerCase()
    const prev = best.get(key)
    if (!prev || featSourceRank(entry.source) < featSourceRank(prev.source)) {
      best.set(key, entry)
    }
  }
  return [...best.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source)
  )
}

export function filterFeatsForEdition(
  entries: CompendiumEntry[],
  edition: CreatorEdition
): CompendiumEntry[] {
  return entries.filter((e) => {
    const modern = is2024Content(e)
    if (edition === '2024') {
      if (modern) return true
      return e.source !== 'PHB'
    }
    return !modern
  })
}

export function filterFeatsByCategory(
  entries: CompendiumEntry[],
  categories: string[],
  codes: string[],
  edition?: CreatorEdition
): CompendiumEntry[] {
  const catSet = new Set(categories)
  let filtered = entries.filter(
    (e) =>
      codes.includes(e.source) &&
      (e.featCategories ?? []).some((c) => catSet.has(c))
  )
  if (edition) {
    filtered = filterFeatsForEdition(filtered, edition)
    filtered = dedupeCreatorFeats(filtered)
  }
  return filtered
}

/** Feats for level-up / origin feat pickers. */
export function filterCreatorFeats(
  entries: CompendiumEntry[],
  codes: string[],
  edition: CreatorEdition
): CompendiumEntry[] {
  return dedupeCreatorFeats(
    filterFeatsForEdition(
      entries.filter((e) => codes.includes(e.source)),
      edition
    )
  )
}
