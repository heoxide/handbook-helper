import type { DataFs } from '../../shared/data-fs'
import {
  GENERATED_SOURCE_MAP,
  inferSourceGroup,
  mapAdventureGroup,
  mapBookGroup,
  resolveSourceFullName,
  SOURCE_GROUP_LABELS,
  SOURCE_GROUP_ORDER,
  type SourceGroupId
} from '../../shared/source-map'
import { SOURCE_FALLBACKS } from '../../shared/source-fallbacks'

export interface SourceOption {
  code: string
  name: string
  group: SourceGroupId
}

export interface SourceGroupOption {
  id: SourceGroupId
  label: string
}

export class SourceRegistry {
  private fs: DataFs
  private map: Map<string, string> | null = null
  private groupMap: Map<string, SourceGroupId> | null = null
  private catalogCodes: Set<string> | null = null
  private loadPromise: Promise<void> | null = null

  constructor(fs: DataFs) {
    this.fs = fs
  }

  clearCache(): void {
    this.map = null
    this.groupMap = null
    this.catalogCodes = null
    this.loadPromise = null
  }

  async ensureLoaded(): Promise<void> {
    if (this.map && this.groupMap && this.catalogCodes) return
    if (!this.loadPromise) {
      this.loadPromise = this.load()
    }
    await this.loadPromise
  }

  private assignGroup(code: string, group: SourceGroupId): void {
    if (!code) return
    this.groupMap!.set(code, group)
    this.catalogCodes!.add(code)
  }

  private async load(): Promise<void> {
    const map = new Map<string, string>([
      ...Object.entries(SOURCE_FALLBACKS),
      ...Object.entries(GENERATED_SOURCE_MAP.full)
    ])
    const groupMap = new Map<string, SourceGroupId>()
    const catalogCodes = new Set<string>()

    this.map = map
    this.groupMap = groupMap
    this.catalogCodes = catalogCodes

    for (const code of Object.keys(GENERATED_SOURCE_MAP.full)) {
      catalogCodes.add(code)
    }

    const booksRaw = await this.fs.readText('books.json')
    if (booksRaw) {
      try {
        const books = JSON.parse(booksRaw) as {
          book?: Array<{ id: string; source?: string; name: string; group?: string }>
        }
        for (const book of books.book ?? []) {
          const code = book.source ?? book.id
          const group = book.group ? mapBookGroup(book.group) : inferSourceGroup(code)
          if (book.id && book.name) map.set(book.id, book.name)
          if (code) {
            map.set(code, book.name)
            this.assignGroup(code, group)
          }
          if (book.id && book.id !== code) this.assignGroup(book.id, group)
        }
      } catch {
        // ignore malformed books.json
      }
    }

    const adventuresRaw = await this.fs.readText('adventures.json')
    if (adventuresRaw) {
      try {
        const adventures = JSON.parse(adventuresRaw) as {
          adventure?: Array<{
            id?: string
            source?: string
            name?: string
            group?: string
            contents?: Array<{ source?: string; name?: string }>
          }>
        }
        for (const adventure of adventures.adventure ?? []) {
          const advGroup = mapAdventureGroup(adventure.group ?? 'supplement')
          const advCode = adventure.source ?? adventure.id
          if (adventure.id && adventure.name) {
            const idName = GENERATED_SOURCE_MAP.full[adventure.id] ?? adventure.name
            map.set(adventure.id, idName)
            this.assignGroup(adventure.id, advGroup)
          }
          if (advCode && advCode === adventure.id) {
            const codeName = GENERATED_SOURCE_MAP.full[advCode] ?? adventure.name
            map.set(advCode, codeName)
            this.assignGroup(advCode, advGroup)
          } else if (advCode) {
            // Sub-adventure shares parent source code — keep parent book/parser name, only catalog the code.
            if (!map.has(advCode)) {
              map.set(advCode, GENERATED_SOURCE_MAP.full[advCode] ?? advCode)
            }
            this.assignGroup(advCode, advGroup)
          }
          for (const content of adventure.contents ?? []) {
            if (content.source) {
              const contentName =
                GENERATED_SOURCE_MAP.full[content.source] ?? content.name ?? content.source
              map.set(content.source, contentName)
              this.assignGroup(content.source, advGroup)
            }
          }
        }
      } catch {
        // ignore malformed adventures.json
      }
    }

    for (const code of map.keys()) {
      if (!groupMap.has(code)) {
        groupMap.set(code, inferSourceGroup(code))
      }
    }
  }

  getName(code: string): string {
    return resolveSourceFullName(code, this.map ?? undefined)
  }

  getGroup(code: string): SourceGroupId {
    return this.groupMap?.get(code) ?? inferSourceGroup(code)
  }

  /** Every official source from books.json, adventures.json, and the 5e.tools parser map. */
  getCatalogOptions(): SourceOption[] {
    const codes = [...(this.catalogCodes ?? new Set<string>())]
    return this.getOptions(codes)
  }

  getOptions(codes: string[]): SourceOption[] {
    return codes
      .map((code) => ({
        code,
        name: this.getName(code),
        group: this.getGroup(code)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  getGroupedOptions(codes: string[]): { sourceOptions: SourceOption[]; sourceGroups: SourceGroupOption[] } {
    const sourceOptions = this.getOptions(codes)
    const present = new Set(sourceOptions.map((o) => o.group))
    const sourceGroups: SourceGroupOption[] = []

    for (const id of SOURCE_GROUP_ORDER) {
      if (present.has(id)) {
        sourceGroups.push({ id, label: SOURCE_GROUP_LABELS[id] })
      }
    }

    for (const id of present) {
      if (!sourceGroups.some((g) => g.id === id)) {
        sourceGroups.push({ id, label: SOURCE_GROUP_LABELS[id] ?? id })
      }
    }

    return { sourceOptions, sourceGroups }
  }
}
