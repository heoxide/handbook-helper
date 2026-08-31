import { useEffect, useState } from 'react'
import { Castle, Library, UserPlus, Users } from 'lucide-react'

interface HomePageProps {
  onNavigate: (page: 'creator' | 'characters' | 'compendium') => void
  onViewCharacter: (id: string) => void
}

export function HomePage({ onNavigate, onViewCharacter }: HomePageProps) {
  const [characters, setCharacters] = useState<
    Awaited<ReturnType<typeof window.handbook.characters.list>>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void window.handbook.characters.list().then((list) => {
      setCharacters(list)
      setLoading(false)
    })
  }, [])

  return (
    <>
      <div className="welcome-banner">
        <h2>
          <Castle size={20} color="var(--cyan)" />
          Welcome to Your Digital D&amp;D Companion
        </h2>
        <p>
          Experience D&amp;D 5th Edition with intelligent automation, comprehensive rules reference,
          and streamlined character creation that follows official guidelines.
        </p>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-card-icon">
            <UserPlus size={24} />
          </div>
          <h3>Character Creation</h3>
          <p className="subtitle">
            Build your perfect D&amp;D character with guided, rule-compliant creation.
          </p>
          <ul className="feature-list">
            <li>2024 PHB flow: class, background, species</li>
            <li>Standard array, point buy, or rolled abilities</li>
            <li>Background skill overlap rules &amp; Expertise</li>
            <li>Save characters as JSON · view in Characters</li>
            <li>XPHB + compatible 2024 source books</li>
          </ul>
          <button className="btn-primary" onClick={() => onNavigate('creator')}>
            <UserPlus size={16} />
            Start Creating
          </button>
        </div>

        <div className="feature-card">
          <div className="feature-card-icon">
            <Library size={24} />
          </div>
          <h3>Rules Compendium</h3>
          <p className="subtitle">
            Complete D&amp;D 5e reference with searchable rules, spells, and monsters.
          </p>
          <ul className="feature-list">
            <li>Official rulebooks and sources</li>
            <li>Complete bestiary with CR ratings</li>
            <li>Searchable spells and abilities</li>
            <li>Sourcebook filtering and organization</li>
          </ul>
          <button className="btn-primary" onClick={() => onNavigate('compendium')}>
            <Library size={16} />
            Browse Rules
          </button>
        </div>
      </div>

      <section className="home-characters-section">
        <div className="feature-card home-characters-card">
          <div className="home-characters-head">
            <div className="home-characters-head-main">
              <div className="feature-card-icon">
                <Users size={24} />
              </div>
              <div>
                <h3>View Characters</h3>
                <p className="subtitle">
                  Jump back into a saved hero&apos;s sheet — level up, cast spells, and track resources.
                </p>
              </div>
            </div>
            <button className="btn-primary home-characters-all-btn" onClick={() => onNavigate('characters')}>
              <Users size={16} />
              View all
            </button>
          </div>

          {loading ? (
            <p className="home-characters-status">Loading characters…</p>
          ) : characters.length === 0 ? (
            <div className="home-characters-empty">
              <p>No saved characters yet. Create one in Character Creation, then return here to play.</p>
              <button className="btn-secondary" onClick={() => onNavigate('creator')}>
                <UserPlus size={16} />
                Create a character
              </button>
            </div>
          ) : (
            <div className="home-characters-grid">
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="character-card"
                  onClick={() => onViewCharacter(c.id)}
                >
                  <span className="character-card-level">Lv {c.level}</span>
                  <span className="character-card-class">{c.className}</span>
                  <span className="character-card-name">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
