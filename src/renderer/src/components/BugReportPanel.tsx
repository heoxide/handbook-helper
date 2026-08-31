import { useState } from 'react'
import { Mail, ExternalLink } from 'lucide-react'
import { CONTACT_EMAIL } from '../../../shared/contact'

const DEFAULT_SUBJECT = 'Handbook Helper Bug Report'

function buildBody(message: string, appVersion: string | null): string {
  const trimmed = message.trim()
  const footer = [
    '',
    '---',
    'Sent from Handbook Helper',
    appVersion ? `App version: ${appVersion}` : undefined
  ]
    .filter(Boolean)
    .join('\n')
  return trimmed ? `${trimmed}${footer}` : footer.trim()
}

export function BugReportPanel() {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openCompose = async (via: 'gmail' | 'mailto') => {
    setError(null)
    setSending(true)
    try {
      const version = await window.handbook.app.getVersion()
      const body = buildBody(message, version)
      const ok = await window.handbook.app.composeEmail({
        subject: subject.trim() || DEFAULT_SUBJECT,
        body,
        via
      })
      if (!ok) {
        setError('Could not open your email app. Check that a browser or mail client is installed.')
      }
    } catch {
      setError('Could not open your email app. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="settings-panel contact-panel bug-report-panel">
      <h3>Bug Report</h3>
      <p className="hint-text contact-intro">
        Found a problem? Send a report to{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="contact-email-link"
          onClick={(e) => {
            e.preventDefault()
            void openCompose('mailto')
          }}
        >
          {CONTACT_EMAIL}
        </a>
        . Include steps to reproduce and what you expected to happen.
      </p>

      <label className="contact-field">
        <span className="contact-field-label">Subject</span>
        <input
          type="text"
          className="contact-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={DEFAULT_SUBJECT}
        />
      </label>

      <label className="contact-field">
        <span className="contact-field-label">What went wrong?</span>
        <textarea
          className="contact-textarea"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="1. What were you doing?&#10;2. What happened?&#10;3. What did you expect instead?"
        />
      </label>

      {error && <p className="contact-error">{error}</p>}

      <div className="contact-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={sending}
          onClick={() => void openCompose('gmail')}
        >
          <Mail size={16} />
          Open in Gmail
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={sending}
          onClick={() => void openCompose('mailto')}
        >
          <ExternalLink size={16} />
          Default email app
        </button>
      </div>
      <p className="hint-text contact-footnote">
        Your message opens pre-filled in Gmail or your default mail app. Nothing is sent until you
        press Send there.
      </p>
    </div>
  )
}
