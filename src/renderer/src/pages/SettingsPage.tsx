import { useEffect, useState } from 'react'
import { DataSettingsPanel, ThemeToggle } from '../components/SyncStatusBar'
import { BugReportPanel } from '../components/BugReportPanel'
import { AppUpdatePanel } from '../components/AppUpdatePanel'

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AppInfoSection() {
  const [version, setVersion] = useState<string>('…')

  useEffect(() => {
    void window.handbook.app.getVersion().then(setVersion)
  }, [])

  return (
    <section className="settings-section">
      <h3>About</h3>
      <div className="settings-row">
        <span className="settings-label">App version</span>
        <span className="settings-value">v{version}</span>
      </div>
      <p className="hint-text settings-note">
        Your characters and preferences are stored on this device only. Updating the app or
        syncing compendium data does not overwrite them.
      </p>
    </section>
  )
}

function DataStorageSection() {
  const [status, setStatus] = useState<{
    version: string | null
    fileCount: number
    totalBytes: number
  } | null>(null)

  useEffect(() => {
    void window.handbook.sync.status().then((s) =>
      setStatus({
        version: s.version,
        fileCount: s.fileCount,
        totalBytes: s.totalBytes
      })
    )
  }, [])

  return (
    <section className="settings-section">
      <h3>Your Data</h3>
      <div className="settings-row">
        <span className="settings-label">Characters</span>
        <span className="settings-value">Saved locally in your browser or app profile</span>
      </div>
      <div className="settings-row">
        <span className="settings-label">Compendium cache</span>
        <span className="settings-value">
          {status?.version ? `v${status.version} · ${status.fileCount} files` : 'Not downloaded'}
          {status?.totalBytes ? ` · ${formatBytes(status.totalBytes)}` : ''}
        </span>
      </div>
      <p className="hint-text settings-note">
        Compendium updates download only changed files (by content hash), not the full dataset
        each time.
      </p>
    </section>
  )
}

export function SettingsPage() {
  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <h1>Settings</h1>
        <p className="hint-text">
          Manage compendium data, appearance, and feedback. Character data stays on your device.
        </p>
      </header>

      <div className="settings-page-grid">
        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="settings-appearance">
            <span className="settings-label">Theme</span>
            <ThemeToggle />
          </div>
        </section>

        <DataStorageSection />
        <AppInfoSection />

        <AppUpdatePanel />

        <div className="settings-panel-wrap">
          <DataSettingsPanel />
        </div>

        <div className="settings-panel-wrap">
          <BugReportPanel />
        </div>
      </div>
    </div>
  )
}
