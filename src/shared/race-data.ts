import type { CompendiumEntry } from './types'
import { is2024Content } from './compendium'
import { isNpcRace } from './race-filters'

export interface RaceFileData {
  race?: Record<string, unknown>[]
  subrace?: Record<string, unknown>[]
}

export interface ExpandedRaceRecord {
  name: string
  source: string
  raw: Record<string, unknown>
  raceName?: string
  raceSource?: string
  isSubrace: boolean
  npcRace: boolean
  edition?: string
  lineage?: boolean
}

function addRecord(
  seen: Set<string>,
  out: ExpandedRaceRecord[],
  opts: {
    name: string
    source: string
    raw: Record<string, unknown>
    raceName?: string
    raceSource?: string
    isSubrace?: boolean
  }
): void {
  const name = opts.name.trim()
  const source = opts.source.trim()
  if (!name || !source) return

  const key = `${name.toLowerCase()}|${source.toLowerCase()}`
  if (seen.has(key)) return
  seen.add(key)

  const npcRace = isNpcRace(opts.raw)
  out.push({
    name,
    source,
    raw: opts.raw,
    raceName: opts.raceName,
    raceSource: opts.raceSource,
    isSubrace: opts.isSubrace ?? false,
    npcRace,
    edition: opts.raw.edition as string | undefined,
    lineage: Boolean(opts.raw.lineage)
  })
}

function parentRace(raw: Record<string, unknown>): { name?: string; source?: string } {
  const copy = raw._copy as { raceName?: string; raceSource?: string } | undefined
  return {
    name: (raw.raceName as string | undefined) ?? copy?.raceName,
    source: (raw.raceSource as string | undefined) ?? copy?.raceSource
  }
}

function expandVersionEntries(
  seen: Set<string>,
  out: ExpandedRaceRecord[],
  raw: Record<string, unknown>,
  isSubrace: boolean
): void {
  const parent = parentRace(raw)
  const versions = raw._versions as Record<string, unknown>[] | undefined
  if (!versions?.length) return

  for (const version of versions) {
    if (version.name) {
      addRecord(seen, out, {
        name: String(version.name),
        source: String(version.source ?? raw.source),
        raw: { ...raw, ...version, name: version.name, source: version.source ?? raw.source },
        raceName: parent.name,
        raceSource: parent.source,
        isSubrace
      })
      continue
    }

    const abstract = version._abstract as { name?: string; source?: string } | undefined
    const implementations = version._implementations as
      | Array<{ _variables?: Record<string, string> }>
      | undefined

    if (abstract?.name && implementations?.length) {
      for (const impl of implementations) {
        const color = impl._variables?.color ?? ''
        const displayName = abstract.name.replace(/\{\{color\}\}/g, color).replace(/\s+/g, ' ').trim()
        addRecord(seen, out, {
          name: displayName,
          source: String(abstract.source ?? raw.source),
          raw: { ...raw, ...version, ...impl, name: displayName, source: abstract.source ?? raw.source },
          raceName: parent.name,
          raceSource: parent.source,
          isSubrace
        })
      }
    } else if (abstract?.name) {
      addRecord(seen, out, {
        name: abstract.name.replace(/\{\{color\}\}/g, '').trim(),
        source: String(abstract.source ?? raw.source),
        raw: { ...raw, ...version },
        raceName: parent.name,
        raceSource: parent.source,
        isSubrace
      })
    }
  }
}

function addReprints(
  seen: Set<string>,
  out: ExpandedRaceRecord[],
  raw: Record<string, unknown>,
  isSubrace: boolean
): void {
  const parent = parentRace(raw)
  const reprints = raw.reprintedAs as string[] | undefined
  if (!reprints?.length) return

  for (const ref of reprints) {
    const [name, source] = String(ref).split('|')
    if (!name) continue
    addRecord(seen, out, {
      name,
      source: source?.trim() || String(raw.source),
      raw: { ...raw, name, source: source?.trim() || raw.source },
      raceName: parent.name,
      raceSource: parent.source,
      isSubrace
    })
  }
}

