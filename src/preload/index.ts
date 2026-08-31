import { contextBridge, ipcRenderer } from 'electron'
import type { ComposeEmailOptions } from '../shared/contact'
import type { AppUpdateApplyResult, AppUpdateCheckResult } from '../shared/app-update'
import type { SavedCharacter, SavedCharacterSummary } from '../shared/character'
import type { ClassBundle, ClassSpellSubclassRef } from '../shared/class-mechanics'
import type { CreatorEdition } from '../shared/origin-feat'
import type {
  CompendiumEntry,
  CompendiumEntityType,
  CompendiumFilterOptions,
  CompendiumQuery,
  CompendiumSearchResult,
  SyncProgress,
  SyncResult,
  SyncStatus
} from '../shared/types'

export interface HandbookAPI {
  sync: {
    status: () => Promise<SyncStatus>
    checkVersion: () => Promise<string | null>
    run: (force?: boolean) => Promise<SyncResult>
    onProgress: (callback: (progress: SyncProgress) => void) => () => void
  }
  data: {
    hasData: () => Promise<boolean>
    compendiumQuery: (query: CompendiumQuery) => Promise<CompendiumSearchResult>
    compendiumFilters: (type: CompendiumEntityType) => Promise<CompendiumFilterOptions>
    search: (query: string, type?: string, limit?: number) => Promise<CompendiumSearchResult>
    getSpells: () => Promise<CompendiumEntry[]>
    getMonsters: () => Promise<CompendiumEntry[]>
    getRaces: () => Promise<CompendiumEntry[]>
    getBackgrounds: () => Promise<CompendiumEntry[]>
    getFeats: () => Promise<CompendiumEntry[]>
    getSkills: () => Promise<CompendiumEntry[]>
    getClasses: () => Promise<CompendiumEntry[]>
    getDetail: (type: string, name: string, source: string) => Promise<unknown>
    getClassBundle: (className: string, source: string) => Promise<ClassBundle | null>
    getClassSpells: (
      className: string,
      sources: string[],
      edition?: CreatorEdition,
      subclass?: ClassSpellSubclassRef
    ) => Promise<{ name: string; source: string; level: number }[]>
    getOptionalFeatures: (types: string[]) => Promise<Record<string, unknown>[]>
  }
  characters: {
    list: () => Promise<SavedCharacterSummary[]>
    load: (id: string) => Promise<SavedCharacter | null>
    save: (character: SavedCharacter) => Promise<SavedCharacter>
    delete: (id: string) => Promise<boolean>
  }
  app: {
    getVersion: () => Promise<string>
    checkAppUpdate: () => Promise<AppUpdateCheckResult>
    applyAppUpdate: (
      onProgress?: (current: number, total: number, path: string) => void
    ) => Promise<AppUpdateApplyResult>
    openExternal: (url: string) => Promise<boolean>
    composeEmail: (options: ComposeEmailOptions & { via: 'gmail' | 'mailto' }) => Promise<boolean>
  }
}

const api: HandbookAPI = {
  sync: {
    status: () => ipcRenderer.invoke('sync:status'),
    checkVersion: () => ipcRenderer.invoke('sync:check-version'),
    run: (force = false) => ipcRenderer.invoke('sync:run', force),
    onProgress: (callback) => {
      const handler = (_: unknown, progress: SyncProgress) => callback(progress)
      ipcRenderer.on('sync:progress', handler)
      return () => ipcRenderer.removeListener('sync:progress', handler)
    }
  },
  data: {
    hasData: () => ipcRenderer.invoke('data:has-data'),
    compendiumQuery: (query) => ipcRenderer.invoke('data:compendium-query', query),
    compendiumFilters: (type) => ipcRenderer.invoke('data:compendium-filters', type),
    search: (query, type, limit) => ipcRenderer.invoke('data:search', query, type, limit),
    getSpells: () => ipcRenderer.invoke('data:get-spells'),
    getMonsters: () => ipcRenderer.invoke('data:get-monsters'),
    getRaces: () => ipcRenderer.invoke('data:get-races'),
    getBackgrounds: () => ipcRenderer.invoke('data:get-backgrounds'),
    getFeats: () => ipcRenderer.invoke('data:get-feats'),
    getSkills: () => ipcRenderer.invoke('data:get-skills'),
    getClasses: () => ipcRenderer.invoke('data:get-classes'),
    getDetail: (type, name, source) => ipcRenderer.invoke('data:get-detail', type, name, source),
    getClassBundle: (className, source) =>
      ipcRenderer.invoke('data:get-class-bundle', className, source),
    getClassSpells: (className, sources, edition, subclass) =>
      ipcRenderer.invoke('data:get-class-spells', className, sources, edition, subclass),
    getOptionalFeatures: (types) => ipcRenderer.invoke('data:get-optional-features', types)
  },
  characters: {
    list: () => ipcRenderer.invoke('characters:list'),
    load: (id) => ipcRenderer.invoke('characters:load', id),
    save: (character) => ipcRenderer.invoke('characters:save', character),
    delete: (id) => ipcRenderer.invoke('characters:delete', id)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    checkAppUpdate: () => ipcRenderer.invoke('app:check-update'),
    applyAppUpdate: (onProgress) => {
      const handler = (_: unknown, current: number, total: number, path: string) =>
        onProgress?.(current, total, path)
      if (onProgress) ipcRenderer.on('app:update-progress', handler)
      return ipcRenderer
        .invoke('app:apply-update')
        .finally(() => {
          if (onProgress) ipcRenderer.removeListener('app:update-progress', handler)
        })
    },
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    composeEmail: (options) => ipcRenderer.invoke('app:compose-email', options)
  }
}

contextBridge.exposeInMainWorld('handbook', api)

declare global {
  interface Window {
    handbook: HandbookAPI
  }
}
