import { useEffect, useState } from 'react'
import { Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { AppUpdateCheckResult } from '../../../shared/app-update'

function AssetChangeList({
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
          <ul>
            {paths.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function AppUpdatePanel() {
  const [version, setVersion] = useState<string>('…')
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<AppUpdateCheckResult | null>(null)

  useEffect(() => {
    void window.handbook.app.getVersion().then(setVersion)
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    setProgress(null)
    try {
      const check = await window.handbook.app.checkAppUpdate()
      setResult(check)
    } finally {
      setChecking(false)
    }
  }

  const handleApply = async () => {
    if (!result?.updateAvailable) return
    setApplying(true)
    setProgress(null)
    try {
      const applyResult = await window.handbook.app.applyAppUpdate((current, total, path) => {
        setProgress(`Downloading ${current}/${total}: ${path}`)
      })
      if (applyResult.message) setProgress(applyResult.message)
    } finally {
      setApplying(false)
    }
  }

  const handleOpenDownload = async () => {
    if (!result?.downloadUrl) return
    await window.handbook.app.openExternal(result.downloadUrl)
  }

  const changedCount = (result?.addedAssets.length ?? 0) + (result?.changedAssets.length ?? 0)
  const isWeb = result?.platform === 'web'

  return (
    <div className="settings-panel">
      <h3>Application Update</h3>
      <div className="settings-row">
        <span className="settings-label">Installed version</span>
        <span className="settings-value">v{version}</span>
      </div>
      {result && (
        <div className="settings-row">
          <span className="settings-label">Latest version</span>
          <span className="settings-value">v{result.latestVersion}</span>
        </div>
      )}
      <p className="hint-text settings-note">
        {isWeb || !result
          ? 'Checks GitHub Pages for a newer build. Only changed app files are downloaded — your characters and compendium cache are not affected.'
          : 'Checks GitHub Releases for a newer desktop build. Download and install the release to update.'}
      </p>
      <div className="settings-actions-row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleCheck()}
          disabled={checking || applying}
        >
          <RefreshCw size={16} className={checking ? 'spin' : undefined} />
          Check for app update
        </button>
        {result?.updateAvailable && isWeb && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void handleApply()}
            disabled={checking || applying}
          >
            <Download size={16} />
            {applying ? 'Updating…' : 'Download & reload'}
          </button>
        )}
        {result?.updateAvailable && !isWeb && result.downloadUrl && (
          <button type="button" className="btn-secondary" onClick={() => void handleOpenDownload()}>
            <Download size={16} />
            Open download page
          </button>
        )}
      </div>
      {progress && <p className="hint-text settings-note">{progress}</p>}
      {result && (
        <div className={`sync-report ${result.updateAvailable ? 'success' : ''}`} style={{ marginTop: 16 }}>
          <p className="sync-report-summary">{result.message}</p>
          {result.updateAvailable && changedCount > 0 && (
            <>
              <div className="sync-report-stats">
                {result.unchangedAssets > 0 && (
                  <span className="sync-stat-chip unchanged">{result.unchangedAssets} unchanged</span>
                )}
                {result.addedAssets.length > 0 && (
                  <span className="sync-stat-chip downloaded">{result.addedAssets.length} new</span>
                )}
                {result.changedAssets.length > 0 && (
                  <span className="sync-stat-chip downloaded">{result.changedAssets.length} changed</span>
                )}
              </div>
              <AssetChangeList title="New files" paths={result.addedAssets} />
              <AssetChangeList title="Changed files" paths={result.changedAssets} />
              <AssetChangeList title="Removed files" paths={result.removedAssets} defaultOpen={false} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
