import {
  buildAppUpdateMessage,
  diffAppManifests,
  fetchAppManifest,
  isNewerAppVersion,
  loadCachedAppManifest,
  prefetchAppAssets,
  saveCachedAppManifest,
  type AppUpdateApplyResult,
  type AppUpdateCheckResult
} from '../../../../shared/app-update'

function manifestUrl(): string {
  const base = import.meta.env.BASE_URL ?? './'
  return `${base}version.json`
}

function siteBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? './'
  return base.endsWith('/') ? base : `${base}/`
}

export async function cacheRunningAppManifest(): Promise<void> {
  try {
    const manifest = await fetchAppManifest(manifestUrl())
    saveCachedAppManifest(manifest)
  } catch {
    /* offline or first local dev run without build */
  }
}

export async function checkWebAppUpdate(currentVersion: string): Promise<AppUpdateCheckResult> {
  const localManifest = loadCachedAppManifest()

  try {
    const remoteManifest = await fetchAppManifest(manifestUrl())
    const diff = diffAppManifests(localManifest, remoteManifest)
    const versionBump = isNewerAppVersion(currentVersion, remoteManifest.version)
    const buildChanged =
      !!localManifest?.buildId && localManifest.buildId !== remoteManifest.buildId
    const assetChanges = diff.addedAssets.length + diff.changedAssets.length > 0
    const updateAvailable = versionBump || buildChanged || assetChanges

    const result: AppUpdateCheckResult = {
      updateAvailable,
      platform: 'web',
      currentVersion,
      latestVersion: remoteManifest.version,
      currentBuildId: localManifest?.buildId ?? null,
      latestBuildId: remoteManifest.buildId,
      ...diff,
      downloadUrl: null,
      message: ''
    }
    result.message = buildAppUpdateMessage(result)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      updateAvailable: false,
      platform: 'web',
      currentVersion,
      latestVersion: currentVersion,
      currentBuildId: localManifest?.buildId ?? null,
      latestBuildId: null,
      addedAssets: [],
      changedAssets: [],
      removedAssets: [],
      unchangedAssets: 0,
      downloadUrl: null,
      message: `Could not check for updates: ${message}`
    }
  }
}

export async function applyWebAppUpdate(
  check: AppUpdateCheckResult,
  onProgress?: (current: number, total: number, path: string) => void
): Promise<AppUpdateApplyResult> {
  if (!check.updateAvailable) {
    return { success: true, message: 'Already up to date.', prefetched: 0 }
  }

  const toFetch = [...check.addedAssets, ...check.changedAssets, 'index.html']
  const unique = [...new Set(toFetch)]
  const prefetched = await prefetchAppAssets(siteBaseUrl(), unique, onProgress)

  try {
    const manifest = await fetchAppManifest(manifestUrl())
    saveCachedAppManifest(manifest)
  } catch {
    /* reload will re-cache */
  }

  window.location.reload()

  return {
    success: true,
    message: `Downloaded ${prefetched} file(s). Reloading…`,
    prefetched
  }
}
