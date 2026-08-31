import { app } from 'electron'
import {
  buildAppUpdateMessage,
  isNewerAppVersion,
  type AppUpdateCheckResult
} from '../../shared/app-update'

const GITHUB_API = 'https://api.github.com'

function handbookRepo(): string {
  return process.env.HANDBOOK_GITHUB_REPO ?? process.env.GITHUB_REPOSITORY ?? 'heoxide/handbook-helper'
}

export class AppUpdateService {
  async checkForUpdate(): Promise<AppUpdateCheckResult> {
    const currentVersion = app.getVersion()
    const repo = handbookRepo()

    try {
      const res = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Handbook-Helper/1.0'
        }
      })

      if (!res.ok) {
        throw new Error(`GitHub API returned ${res.status}`)
      }

      const release = (await res.json()) as { tag_name: string; html_url: string }
      const latestVersion = release.tag_name.replace(/^v/i, '')
      const updateAvailable =
        latestVersion !== currentVersion && isNewerAppVersion(currentVersion, latestVersion)

      const result: AppUpdateCheckResult = {
        updateAvailable,
        platform: 'desktop',
        currentVersion,
        latestVersion,
        currentBuildId: null,
        latestBuildId: latestVersion,
        addedAssets: [],
        changedAssets: [],
        removedAssets: [],
        unchangedAssets: 0,
        downloadUrl: release.html_url,
        message: ''
      }
      result.message = buildAppUpdateMessage(result)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        updateAvailable: false,
        platform: 'desktop',
        currentVersion,
        latestVersion: currentVersion,
        currentBuildId: null,
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
}
