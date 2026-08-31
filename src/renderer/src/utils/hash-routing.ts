export type AppPage = 'home' | 'creator' | 'characters' | 'compendium' | 'settings'

const PAGE_HASHES: AppPage[] = ['home', 'creator', 'characters', 'compendium', 'settings']

export function pageFromHash(hash = window.location.hash): AppPage {
  const slug = hash.replace(/^#\/?/, '').split('/')[0]?.toLowerCase()
  if (slug && PAGE_HASHES.includes(slug as AppPage)) return slug as AppPage
  return 'home'
}

export function hashForPage(page: AppPage): string {
  return page === 'home' ? '#/' : `#/${page}`
}

export function installHashRouting(onNavigate: (page: AppPage) => void): () => void {
  const handleHashChange = () => onNavigate(pageFromHash())
  window.addEventListener('hashchange', handleHashChange)
  return () => window.removeEventListener('hashchange', handleHashChange)
}