/** Expand races.json into the full list 5e.tools shows (races + subraces + variants). */
export function expandRaceRecords(data: RaceFileData): ExpandedRaceRecord[] {
  const seen = new Set<string>()
  const out: ExpandedRaceRecord[] = []

  const process = (raw: Record<string, unknown>, isSubrace: boolean) => {
    const parent = parentRace(raw)
    const baseName = String(raw.name ?? parent.name ?? '').trim()
    const source = String(raw.source ?? '').trim()

    if (baseName) {
      addRecord(seen, out, {
        name: baseName,
        source,
        raw,
        raceName: isSubrace ? parent.name : undefined,
        raceSource: isSubrace ? parent.source : undefined,
        isSubrace
      })
    }

    expandVersionEntries(seen, out, raw, isSubrace)
    addReprints(seen, out, raw, isSubrace)
  }

  for (const raw of data.race ?? []) process(raw, false)
  for (const raw of data.subrace ?? []) process(raw, true)

  return out.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

export function expandedRaceToEntry(record: ExpandedRaceRecord): CompendiumEntry | null {
  if (record.npcRace) return null

  const entry: CompendiumEntry = {
    id: `race-${record.name}-${record.source}`,
    name: record.name,
    source: record.source,
    page: record.raw.page as number | undefined,
    type: 'race',
    edition: record.edition,
    lineage: record.lineage,
    npcRace: false,
    raceName: record.raceName,
    raceSource: record.raceSource,
    isSubrace: record.isSubrace
  }

  if (is2024Content(entry)) {
    entry.srd52 = record.raw.srd52 === true
    entry.basicRules2024 = record.raw.basicRules2024 === true
  }

  if (record.raw.srd === true) entry.srd = true
  if (record.raw.basicRules === true) entry.basicRules = true

  return entry
}

export function findExpandedRace(
  data: RaceFileData,
  name: string,
  source: string
): ExpandedRaceRecord | null {
  const targetName = name.toLowerCase()
  const targetSource = source.toLowerCase()
  return (
    expandRaceRecords(data).find(
      (r) => r.name.toLowerCase() === targetName && r.source.toLowerCase() === targetSource
    ) ?? null
  )
}

function findBaseRace(data: RaceFileData, name: string, source: string): Record<string, unknown> | null {
  const match = (list: Record<string, unknown>[] | undefined) =>
    list?.find(
      (e) =>
        String(e.name ?? '').toLowerCase() === name.toLowerCase() &&
        String(e.source).toLowerCase() === source.toLowerCase()
    ) ?? null

  return match(data.race) ?? match(data.subrace)
}

function findParentRace(
  data: RaceFileData,
  raceName: string,
  raceSource: string
): Record<string, unknown> | null {
  return findBaseRace(data, raceName, raceSource)
}

/** Resolve a playable species detail object for the sheet / compendium. */
export function resolveRaceDetail(
  data: RaceFileData,
  name: string,
  source: string
): Record<string, unknown> | null {
  const expanded = findExpandedRace(data, name, source)
  if (!expanded) {
    const direct = findBaseRace(data, name, source)
    return direct ? { ...direct } : null
  }

  const { raw, raceName, raceSource } = expanded
  let detail: Record<string, unknown> = { ...raw, name: expanded.name, source: expanded.source }

  if (raceName && raceSource) {
    const parent = findParentRace(data, raceName, raceSource)
    if (parent) {
      const parentAbility = Array.isArray(parent.ability) ? parent.ability : []
      const detailAbility = Array.isArray(raw.ability) ? raw.ability : []
      const mergedAbility = [...parentAbility, ...detailAbility]
      detail = {
        ...parent,
        ...detail,
        name: expanded.name,
        source: expanded.source,
        raceName,
        raceSource,
        ...(mergedAbility.length ? { ability: mergedAbility } : {})
      }
    }
  }

  if (detail._copy && !detail.entries) {
    const copy = detail._copy as {
      name?: string
      source?: string
      raceName?: string
      raceSource?: string
    }
    const template =
      (copy.raceName && copy.raceSource
        ? findParentRace(data, copy.raceName, copy.raceSource)
        : null) ??
      (copy.name && copy.source ? findBaseRace(data, copy.name, copy.source) : null)
    if (template) {
      detail = {
        ...template,
        ...detail,
        name: expanded.name,
        source: expanded.source
      }
    }
  }

  return detail
}

export function raceListLabel(entry: CompendiumEntry): string {
  if (entry.isSubrace && entry.raceName && entry.raceName !== entry.name) {
    return `${entry.name} (${entry.raceName})`
  }
  return entry.name
}
