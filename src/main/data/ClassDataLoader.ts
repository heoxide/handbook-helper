import type { DataFs } from '../../shared/data-fs'
import { joinDataPath } from '../../shared/data-fs'
import type { ClassBundle, ClassSpellSubclassRef, SubclassOption } from '../../shared/class-mechanics'
import { getSubclasses } from '../../shared/class-mechanics'
import { filterSpellsForEdition } from '../../shared/compendium'
import type { CreatorEdition } from '../../shared/origin-feat'
import { defaultBooksForEdition, enabledSourceCodes } from '../../shared/sources'

interface ClassIndex {
  [slug: string]: string
}

interface OptionalFeaturesFile {
  optionalfeature?: Record<string, unknown>[]
}

interface SpellLookup {
  [source: string]: {
    [spellName: string]: {
      class?: Record<string, Record<string, boolean>>
      subclass?: Record<string, unknown>
    }
  }
}

function classOnSpellList(
  classData: Record<string, Record<string, boolean>>,
  className: string
): boolean {
  const target = className.toLowerCase()
  for (const bookClasses of Object.values(classData)) {
    for (const [cn, onList] of Object.entries(bookClasses)) {
      if (cn.toLowerCase() === target && onList) return true
    }
  }
  return false
}

function subclassOnSpellList(
  subclassData: Record<string, unknown>,
  subclass: ClassSpellSubclassRef
): boolean {
  const target = subclass.name.toLowerCase()
  for (const bookEntry of Object.values(subclassData)) {
    if (!bookEntry || typeof bookEntry !== 'object') continue
    for (const [className, bySource] of Object.entries(bookEntry as Record<string, unknown>)) {
      if (className.toLowerCase() !== subclass.className.toLowerCase()) continue
      if (!bySource || typeof bySource !== 'object') continue
      for (const [classSource, subs] of Object.entries(bySource as Record<string, unknown>)) {
        if (classSource.toUpperCase() !== subclass.classSource.toUpperCase()) continue
        if (!subs || typeof subs !== 'object') continue
        for (const [shortName, detail] of Object.entries(subs as Record<string, unknown>)) {
          if (shortName.toLowerCase() === target) return true
          if (detail && typeof detail === 'object' && 'name' in detail) {
            const fullName = String((detail as { name: string }).name)
            if (fullName.toLowerCase() === target) return true
          }
        }
      }
    }
  }
  return false
}

export class ClassDataLoader {
  private fs: DataFs
  private index: ClassIndex | null = null
  private optionalFeatures: Record<string, unknown>[] | null = null
  private spellLookup: SpellLookup | null = null

  constructor(fs: DataFs) {
    this.fs = fs
  }

  clearCache(): void {
    this.index = null
    this.optionalFeatures = null
    this.spellLookup = null
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

  private classSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private async getIndex(): Promise<ClassIndex> {
    if (this.index) return this.index
    this.index =
      (await this.readJson<ClassIndex>(joinDataPath('class', 'index.json'))) ?? {}
    return this.index
  }

  async loadClassBundle(className: string, _source: string): Promise<ClassBundle | null> {
    const index = await this.getIndex()
    const slug = this.classSlug(className)
    const file = index[slug]
    if (!file) return null

    const data = await this.readJson<Record<string, unknown>>(joinDataPath('class', file))
    if (!data) return null

    return {
      class: (data.class as Record<string, unknown>[]) ?? [],
      subclass: (data.subclass as Record<string, unknown>[]) ?? [],
      classFeature: (data.classFeature as Record<string, unknown>[]) ?? [],
      subclassFeature: (data.subclassFeature as Record<string, unknown>[]) ?? []
    }
  }

  getClassEntry(
    bundle: ClassBundle,
    className: string,
    source: string
  ): Record<string, unknown> | undefined {
    return bundle.class.find(
      (c) => String(c.name) === className && String(c.source) === source
    )
  }

  listSubclasses(bundle: ClassBundle, className: string, classSource: string): SubclassOption[] {
    return getSubclasses(bundle, className, classSource)
  }

  async getOptionalFeatures(types: string[]): Promise<Record<string, unknown>[]> {
    if (!this.optionalFeatures) {
      const data = await this.readJson<OptionalFeaturesFile>('optionalfeatures.json')
      this.optionalFeatures = data?.optionalfeature ?? []
    }
    const typeSet = new Set(types)
    return this.optionalFeatures.filter((f) => {
      const ft = f.featureType as string[] | undefined
      return ft?.some((t) => typeSet.has(t))
    })
  }

  private async getSpellLookup(): Promise<SpellLookup> {
    if (this.spellLookup) return this.spellLookup
    this.spellLookup =
      (await this.readJson<SpellLookup>(joinDataPath('generated', 'gendata-spell-source-lookup.json'))) ?? {}
    return this.spellLookup
  }

  async getSpellsForClass(
    className: string,
    sources: string[] | undefined,
    edition?: CreatorEdition,
    subclass?: ClassSpellSubclassRef
  ): Promise<{ name: string; source: string; level: number }[]> {
    const sourceList =
      sources && sources.length > 0
        ? sources
        : enabledSourceCodes(defaultBooksForEdition(edition ?? '2024'))
    const lookup = await this.getSpellLookup()
    const sourceSet = new Set(sourceList.map((s) => s.toLowerCase()))
    const seen = new Set<string>()
    const results: { name: string; source: string; level: number }[] = []

    for (const [srcKey, spells] of Object.entries(lookup)) {
      if (!sourceSet.has(srcKey.toLowerCase())) continue

      for (const [spellKey, data] of Object.entries(spells)) {
        let onList = false
        if (data.class) {
          onList = classOnSpellList(data.class, className)
        }
        if (!onList && subclass && data.subclass) {
          onList = subclassOnSpellList(data.subclass, subclass)
        }
        if (!onList) continue

        const displayName = spellKey
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        const id = `${displayName}|${srcKey.toUpperCase()}`
        if (seen.has(id)) continue
        seen.add(id)

        const spellDetail = await this.getSpellLevel(displayName, srcKey.toUpperCase())
        results.push({
          name: displayName,
          source: srcKey.toUpperCase(),
          level: spellDetail ?? 0
        })
      }
    }

    const sorted = results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    return edition ? filterSpellsForEdition(sorted, edition) : sorted
  }

  private async getSpellLevel(name: string, source: string): Promise<number | null> {
    if (!(await this.fs.exists('spells'))) return null
    const files = (await this.fs.listFiles('spells')).filter(
      (f) => f.endsWith('.json') && f.startsWith('spells-')
    )
    for (const file of files) {
      const data = await this.readJson<{ spell?: Record<string, unknown>[] }>(joinDataPath('spells', file))
      const found = data?.spell?.find(
        (s) =>
          String(s.name).toLowerCase() === name.toLowerCase() &&
          String(s.source).toLowerCase() === source.toLowerCase()
      )
      if (found) return Number(found.level ?? 0)
    }
    return null
  }
}
