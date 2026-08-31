import type { DataFs } from '../../shared/data-fs'
import { joinDataPath } from '../../shared/data-fs'
import {
  collectFluffImageData,
  findFluffEntry,
  monsterTokenImagePath,
  parseFluffImages,
  resolve5eToolsMediaUrl,
  type FluffEntry,
  type FluffImageInfo
} from '../../shared/fluff-images'

interface JsonDataFile {
  [key: string]: unknown
}

export class FluffLoader {
  private fs: DataFs
  private raceFluffCache: FluffEntry[] | null = null
  private monsterFluffIndex: Record<string, string> | null = null
  private monsterFluffByFile = new Map<string, FluffEntry[]>()

  constructor(fs: DataFs) {
    this.fs = fs
  }

  clearCache(): void {
    this.raceFluffCache = null
    this.monsterFluffIndex = null
    this.monsterFluffByFile.clear()
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

  private async loadRaceFluffList(): Promise<FluffEntry[]> {
    if (this.raceFluffCache) return this.raceFluffCache
    const data = await this.readJson<JsonDataFile>('fluff-races.json')
    this.raceFluffCache = (data?.raceFluff as FluffEntry[]) ?? []
    return this.raceFluffCache
  }

  private async loadMonsterFluffIndex(): Promise<Record<string, string>> {
    if (this.monsterFluffIndex) return this.monsterFluffIndex
    const data = await this.readJson<Record<string, string>>('bestiary/fluff-index.json')
    this.monsterFluffIndex = data ?? {}
    return this.monsterFluffIndex
  }

  private async loadMonsterFluffFile(filename: string): Promise<FluffEntry[]> {
    const cached = this.monsterFluffByFile.get(filename)
    if (cached) return cached
    const data = await this.readJson<JsonDataFile>(joinDataPath('bestiary', filename))
    const list = (data?.monsterFluff as FluffEntry[]) ?? []
    this.monsterFluffByFile.set(filename, list)
    return list
  }

  async getRaceFluffImages(name: string, source: string): Promise<FluffImageInfo[]> {
    const list = await this.loadRaceFluffList()
    const entry = findFluffEntry(list, name, source)
    if (!entry) return []
    return parseFluffImages(collectFluffImageData(list, entry))
  }

  async getMonsterFluffEntry(name: string, source: string): Promise<FluffEntry | null> {
    const index = await this.loadMonsterFluffIndex()
    const filename = index[source]
    if (!filename) return null
    const list = await this.loadMonsterFluffFile(filename)
    return findFluffEntry(list, name, source)
  }

  async getMonsterFluffImages(
    name: string,
    source: string,
    entity?: Record<string, unknown>
  ): Promise<FluffImageInfo[]> {
    const index = await this.loadMonsterFluffIndex()
    const filename = index[source]
    if (filename) {
      const list = await this.loadMonsterFluffFile(filename)
      const entry = findFluffEntry(list, name, source)
      if (entry) {
        const images = parseFluffImages(collectFluffImageData(list, entry))
        if (images.length) return images
      }
    }

    if (entity?.hasToken) {
      const url = resolve5eToolsMediaUrl({
        type: 'internal',
        path: monsterTokenImagePath(name, source)
      })
      if (url) return [{ url, title: `${name} token` }]
    }

    return []
  }
}
