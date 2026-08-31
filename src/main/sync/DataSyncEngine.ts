import { mkdir, readFile, writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import {
  detectCatalogGaps,
  formatSyncPath,
  isAppRelevantPath
} from '../../shared/data-catalog'
import { buildSyncMessage, planSyncDownload } from '../../shared/sync-core'
import { FIVETOOLS, type DataManifest, type SyncProgress, type SyncResult } from '../../shared/types'

const GITHUB_API = 'https://api.github.com'

export class DataSyncEngine {
  private dataDir: string
  private manifestPath: string
  private onProgress?: (progress: SyncProgress) => void

  constructor(userDataPath: string, onProgress?: (progress: SyncProgress) => void) {
    this.dataDir = join(userDataPath, '5etools-data')
    this.manifestPath = join(userDataPath, 'manifest.json')
    this.onProgress = onProgress
  }

  getDataDir(): string {
    return this.dataDir
  }

  private emit(progress: SyncProgress): void {
    this.onProgress?.(progress)
  }

  async loadLocalManifest(): Promise<DataManifest | null> {
    if (!existsSync(this.manifestPath)) return null
    const raw = await readFile(this.manifestPath, 'utf-8')
    return JSON.parse(raw) as DataManifest
  }

  async getLocalStatus(): Promise<{
    version: string | null
    fileCount: number
    totalBytes: number
    lastChecked: string | null
  }> {
    const manifest = await this.loadLocalManifest()
    if (!manifest) {
      return { version: null, fileCount: 0, totalBytes: 0, lastChecked: null }
    }
    const totalBytes = Object.values(manifest.files).reduce((sum, f) => sum + f.size, 0)
    return {
      version: manifest.version,
      fileCount: Object.keys(manifest.files).length,
      totalBytes,
      lastChecked: manifest.lastCheckedAt ?? manifest.generatedAt
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Handbook-Helper/1.0' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.json() as Promise<T>
  }

  async fetchLatestVersion(): Promise<string> {
    const release = await this.fetchJson<{ tag_name: string }>(
      `${GITHUB_API}/repos/${FIVETOOLS.repo}/releases/latest`
    )
    return release.tag_name.replace(/^v/, '')
  }

  private async fetchRemoteManifest(version: string): Promise<DataManifest> {
    const tag = version.startsWith('v') ? version : `v${version}`

    const ref = await this.fetchJson<{ object: { sha: string } }>(
      `${GITHUB_API}/repos/${FIVETOOLS.repo}/git/ref/tags/${tag}`
    )
    let commitSha = ref.object.sha

    try {
      const tagObj = await this.fetchJson<{ object: { sha: string; type: string } }>(
        `${GITHUB_API}/repos/${FIVETOOLS.repo}/git/tags/${ref.object.sha}`
      )
      if (tagObj.object?.type === 'commit') {
        commitSha = tagObj.object.sha
      }
    } catch {
      /* lightweight tag */
    }

    const commit = await this.fetchJson<{ tree: { sha: string } }>(
      `${GITHUB_API}/repos/${FIVETOOLS.repo}/git/commits/${commitSha}`
    )

    const tree = await this.fetchJson<{
      tree: Array<{ path: string; sha: string; size?: number; type: string }>
    }>(`${GITHUB_API}/repos/${FIVETOOLS.repo}/git/trees/${commit.tree.sha}?recursive=1`)

    const files: DataManifest['files'] = {}
    for (const item of tree.tree) {
      if (item.type !== 'blob') continue
      if (!item.path.startsWith(FIVETOOLS.dataPrefix)) continue
      files[item.path] = { sha: item.sha, size: item.size ?? 0 }
    }

    return {
      version,
      generatedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      files
    }
  }

  private async downloadFile(relativePath: string, version: string): Promise<Buffer> {
    const tag = version.startsWith('v') ? version : `v${version}`
    const url = `${FIVETOOLS.rawBase}/${tag}/${relativePath}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Handbook-Helper/1.0' } })
    if (!res.ok) {
      const liveUrl = `${FIVETOOLS.liveBase}/${relativePath}`
      const liveRes = await fetch(liveUrl, { headers: { 'User-Agent': 'Handbook-Helper/1.0' } })
      if (!liveRes.ok) throw new Error(`Failed to download ${relativePath}`)
      return Buffer.from(await liveRes.arrayBuffer())
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async getChangedFilesSince(localVersion: string, remoteVersion: string): Promise<Set<string>> {
    const compare = await this.fetchJson<{
      files?: Array<{ filename: string; status: string }>
    }>(
      `${GITHUB_API}/repos/${FIVETOOLS.repo}/compare/v${localVersion}...v${remoteVersion}`
    )
    const paths = new Set<string>()
    for (const file of compare.files ?? []) {
      if (!file.filename.startsWith(FIVETOOLS.dataPrefix)) continue
      if (file.status === 'removed') continue
      paths.add(file.filename)
    }
    return paths
  }

  async sync(force = false): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      previousVersion: null,
      currentVersion: '',
      downloaded: 0,
      skipped: 0,
      removed: 0,
      unchanged: 0,
      addedFiles: [],
      updatedFiles: [],
      removedFiles: [],
      catalogGaps: [],
      message: '',
      errors: []
    }

    try {
      this.emit({ phase: 'checking', current: 0, total: 0, message: 'Checking for updates…' })

      const localManifest = await this.loadLocalManifest()
      result.previousVersion = localManifest?.version ?? null

      const remoteVersion = await this.fetchLatestVersion()
      result.currentVersion = remoteVersion

      this.emit({
        phase: 'checking',
        current: 0,
        total: 0,
        message: `Comparing with v${remoteVersion}…`
      })

      const remoteManifest = await this.fetchRemoteManifest(remoteVersion)

      const versionChanged =
        !!localManifest?.version && localManifest.version !== remoteVersion

      let comparePaths: Set<string> | null = null
      if (!force && versionChanged && localManifest?.version) {
        try {
          comparePaths = await this.getChangedFilesSince(localManifest.version, remoteVersion)
        } catch {
          comparePaths = null
        }
      }

      const plan = await planSyncDownload(localManifest, remoteManifest, {
        force,
        comparePaths,
        fileExists: (rel) => existsSync(join(this.dataDir, rel))
      })

      result.addedFiles = plan.addedFiles
      result.updatedFiles = plan.updatedFiles
      result.unchanged = plan.unchanged
      result.skipped = plan.skipped
      result.removedFiles = plan.removedFiles

      if (localManifest) {
        for (const rel of plan.removedFiles) {
          const localPath = join(this.dataDir, rel)
          if (existsSync(localPath)) {
            await unlink(localPath)
            result.removed++
          }
        }
      }

      result.catalogGaps = detectCatalogGaps(Object.keys(remoteManifest.files))

      const total = plan.toDownload.length
      if (total > 0) {
        this.emit({
          phase: 'downloading',
          current: 0,
          total,
          message: `Downloading ${total} changed file(s)…`
        })
        await mkdir(this.dataDir, { recursive: true })

        for (let i = 0; i < plan.toDownload.length; i++) {
          const path = plan.toDownload[i]!
          this.emit({ phase: 'downloading', current: i + 1, total, file: formatSyncPath(path) })

          try {
            const buf = await this.downloadFile(path, remoteVersion)
            const destPath = join(this.dataDir, formatSyncPath(path))
            await mkdir(dirname(destPath), { recursive: true })
            await writeFile(destPath, buf)
            result.downloaded++
          } catch (err) {
            result.errors.push(`${formatSyncPath(path)}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }

      const now = new Date().toISOString()
      const savedManifest: DataManifest = {
        ...remoteManifest,
        generatedAt:
          result.downloaded > 0 || result.removed > 0 || !localManifest
            ? now
            : (localManifest?.generatedAt ?? now),
        lastCheckedAt: now
      }
      await writeFile(this.manifestPath, JSON.stringify(savedManifest, null, 2))

      result.message = buildSyncMessage(result)
      result.success = result.errors.length === 0

      this.emit({
        phase: 'complete',
        current: total,
        total,
        message: result.message
      })

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(message)
      result.message = message
      this.emit({ phase: 'error', current: 0, total: 0, message })
      return result
    }
  }

  /** Paths in the last manifest that the app reads for compendium features. */
  appRelevantChanges(result: SyncResult): {
    added: string[]
    updated: string[]
    removed: string[]
  } {
    const filter = (paths: string[]) =>
      paths.filter((p) => isAppRelevantPath(`data/${p}`)).sort()
    return {
      added: filter(result.addedFiles),
      updated: filter(result.updatedFiles),
      removed: filter(result.removedFiles)
    }
  }
}
