import { formatSyncPath } from './data-catalog'
import type { DataManifest, SyncResult } from './types'

export interface SyncPlan {
  toDownload: string[]
  addedFiles: string[]
  updatedFiles: string[]
  unchanged: number
  skipped: number
  removedFiles: string[]
}

export function buildSyncMessage(result: SyncResult): string {
  if (result.errors.length) {
    return `Sync finished with ${result.errors.length} error(s)`
  }
  if (result.downloaded === 0 && result.removed === 0) {
    return result.previousVersion === result.currentVersion
      ? 'Already up to date — no files changed'
      : 'Up to date — all files already matched remote'
  }
  const parts: string[] = []
  if (result.downloaded) parts.push(`${result.downloaded} downloaded`)
  if (result.unchanged) parts.push(`${result.unchanged} unchanged (skipped)`)
  if (result.removed) parts.push(`${result.removed} removed`)
  return `Sync complete — ${parts.join(', ')}`
}

export async function planSyncDownload(
  localManifest: DataManifest | null,
  remoteManifest: DataManifest,
  options: {
    force: boolean
    comparePaths: Set<string> | null
    fileExists: (path: string) => boolean | Promise<boolean>
  }
): Promise<SyncPlan> {
  const localFiles = localManifest?.files ?? {}
  const versionChanged =
    !!localManifest?.version && localManifest.version !== remoteManifest.version

  const toDownload: string[] = []
  const addedFiles: string[] = []
  const updatedFiles: string[] = []
  let unchanged = 0
  let skipped = 0

  for (const [path, remoteEntry] of Object.entries(remoteManifest.files)) {
    const rel = formatSyncPath(path)
    const hadLocally = path in localFiles && (await Promise.resolve(options.fileExists(rel)))
    const shaMatches = hadLocally && localFiles[path]?.sha === remoteEntry.sha

    if (!hadLocally) {
      addedFiles.push(rel)
      toDownload.push(path)
      continue
    }

    if (!shaMatches) {
      updatedFiles.push(rel)
      toDownload.push(path)
      continue
    }

    if (options.force) {
      toDownload.push(path)
      continue
    }

    if (versionChanged && options.comparePaths && !options.comparePaths.has(path)) {
      unchanged++
      skipped++
      continue
    }

    unchanged++
    skipped++
  }

  const removedFiles: string[] = []
  if (localManifest) {
    for (const path of Object.keys(localFiles)) {
      if (!remoteManifest.files[path]) {
        removedFiles.push(formatSyncPath(path))
      }
    }
  }

  return {
    toDownload,
    addedFiles,
    updatedFiles,
    unchanged,
    skipped,
    removedFiles
  }
}
