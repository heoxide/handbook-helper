import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Home, UserPlus, Library, Users, Bug } from 'lucide-react'
import { Logo } from './components/Logo'
import { SyncStatusBar, SettingsToggle } from './components/SyncStatusBar'
import { BugReportPanel } from './components/BugReportPanel'
import { SettingsPage } from './pages/SettingsPage'
import { HomePage } from './pages/HomePage'
import { CharacterCreatorPage } from './pages/CharacterCreatorPage'
import { CharactersPage, SELECTED_CHARACTER_KEY } from './pages/CharactersPage'
import { CompendiumPage } from './pages/CompendiumPage'
import { ErrorBoundary } from './components/ErrorBoundary'

import { hashForPage, installHashRouting, pageFromHash, type AppPage } from './utils/hash-routing'

const SIDEBAR_COLLAPSED_KEY = 'handbook-sidebar-collapsed'

const NAV_ITEMS: { id: AppPage; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'creator', label: 'Character Creator', icon: UserPlus },
  { id: 'characters', label: 'Characters', icon: Users },
  { id: 'compendium', label: 'Compendium', icon: Library }
]

export default function App() {
  const [page, setPage] = useState<AppPage>(() => pageFromHash())
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  )
  const [bugReportOpen, setBugReportOpen] = useState(false)

  const openPage = (id: AppPage) => {
    setPage(id)
    setBugReportOpen(false)
    if (window.location.hash !== hashForPage(id)) {
      window.location.hash = hashForPage(id)
    }
  }

  const toggleBugReport = () => {
    setBugReportOpen((open) => !open)
    if (!bugReportOpen) setPage('home')
  }

  useEffect(() => {
    return installHashRouting((nextPage) => {
      setPage(nextPage)
      setBugReportOpen(false)
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    const pending = sessionStorage.getItem(SELECTED_CHARACTER_KEY)
    if (pending) {
      sessionStorage.removeItem(SELECTED_CHARACTER_KEY)
      setActiveCharacterId(pending)
      openPage('characters')
    }
  }, [])

  const splitCompendium = page === 'compendium' && activeCharacterId !== null

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside
        className="app-sidebar"
        aria-label="Main navigation"
        aria-expanded={!sidebarCollapsed}
      >
        <div className="sidebar-brand">
          <Logo className="sidebar-logo" />
        </div>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed((c) => !c)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`sidebar-nav-item ${page === id && !bugReportOpen ? 'active' : ''}`}
                onClick={() => openPage(id)}
                title={label}
              >
                <Icon size={18} />
                <span className="sidebar-nav-label">{label}</span>
              </button>
            ))}
            <button
              type="button"
              className={`sidebar-nav-item sidebar-nav-item-bug ${bugReportOpen ? 'active' : ''}`}
              onClick={toggleBugReport}
              title="Bug Report"
            >
              <Bug size={18} />
              <span className="sidebar-nav-label">Bug Report</span>
            </button>
          </nav>

        <div className="sidebar-footer">
          <SettingsToggle
            active={page === 'settings' && !bugReportOpen}
            onClick={() => openPage('settings')}
          />
        </div>
      </aside>

      <div className="app-content">
        <main className="app-main">
          <SyncStatusBar />
          {bugReportOpen && <BugReportPanel />}
          {!bugReportOpen && page === 'settings' && <SettingsPage />}
          {!bugReportOpen && page === 'home' && (
            <HomePage
              onNavigate={openPage}
              onViewCharacter={(id) => {
                setActiveCharacterId(id)
                openPage('characters')
              }}
            />
          )}
          {!bugReportOpen && page === 'creator' && (
            <ErrorBoundary label="Character Creator">
              <CharacterCreatorPage />
            </ErrorBoundary>
          )}
          {!bugReportOpen && page === 'characters' && (
            <CharactersPage
              selectedId={activeCharacterId}
              onSelectedIdChange={setActiveCharacterId}
            />
          )}
          {!bugReportOpen && splitCompendium && (
            <div className="sheet-compendium-split">
              <CharactersPage
                selectedId={activeCharacterId}
                onSelectedIdChange={setActiveCharacterId}
                pinned
              />
              <ErrorBoundary label="Compendium">
                <CompendiumPage embedded />
              </ErrorBoundary>
            </div>
          )}
          {!bugReportOpen && page === 'compendium' && !activeCharacterId && <CompendiumPage />}
        </main>
      </div>
    </div>
  )
}
