import type { DataFs } from '../../shared/data-fs'
import { joinDataPath } from '../../shared/data-fs'
import type {
  CompendiumEntry,
  CompendiumEntityType,
  CompendiumFilterOptions,
  CompendiumQuery,
  CompendiumSearchResult
} from '../../shared/types'
import {
  is2024Content,
  isLegacySource,
  matchesMiscFilter,
  matchesNameSearch,
  type MiscFilter
} from '../../shared/compendium'
import { sortCompendiumEntries } from '../../shared/compendium-sort'
import {
  expandRaceRecords,
  expandedRaceToEntry,
  resolveRaceDetail,
  type RaceFileData
} from '../../shared/race-data'
import { isNpcRace } from '../../shared/race-filters'
import {
  formatCastTime,
  formatMonsterType,
  formatSize,
  formatSpellLevelLabel,
  formatSpellRange,
  spellRequiresConcentration,
  titleCase
} from '../../shared/display'
import {
  extractSpellClasses,
  sortSpellClasses,
  spellMatchesClass,
  type SpellSourceLookupEntry
} from '../../shared/spell-classes'
import { SourceRegistry } from './SourceRegistry'
import { FluffLoader } from './FluffLoader'
import type { FluffImageInfo } from '../../shared/fluff-images'

type SpellClassLookup = Record<string, Record<string, SpellSourceLookupEntry>>

interface JsonDataFile {
  [key: string]: unknown
}

import {
  APP_ROOT_DATA_FILES,
  APP_DIR_LOADERS
} from '../../shared/data-catalog'

const ROOT_FILES = APP_ROOT_DATA_FILES
const DIR_LOADERS = APP_DIR_LOADERS as Partial<
  Record<CompendiumEntityType, { dir: string; prop: string }>
>
const ALL_TYPES = Object.keys({ ...ROOT_FILES, ...DIR_LOADERS }) as CompendiumEntityType[]

export class DataIndex {
  private fs: DataFs
  private cache: Map<string, CompendiumEntry[]> = new Map()
  private sourceRegistry: SourceRegistry
  private spellClassLookup: SpellClassLookup | null = null
  private spellClassLookupPromise: Promise<void> | null = null
  private backgroundFluffCache: Array<Record<string, unknown>> | null = null
  private raceFileCache: RaceFileData | null = null
  private fluffLoader: FluffLoader

  constructor(fs: DataFs) {
    this.fs = fs
    this.sourceRegistry = new SourceRegistry(this.fs)
    this.fluffLoader = new FluffLoader(this.fs)
  }

  clearCache(): void {
    this.cache.clear()
    this.sourceRegistry.clearCache()
    this.spellClassLookup = null
    this.spellClassLookupPromise = null
    this.backgroundFluffCache = null
    this.raceFileCache = null
    this.fluffLoader.clearCache()
  }

