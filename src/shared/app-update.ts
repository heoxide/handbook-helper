export interface AppBuildManifest {
  version: string
  buildId: string
  builtAt: string
  /** Deployed asset paths (relative to site root) → content fingerprint (usually hashed filename). */
  assets: Record<string, string>
}

export interface AppUpdateCheckResult {
  updateAvailable: boolean
  platform: 'web' | 'desktop'
  currentVersion: string
  latestVersion: string
  currentBuildId: string | null
  latestBuildId: string | null
  addedAssets: string[]
  changedAssets: string[]
  removedAssets: string[]
  unchangedAssets: number
  downloadUrl: string | null
  message: string
}

export interface AppUpdateApplyResult {
  success: boolean
  message: string
  prefetched: number
}

export const APP_MANIFEST_STORAGE_KEY = 'handbook-app-manifest'

export function loadCachedAppManifest(): AppBuildManifest | null {
  try {
    const raw = localStorage.getItem(APP_MANIFEST_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppBuildManifest
  } catch {
    return null
  }
}

export function saveCachedAppManifest(manifest: AppBuildManifest): void {
  localStorage.setItem(APP_MANIFEST_STORAGE_KEY, JSON.stringify(manifest))
}

export function diffAppManifests(
  local: AppBuildManifest | null,
  remote: AppBuildManifest
): Pick<AppUpdateCheckResult, 'addedAssets' | 'changedAssets' | 'removedAssets' | 'unchangedAssets'> {
  const addedAssets: string[] = []
  const changedAssets: string[] = []
  const removedAssets: string[] = []
  let unchangedAssets = 0

  const localAssets = local?.assets ?? {}
  const remotePaths = new Set(Object.keys(remote.assets))

  for (const path of remotePaths) {
    const remoteHash = remote.assets[path]!
    const localHash = localAssets[path]
    if (!localHash) {
      addedAssets.push(path)
    } else if (localHash !== remoteHash) {
      changedAssets.push(path)
    } else {
      unchangedAssets++
    }
  }

  for (const path of Object.keys(localAssets)) {
    if (!remotePaths.has(path)) removedAssets.push(path)
  }

  addedAssets.sort()
  changedAssets.sort()
  removedAssets.sort()

  return { addedAssets, changedAssets, removedAssets, unchangedAssets }
}

export function isNewerAppVersion(current: string, latest: string): boolean {
  const parse = (value: string) =>
    value
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((part) => parseInt(part, 10) || 0)

  const a = parse(current)
  const b = parse(latest)
  const len = Math.max(a.length, b.length)

  for (let i = 0; i < len; i++) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (right > left) return true
    if (right < left) return false
  }

  return false
}

export function buildAppUpdateMessage(result: AppUpdateCheckResult): string {
  if (!result.updateAvailable) return 'You are on the latest app version.'

  const parts = result.changedAssets.length + result.addedAssets.length
  if (result.platform === 'web') {
    if (parts === 0) {
      return `Update available (v${result.latestVersion}). Reload to apply.`
    }
    return `Update available (v${result.latestVersion}). ${parts} file(s) changed — only those will be downloaded.`
  }

  return `Update available (v${result.latestVersion}). Download the new desktop build from GitHub.`
}

export async function fetchAppManifest(url: string): Promise<AppBuildManifest> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`Could not fetch app manifest (${res.status})`)
  return res.json() as Promise<AppBuildManifest>
}

export async function prefetchAppAssets(
  baseUrl: string,
  paths: string[],
  onProgress?: (current: number, total: number, path: string) => void
): Promise<number> {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  let prefetched = 0

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!
    onProgress?.(i + 1, paths.length, path)
    try {
      await fetch(`${root}${path.replace(/^\//, '')}`, { cache: 'reload' })
      prefetched++
    } catch {
      /* continue — reload may still fetch missing files */
    }
  }

  return prefetched
}
