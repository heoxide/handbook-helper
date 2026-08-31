import type { HandbookAPI } from '../../../preload/index'
import type { SavedCharacter, SavedCharacterSummary } from '../../../shared/character'
import { formatClassSummary, migrateCharacter } from '../../../shared/character'
import { buildGmailComposeUrl, buildMailtoUrl } from '../../../shared/contact'
import { DataIndex } from '../../../main/data/DataIndex'
import { ClassDataLoader } from '../../../main/data/ClassDataLoader'
import type { SyncProgress } from '../../../shared/types'
import { BrowserSyncEngine } from './web/browser-sync'
import { IndexedDbDataFs, readMeta, writeMeta, deleteMeta } from './web/indexed-db-fs'
import { applyWebAppUpdate, checkWebAppUpdate } from './web/app-update'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'
const CHARACTER_INDEX_KEY = 'character-index'

function isElectronHandbook(): boolean {
  return typeof window.handbook?.sync?.status === 'function'
}

async function loadCharacterIndex(): Promise<string[]> {
  return (await readMeta<string[]>(CHARACTER_INDEX_KEY)) ?? []
}

async function saveCharacterIndex(ids: string[]): Promise<void> {
  await writeMeta(CHARACTER_INDEX_KEY, ids)
}

export async function initWebHandbook(): Promise<void> {
  if (isElectronHandbook()) return

  const dataFs = new IndexedDbDataFs()
  let dataIndex = new DataIndex(dataFs)
  let classDataLoader = new ClassDataLoader(dataFs)
  const progressListeners = new Set<(progress: SyncProgress) => void>()

  const syncEngine = new BrowserSyncEngine(dataFs, (progress) => {
    for (const listener of progressListeners) listener(progress)
  })

  const clearDataCaches = () => {
    dataIndex.clearCache()
    classDataLoader.clearCache()
  }

  const api: HandbookAPI = {
    sync: {
      status: async () => {
        const status = await syncEngine.getLocalStatus()
        return { ...status, isSyncing: syncEngine.isSyncing() }
      },
      checkVersion: () => syncEngine.fetchLatestVersion().catch(() => null),
      run: async (force = false) => {
        const result = await syncEngine.sync(force)
        clearDataCaches()
        return result
      },
      onProgress: (callback) => {
        progressListeners.add(callback)
        return () => progressListeners.delete(callback)
      }
    },
    data: {
      hasData: () => dataIndex.hasData(),
      compendiumQuery: (query) => dataIndex.query(query),
      compendiumFilters: (type) => dataIndex.getFilterOptions(type),
      search: (query, type, limit) => dataIndex.search(query, type as never, limit),
      getSpells: () => dataIndex.loadSpells(),
      getMonsters: () => dataIndex.loadMonsters(),
      getRaces: () => dataIndex.loadRaces(),
      getBackgrounds: () => dataIndex.loadBackgrounds(),
      getFeats: () => dataIndex.loadFeats(),
      getSkills: () => dataIndex.loadSkills(),
      getClasses: () => dataIndex.loadClasses(),
      getDetail: (type, name, source) => dataIndex.getEntityDetail(type as never, name, source),
      getClassBundle: (className, source) => classDataLoader.loadClassBundle(className, source),
      getClassSpells: (className, sources, edition, subclass) =>
        classDataLoader.getSpellsForClass(className, sources, edition, subclass),
      getOptionalFeatures: (types) => classDataLoader.getOptionalFeatures(types)
    },
    characters: {
      list: async (): Promise<SavedCharacterSummary[]> => {
        const ids = await loadCharacterIndex()
        const summaries: SavedCharacterSummary[] = []
        for (const id of ids) {
          const character = await readMeta<SavedCharacter>(`character:${id}`)
          if (!character) continue
          const migrated = migrateCharacter(character as unknown as Record<string, unknown>)
          summaries.push({
            id: migrated.id,
            name: migrated.name,
            className: formatClassSummary(migrated),
            speciesName: migrated.species.name,
            backgroundName: migrated.background.name,
            level: migrated.level,
            alignment: migrated.alignment,
            updatedAt: migrated.updatedAt
          })
        }
        return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      },
      load: async (id) => {
        const raw = await readMeta<SavedCharacter>(`character:${id}`)
        if (!raw) return null
        return migrateCharacter(raw as unknown as Record<string, unknown>)
      },
      save: async (character) => {
        await writeMeta(`character:${character.id}`, character)
        const ids = await loadCharacterIndex()
        if (!ids.includes(character.id)) {
          await saveCharacterIndex([character.id, ...ids])
        }
        return character
      },
      delete: async (id) => {
        const ids = await loadCharacterIndex()
        if (!ids.includes(id)) return false
        await deleteMeta(`character:${id}`)
        await saveCharacterIndex(ids.filter((entry) => entry !== id))
        return true
      }
    },
    app: {
      getVersion: async () => APP_VERSION,
      checkAppUpdate: () => checkWebAppUpdate(APP_VERSION),
      applyAppUpdate: async (onProgress) => {
        const check = await checkWebAppUpdate(APP_VERSION)
        return applyWebAppUpdate(check, onProgress)
      },
      openExternal: async (url) => {
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
          return true
        } catch {
          return false
        }
      },
      composeEmail: async (options) => {
        const url =
          options.via === 'gmail' ? buildGmailComposeUrl(options) : buildMailtoUrl(options)
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
          return true
        } catch {
          return false
        }
      }
    }
  }

  window.handbook = api

  if (!(await dataIndex.hasData())) {
    window.setTimeout(async () => {
      await syncEngine.sync(false)
      clearDataCaches()
    }, 1500)
  }
}