  private async readJson<T>(relativePath: string): Promise<T | null> {
    const raw = await this.fs.readText(relativePath)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private async listJsonFiles(category: string): Promise<string[]> {
    return this.fs.listFiles(category)
  }

  private mapExtra(raw: Record<string, unknown>, type: CompendiumEntityType): Partial<CompendiumEntry> {
    const extra: Partial<CompendiumEntry> = {}
    if (raw.cr !== undefined) extra.cr = String(raw.cr)
    if (raw.level !== undefined) extra.level = Number(raw.level)
    if (raw.school) extra.school = String(raw.school)
    if (raw.ability) extra.abilityStat = String(raw.ability)
    if (raw.rarity) extra.rarity = String(raw.rarity)
    if (raw.type) extra.itemType = String(raw.type)
    if (Array.isArray(raw.featureType) && raw.featureType.length) {
      extra.featureType = String(raw.featureType[0])
    }
    if (type === 'feat' && Array.isArray(raw.category) && raw.category.length) {
      extra.featCategories = raw.category.map(String)
    }
    if (raw.srd === true) extra.srd = true
    if (raw.basicRules === true) extra.basicRules = true
    if (raw.srd52 === true) extra.srd52 = true
    if (raw.basicRules2024 === true) extra.basicRules2024 = true
    if (isLegacySource(String(raw.source ?? ''))) extra.legacy = true
    if (raw.isReprinted === true || (Array.isArray(raw.reprintedAs) && raw.reprintedAs.length > 0)) {
      extra.reprinted = true
    }
    if (type === 'spell') {
      const meta = raw.meta as Record<string, unknown> | undefined
      const ritual = meta?.ritual === true
      if (ritual) extra.ritual = true
      extra.levelLabel = formatSpellLevelLabel(
        raw.level !== undefined ? Number(raw.level) : undefined,
        ritual
      )
      extra.castTime = formatCastTime(raw.time)
      extra.range = formatSpellRange(raw.range)
      extra.concentration = spellRequiresConcentration(raw.duration)
    }
    if (type === 'monster') {
      extra.monsterType = formatMonsterType(raw.type)
      extra.size = formatSize(raw.size)
    }
    if (type === 'race' && raw.lineage) extra.lineage = true
    if (type === 'race' && isNpcRace(raw as { isNPCRace?: boolean; traitTags?: string[] })) {
      extra.npcRace = true
    }
    if (type === 'race' && raw.raceName) extra.raceName = String(raw.raceName)
    if (type === 'race' && raw.raceSource) extra.raceSource = String(raw.raceSource)
    if (type === 'race' && raw.isSubrace === true) extra.isSubrace = true
    if (type === 'item' && raw.rarity) extra.rarity = titleCase(String(raw.rarity))
    return extra
  }

  private async ensureSpellClassLookup(): Promise<void> {
    if (this.spellClassLookup) return
    if (!this.spellClassLookupPromise) {
      this.spellClassLookupPromise = (async () => {
        const data = await this.readJson<SpellClassLookup>(
          joinDataPath('generated/gendata-spell-source-lookup.json')
        )
        this.spellClassLookup = data ?? {}
      })()
    }
    await this.spellClassLookupPromise
  }

  private attachSpellClasses(entry: CompendiumEntry): void {
    if (entry.type !== 'spell' || !this.spellClassLookup) return
    const lookup = this.spellClassLookup[entry.source.toLowerCase()]?.[entry.name.toLowerCase()]
    const classes = extractSpellClasses(lookup)
    if (classes.length) entry.spellClasses = classes
  }

  private async enrichSpellEntries(entries: CompendiumEntry[]): Promise<void> {
    await this.ensureSpellClassLookup()
    for (const entry of entries) {
      this.attachSpellClasses(entry)
    }
  }

  private finalizeEntries(entries: CompendiumEntry[]): CompendiumEntry[] {
    for (const entry of entries) {
      entry.sourceName = this.sourceRegistry.getName(entry.source)
    }
    return entries
  }

  private async finalizeEntriesAsync(entries: CompendiumEntry[]): Promise<CompendiumEntry[]> {
    await this.sourceRegistry.ensureLoaded()
    return this.finalizeEntries(entries)
  }

  private toEntry(raw: Record<string, unknown>, type: CompendiumEntityType): CompendiumEntry | null {
    const name = String(raw.name ?? '').trim()
    const source = String(raw.source ?? '').trim()
    if (!name) return null
    if (type === 'race' && isNpcRace(raw as { isNPCRace?: boolean; traitTags?: string[] })) {
      return null
    }
    return {
      id: `${type}-${name}-${source}`,
      name,
      source,
      page: raw.page as number | undefined,
      type,
      edition: raw.edition as string | undefined,
      ...this.mapExtra(raw, type)
    }
  }

  private async loadRootEntries(type: CompendiumEntityType, cacheKey: string): Promise<CompendiumEntry[]> {
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!

    const entries: CompendiumEntry[] = []
    const root = ROOT_FILES[type]
    if (root) {
      const data = await this.readJson<JsonDataFile>(root.file)
      const list = data?.[root.prop] as Array<Record<string, unknown>> | undefined
      if (list) {
        for (const raw of list) {
          const entry = this.toEntry(raw, type)
          if (entry) entries.push(entry)
        }
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))
    await this.finalizeEntriesAsync(entries)
    this.cache.set(cacheKey, entries)
    return entries
  }

  private async loadFromDirectory(
    category: string,
    prop: string,
    type: CompendiumEntityType,
    cacheKey: string
  ): Promise<CompendiumEntry[]> {
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!

    const entries: CompendiumEntry[] = []
    const files = await this.listJsonFiles(category)

    const seen = new Set<string>()
    for (const file of files) {
      const data = await this.readJson<JsonDataFile>(joinDataPath(category, file))
      const list = data?.[prop] as Array<Record<string, unknown>> | undefined
      if (!list) continue
      for (const raw of list) {
        const entry = this.toEntry(raw, type)
        if (!entry || seen.has(entry.id)) continue
        seen.add(entry.id)
        entries.push(entry)
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))
    if (type === 'spell') await this.enrichSpellEntries(entries)
    await this.finalizeEntriesAsync(entries)
    this.cache.set(cacheKey, entries)
    return entries
  }

  private async loadRaceFile(): Promise<RaceFileData> {
    if (this.raceFileCache) return this.raceFileCache
    const data = await this.readJson<RaceFileData & Record<string, unknown>>(
      joinDataPath('races.json')
    )
    this.raceFileCache = {
      race: (data?.race as Record<string, unknown>[]) ?? [],
      subrace: (data?.subrace as Record<string, unknown>[]) ?? []
    }
    return this.raceFileCache
  }

  async loadRaces(): Promise<CompendiumEntry[]> {
    const cacheKey = 'races-expanded'
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!

    const file = await this.loadRaceFile()
    const entries: CompendiumEntry[] = []
    for (const record of expandRaceRecords(file)) {
      const entry = expandedRaceToEntry(record)
      if (entry) entries.push(entry)
    }

    await this.finalizeEntriesAsync(entries)
    this.cache.set(cacheKey, entries)
    return entries
  }

  async loadByType(type: CompendiumEntityType): Promise<CompendiumEntry[]> {
    if (type === 'race') return this.loadRaces()
    const dirLoader = DIR_LOADERS[type]
    if (dirLoader) {
      return this.loadFromDirectory(dirLoader.dir, dirLoader.prop, type, `${type}s`)
    }
    return this.loadRootEntries(type, `${type}s`)
  }

  async loadSpells(): Promise<CompendiumEntry[]> {
    return this.loadByType('spell')
  }

  async loadMonsters(): Promise<CompendiumEntry[]> {
    return this.loadByType('monster')
  }

  async loadBackgrounds(): Promise<CompendiumEntry[]> {
    return this.loadByType('background')
  }

  async loadFeats(): Promise<CompendiumEntry[]> {
    return this.loadByType('feat')
  }

  async loadSkills(): Promise<CompendiumEntry[]> {
    return this.loadByType('skill')
  }

  async loadClasses(): Promise<CompendiumEntry[]> {
    return this.loadByType('class')
  }

  private applyFilters(entries: CompendiumEntry[], q: CompendiumQuery): CompendiumEntry[] {
    let result = entries

    if (q.query?.trim()) {
      result = result.filter((e) => matchesNameSearch(e.name, q.query!))
    }

    if (q.sources?.length) {
      const selected = new Set(q.sources)
      result = result.filter((e) => selected.has(e.source))
    }

    if (q.edition && q.edition !== 'all') {
      if (q.edition === 'one') {
        result = result.filter(is2024Content)
      } else {
        result = result.filter((e) => !is2024Content(e))
      }
    }

    if (q.misc && q.misc !== 'all') {
      const misc = q.misc as MiscFilter
      result = result.filter((e) => matchesMiscFilter(e, misc))
    }

    if (q.type === 'spell' && q.spellLevel !== undefined && q.spellLevel !== 'all') {
      result = result.filter((e) => e.level === q.spellLevel)
    }

    if (q.type === 'spell' && q.spellSchool && q.spellSchool !== 'all') {
      result = result.filter((e) => e.school?.toLowerCase() === q.spellSchool?.toLowerCase())
    }

    if (q.type === 'spell' && q.spellClass && q.spellClass !== 'all') {
      result = result.filter((e) => spellMatchesClass(e.spellClasses, q.spellClass!))
    }

    if (q.type === 'item' && q.rarity && q.rarity !== 'all') {
      result = result.filter((e) => e.rarity?.toLowerCase() === q.rarity?.toLowerCase())
    }

    if (q.type === 'spell' && q.concentration === 'yes') {
      result = result.filter((e) => e.concentration)
    } else if (q.type === 'spell' && q.concentration === 'no') {
      result = result.filter((e) => !e.concentration)
    }

    return result
  }

  async query(q: CompendiumQuery): Promise<CompendiumSearchResult> {
    const offset = q.offset ?? 0
    const limit = q.limit ?? 150
    const all = await this.loadByType(q.type)
    const filtered = this.applyFilters(all, q)
    const sorted =
      q.sortColumn && q.sortDirection
        ? sortCompendiumEntries(filtered, { column: q.sortColumn, direction: q.sortDirection })
        : filtered

    return {
      entries: sorted.slice(offset, offset + limit),
      total: sorted.length,
      offset,
      limit
    }
  }

  async getFilterOptions(type: CompendiumEntityType): Promise<CompendiumFilterOptions> {
    const entries = await this.loadByType(type)
    const sourcesInCategory = [...new Set(entries.map((e) => e.source).filter(Boolean))].sort()
    await this.sourceRegistry.ensureLoaded()
    const sourceOptions = this.sourceRegistry.getOptions(sourcesInCategory)
    const sourceGroups = this.sourceRegistry.getGroupedOptions(sourcesInCategory).sourceGroups
    const spellSchools =
      type === 'spell'
        ? [...new Set(entries.map((e) => e.school).filter(Boolean) as string[])].sort()
        : []
    const spellClasses =
      type === 'spell'
        ? sortSpellClasses([
            ...new Set(entries.flatMap((e) => e.spellClasses ?? []))
          ])
        : []
    const rarities =
      type === 'item'
        ? [...new Set(entries.map((e) => e.rarity).filter(Boolean) as string[])].sort()
        : []
    const miscTagSet = new Set<string>()
    for (const entry of entries) {
      if (entry.srd) miscTagSet.add('srd-5-1')
      if (entry.srd52) miscTagSet.add('srd-5-2')
      if (entry.basicRules) miscTagSet.add('basic-rules-2014')
      if (entry.basicRules2024) miscTagSet.add('basic-rules-2024')
      if (entry.legacy) miscTagSet.add('legacy')
      if (entry.reprinted) miscTagSet.add('reprinted')
      if (entry.ritual) miscTagSet.add('ritual')
      if (entry.lineage) miscTagSet.add('lineage')
      if (!entry.npcRace) miscTagSet.add('playable-race')
    }
    return {
      sources: sourcesInCategory,
      sourceOptions,
      sourceGroups,
      spellSchools,
      spellClasses,
      rarities,
      miscTags: [...miscTagSet].sort()
    }
  }

  /** @deprecated use query() */
  async search(query: string, type?: CompendiumEntityType, limit = 100): Promise<CompendiumSearchResult> {
    if (!type) {
      return { entries: [], total: 0, offset: 0, limit }
    }
    return this.query({ type, query, limit, offset: 0 })
  }

  private async findInRootFile(
    type: keyof typeof ROOT_FILES,
    name: string,
    source: string
  ): Promise<unknown | null> {
    const root = ROOT_FILES[type]
    if (!root) return null

    const data = await this.readJson<JsonDataFile>(root.file)
    const list = data?.[root.prop] as Array<Record<string, unknown>> | undefined
    if (!list) return null

    return (
      list.find(
        (e) =>
          String(e.name).toLowerCase() === name.toLowerCase() &&
          String(e.source).toLowerCase() === source.toLowerCase()
      ) ?? null
    )
  }

  private async loadBackgroundFluff(): Promise<Array<Record<string, unknown>>> {
    if (this.backgroundFluffCache) return this.backgroundFluffCache
    const data = await this.readJson<JsonDataFile>('fluff-backgrounds.json')
    this.backgroundFluffCache = (data?.backgroundFluff as Array<Record<string, unknown>>) ?? []
    return this.backgroundFluffCache
  }

  private async findBackgroundFluff(name: string, source: string): Promise<Record<string, unknown> | null> {
    const list = await this.loadBackgroundFluff()
    return (
      list.find(
        (entry) =>
          String(entry.name).toLowerCase() === name.toLowerCase() &&
          String(entry.source).toLowerCase() === source.toLowerCase()
      ) ?? null
    )
  }

  private mergeBackgroundFluff(
    background: Record<string, unknown>,
    fluff: Record<string, unknown>
  ): Record<string, unknown> {
    const mechanical = Array.isArray(background.entries) ? background.entries : []
    const narrative = Array.isArray(fluff.entries) ? fluff.entries : []
    if (!narrative.length) return background
    return { ...background, entries: [...narrative, ...mechanical] }
  }

  private mergeMonsterFluff(
    monster: Record<string, unknown>,
    fluff: Record<string, unknown>
  ): Record<string, unknown> {
    const narrative = Array.isArray(fluff.entries) ? fluff.entries : []
    if (!narrative.length) return monster
    const existing = Array.isArray(monster.entries) ? monster.entries : []
    return { ...monster, entries: [...narrative, ...existing] }
  }

  private async enrichMonsterDetail(
    found: Record<string, unknown>,
    name: string,
    source: string
  ): Promise<Record<string, unknown>> {
    const fluff = await this.fluffLoader.getMonsterFluffEntry(name, source)
    const merged = fluff ? this.mergeMonsterFluff(found, fluff as Record<string, unknown>) : found
    return this.attachFluffImages('monster', merged, name, source)
  }

  private async attachFluffImages(
    type: CompendiumEntityType,
    found: Record<string, unknown>,
    name: string,
    source: string
  ): Promise<Record<string, unknown>> {
    let fluffImages: FluffImageInfo[] = []
    if (type === 'race') {
      fluffImages = await this.fluffLoader.getRaceFluffImages(name, source)
    } else if (type === 'monster') {
      fluffImages = await this.fluffLoader.getMonsterFluffImages(name, source, found)
    }
    if (!fluffImages.length) return found
    return { ...found, fluffImages }
  }

  async getEntityDetail(type: CompendiumEntityType, name: string, source: string): Promise<unknown | null> {
    if (!name?.trim() || !source?.trim()) return null
    if (type in ROOT_FILES) {
      if (type === 'race') {
        const file = await this.loadRaceFile()
        const found = resolveRaceDetail(file, name, source)
        if (found) return this.attachFluffImages(type, found, name, source)
      } else {
        const found = await this.findInRootFile(type as keyof typeof ROOT_FILES, name, source)
        if (found) {
          if (type === 'background') {
            const fluff = await this.findBackgroundFluff(name, source)
            if (fluff) return this.mergeBackgroundFluff(found, fluff)
          }
          return found
        }
      }
    }

    const dirLoader = DIR_LOADERS[type]
    if (!dirLoader) return null

    const files = await this.listJsonFiles(dirLoader.dir)
    for (const file of files) {
      const data = await this.readJson<JsonDataFile>(joinDataPath(dirLoader.dir, file))
      const list = data?.[dirLoader.prop] as Array<Record<string, unknown>> | undefined
      if (!list) continue
      const found = list.find(
        (e) =>
          String(e.name).toLowerCase() === name.toLowerCase() &&
          String(e.source).toLowerCase() === source.toLowerCase()
      )
      if (found) {
        if (type === 'monster') return this.enrichMonsterDetail(found, name, source)
        return found
      }
    }
    return null
  }

  async hasData(): Promise<boolean> {
    return this.fs.exists('spells')
  }

  getEntityTypes(): CompendiumEntityType[] {
    return ALL_TYPES
  }
}
