import { useEffect, useState } from 'react'
import { RefreshCw, Moon, Sun, Settings, ChevronDown, ChevronUp } from 'lucide-react'
import type { SyncProgress, SyncResult, SyncStatus } from '../../../shared/types'
import { isAppRelevantPath } from '../../../shared/data-catalog'
import { useTheme } from '../contexts/ThemeContext'

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileChangeList({
  title,
  paths,
  defaultOpen = true
}: {
  title: string
  paths: string[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!paths.length) return null

  const appPaths = paths.filter((p) => isAppRelevantPath(`data/${p}`))
  const otherPaths = paths.filter((p) => !isAppRelevantPath(`data/${p}`))

  return (
    <div className="sync-report-section">
      <button type="button" className="sync-report-section-head" onClick={() => setOpen((v) => !v)}>
        <span>
          {title} ({paths.length})
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="sync-report-files">
          {appPaths.length > 0 && (
            <>
              <div className="sync-report-subhead">Used by Handbook Helper</div>
              <ul>
                {appPaths.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </>
          )}
          {otherPaths.length > 0 && (
            <>
              <div className="sync-report-subhead">Other 5e.tools data</div>
              <ul>
                {otherPaths.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SyncUpdateReport({ result }: { result: SyncResult }) {
  const versionLine =
    result.previousVersion && result.previousVersion !== result.currentVersion
      ? `v${result.previousVersion} → v${result.currentVersion}`
      : `v${result.currentVersion}`

  const hasChanges =
    result.addedFiles.length > 0 ||
    result.updatedFiles.length > 0 ||
    result.removedFiles.length > 0

  return (
    <div className={`sync-report ${result.success ? 'success' : 'error'}`}>
      <h4>Update Report</h4>
      <p className="sync-report-summary">{result.message}</p>
      <div className="sync-report-stats">
        <span className="sync-stat-chip">Version {versionLine}</span>
        {result.downloaded > 0 && (
          <span className="sync-stat-chip downloaded">{result.downloaded} downloaded</span>
        )}
        {result.unchanged > 0 && (
          <span className="sync-stat-chip unchanged">{result.unchanged} unchanged</span>
        )}
        {result.removed > 0 && (
          <span className="sync-stat-chip removed">{result.removed} removed</span>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="sync-report-errors">
          {result.errors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      )}

      {hasChanges ? (
        <>
          <FileChangeList title="New files" paths={result.addedFiles} />
          <FileChangeList title="Updated files" paths={result.updatedFiles} />
          <FileChangeList title="Removed files" paths={result.removedFiles} defaultOpen={false} />
        </>
      ) : (
        !result.errors.length && <p className="hint-text">No file changes since last sync.</p>
      )}

      {result.catalogGaps.length > 0 && (
        <div className="sync-report-gaps hint-text">
          <strong>New upstream root JSON</strong> (not yet wired into the app):{' '}
          {result.catalogGaps.join(', ')}
        </div>
      )}
    </div>
  )
}

export function DataSettingsPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)

  const refresh = async () => {
    const s = await window.handbook.sync.status()
    setStatus(s)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setLastResult(null)
    try {
      const result = await window.handbook.sync.run(false)
      setLastResult(result)
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="settings-panel">
      <h3>5e.tools Data</h3>
      <div className="settings-row">
        <span className="settings-label">Local version</span>
        <span className="settings-value">{status?.version ? `v${status.version}` : 'Not downloaded'}</span>
      </div>
      <div className="settings-row">
        <span className="settings-label">Files</span>
        <span className="settings-value">{status?.fileCount ?? 0} files</span>
      </div>
      <div className="settings-row">
        <span className="settings-label">Storage</span>
        <span className="settings-value">{formatBytes(status?.totalBytes ?? 0)}</span>
      </div>
      <div className="settings-row">
        <span className="settings-label">Last checked</span>
        <span className="settings-value">
          {status?.lastChecked ? new Date(status.lastChecked).toLocaleString() : 'Never'}
        </span>
      </div>
      <button
        className="btn-primary"
        style={{ marginTop: 16 }}
        onClick={() => void handleSync()}
        disabled={syncing || status?.isSyncing}
      >
        <RefreshCw size={16} className={syncing ? 'spin' : undefined} />
        {status?.version ? 'Check for updates' : 'Download 5e.tools data'}
      </button>

      {lastResult && <SyncUpdateReport result={lastResult} />}
    </div>
  )
}

export function SettingsToggle({
  active,
  onClick
}: {
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title="Settings"
      aria-label="Settings"
      aria-pressed={active}
    >
      <Settings size={16} />
    </button>
  )
}

export function SyncStatusBar() {
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  useEffect(() => {
    const unsub = window.handbook.sync.onProgress((p) => {
      setProgress(p)
      if (p.phase === 'complete' || p.phase === 'error') {
        setTimeout(() => setProgress(null), 4000)
      }
    })
    return unsub
  }, [])

  if (!progress || progress.phase === 'complete') return null

  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  return (
    <div className="sync-bar">
      <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ flex: 1 }}>
        {progress.message ?? progress.file ?? 'Syncing…'}
        {progress.total > 0 && ` (${progress.current}/${progress.total})`}
      </span>
      <div className="sync-progress" style={{ width: 120 }}>
        <div className="sync-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button type="button" className="icon-btn" onClick={toggleTheme} title="Toggle theme">
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
