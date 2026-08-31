import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { DataSyncEngine } from './sync/DataSyncEngine'
import { DataIndex } from './data/DataIndex'
import { CharacterStore } from './character/CharacterStore'
import { ClassDataLoader } from './data/ClassDataLoader'
import { NodeDataFs } from './data/NodeDataFs'
import type { SavedCharacter } from '../shared/character'
import type { ClassSpellSubclassRef } from '../shared/class-mechanics'
import type { CreatorEdition } from '../shared/origin-feat'
import { buildGmailComposeUrl, buildMailtoUrl, type ComposeEmailOptions } from '../shared/contact'
import { AppUpdateService } from './app/AppUpdateService'
import type { CompendiumQuery, SyncProgress, SyncStatus } from '../shared/types'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let syncEngine: DataSyncEngine
let dataIndex: DataIndex
let characterStore: CharacterStore
let classDataLoader: ClassDataLoader
let isSyncing = false
const appUpdateService = new AppUpdateService()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Handbook Helper',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendSyncProgress(progress: SyncProgress): void {
  mainWindow?.webContents.send('sync:progress', progress)
}

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.handbookhelper.app')
  }

  const userData = app.getPath('userData')
  syncEngine = new DataSyncEngine(userData, sendSyncProgress)
  const dataFs = new NodeDataFs(syncEngine.getDataDir())
  dataIndex = new DataIndex(dataFs)
  classDataLoader = new ClassDataLoader(dataFs)
  characterStore = new CharacterStore(userData)

  ipcMain.handle('sync:status', async (): Promise<SyncStatus> => {
    const status = await syncEngine.getLocalStatus()
    return { ...status, isSyncing }
  })

  ipcMain.handle('sync:check-version', async (): Promise<string | null> => {
    try {
      return await syncEngine.fetchLatestVersion()
    } catch {
      return null
    }
  })

  ipcMain.handle('sync:run', async (_, force = false) => {
    if (isSyncing) return { success: false, errors: ['Sync already in progress'] }
    isSyncing = true
    try {
      const result = await syncEngine.sync(force)
      dataIndex.clearCache()
      classDataLoader.clearCache()
      return result
    } finally {
      isSyncing = false
    }
  })

  ipcMain.handle('data:has-data', () => dataIndex.hasData())

  ipcMain.handle('data:search', (_, query: string, type?: string, limit?: number) =>
    dataIndex.search(query, type as Parameters<typeof dataIndex.search>[1], limit)
  )

  ipcMain.handle('data:get-spells', () => dataIndex.loadSpells())
  ipcMain.handle('data:get-monsters', () => dataIndex.loadMonsters())
  ipcMain.handle('data:get-races', () => dataIndex.loadRaces())
  ipcMain.handle('data:get-backgrounds', () => dataIndex.loadBackgrounds())
  ipcMain.handle('data:get-feats', () => dataIndex.loadFeats())
  ipcMain.handle('data:get-skills', () => dataIndex.loadSkills())
  ipcMain.handle('data:get-classes', () => dataIndex.loadClasses())

  ipcMain.handle('data:compendium-query', (_, q: CompendiumQuery) => dataIndex.query(q))

  ipcMain.handle('data:compendium-filters', (_, type: string) =>
    dataIndex.getFilterOptions(type as Parameters<typeof dataIndex.getFilterOptions>[0])
  )

  ipcMain.handle('data:get-detail', (_, type: string, name: string, source: string) =>
    dataIndex.getEntityDetail(type as Parameters<typeof dataIndex.getEntityDetail>[0], name, source)
  )

  ipcMain.handle('data:get-class-bundle', (_, className: string, source: string) =>
    classDataLoader.loadClassBundle(className, source)
  )

  ipcMain.handle(
    'data:get-class-spells',
    (
      _,
      className: string,
      sources: string[],
      edition?: CreatorEdition,
      subclass?: ClassSpellSubclassRef
    ) => classDataLoader.getSpellsForClass(className, sources, edition, subclass)
  )

  ipcMain.handle('data:get-optional-features', (_, types: string[]) =>
    classDataLoader.getOptionalFeatures(types)
  )

  ipcMain.handle('characters:list', () => characterStore.list())
  ipcMain.handle('characters:load', (_, id: string) => characterStore.load(id))
  ipcMain.handle('characters:save', (_, character: SavedCharacter) => characterStore.save(character))
  ipcMain.handle('characters:delete', (_, id: string) => characterStore.delete(id))

  ipcMain.handle('app:get-version', () => app.getVersion())

  ipcMain.handle('app:check-update', () => appUpdateService.checkForUpdate())

  ipcMain.handle('app:apply-update', async () => {
    const check = await appUpdateService.checkForUpdate()
    if (!check.updateAvailable) {
      return { success: true, message: 'Already up to date.', prefetched: 0 }
    }
    if (check.downloadUrl) {
      await shell.openExternal(check.downloadUrl)
      return {
        success: true,
        message: 'Opened the latest release download page in your browser.',
        prefetched: 0
      }
    }
    return { success: false, message: 'No download URL available.', prefetched: 0 }
  })

  ipcMain.handle('app:open-external', async (_, url: string): Promise<boolean> => {
    if (!isAllowedExternalUrl(url)) return false
    try {
      await shell.openExternal(url)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    'app:compose-email',
    async (
      _,
      options: ComposeEmailOptions & { via: 'gmail' | 'mailto' }
    ): Promise<boolean> => {
      const url =
        options.via === 'gmail'
          ? buildGmailComposeUrl(options)
          : buildMailtoUrl(options)
      if (!isAllowedExternalUrl(url)) return false
      try {
        await shell.openExternal(url)
        return true
      } catch {
        return false
      }
    }
  )

  createWindow()

  // Auto-sync on first launch if no data
  const hasData = await dataIndex.hasData()
  if (!hasData) {
    setTimeout(async () => {
      isSyncing = true
      try {
        await syncEngine.sync(false)
        dataIndex.clearCache()
      } finally {
        isSyncing = false
      }
    }, 1500)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
