export const CONTACT_EMAIL = 'h.fehim.arici@gmail.com'

export interface ComposeEmailOptions {
  to?: string
  subject?: string
  body?: string
}

export function buildGmailComposeUrl(options: ComposeEmailOptions = {}): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: options.to ?? CONTACT_EMAIL
  })
  if (options.subject) params.set('su', options.subject)
  if (options.body) params.set('body', options.body)
  return `https://mail.google.com/mail/?${params.toString()}`
}

export function buildMailtoUrl(options: ComposeEmailOptions = {}): string {
  const to = options.to ?? CONTACT_EMAIL
  const params = new URLSearchParams()
  if (options.subject) params.set('subject', options.subject)
  if (options.body) params.set('body', options.body)
  const qs = params.toString()
  return qs ? `mailto:${to}?${qs}` : `mailto:${to}`
}
