import { formatSpellSchool } from './compendium'

const SPELL_SCHOOL_SHORT: Record<string, string> = {
  A: 'Abj.',
  B: 'Abj.',
  C: 'Conj.',
  D: 'Divin.',
  E: 'Ench.',
  I: 'Illu.',
  N: 'Necro.',
  P: 'Ench.',
  T: 'Trans.',
  V: 'Evoc.'
}

const TIME_UNIT_SHORT: Record<string, string> = {
  action: 'Action',
  bonus: 'Bonus',
  reaction: 'Reaction',
  minute: 'Min.',
  hour: 'Hr.',
  round: 'Round'
}

const TIME_SINGLETON_UNITS = new Set(['action', 'bonus', 'reaction'])

const LEVEL_NAMES = [
  'Cantrip',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th'
]

export function formatSpellSchoolShort(code: string | undefined): string {
  if (!code) return ''
  return SPELL_SCHOOL_SHORT[code] ?? formatSpellSchool(code)
}

export function getSpellSchoolColorClass(code: string | undefined): string {
  if (!code) return ''
  const map: Record<string, string> = {
    A: 'school-abj',
    B: 'school-abj',
    V: 'school-evoc',
    N: 'school-necro',
    C: 'school-conj',
    D: 'school-div',
    E: 'school-ench',
    I: 'school-illu',
    T: 'school-trans',
    P: 'school-ench'
  }
  return map[code] ?? ''
}

export function formatSpellLevelLabel(
  level: number | undefined,
  ritual?: boolean
): string {
  if (level === undefined) return ''
  const base = LEVEL_NAMES[level] ?? String(level)
  return ritual ? `${base} (rit.)` : base
}

export function formatCastTime(time: unknown): string {
  if (!Array.isArray(time) || !time.length) return ''
  const t = time[0] as Record<string, unknown>
  const unit = String(t.unit ?? '')
  const number = Number(t.number ?? 1)
  if (number === 1 && TIME_SINGLETON_UNITS.has(unit)) {
    return TIME_UNIT_SHORT[unit] ?? unit
  }
  const unitLabel = TIME_UNIT_SHORT[unit] ?? unit
  return `${number} ${unitLabel}`.trim()
}

const DURATION_UNIT_LABELS: Record<string, string> = {
  round: 'round',
  minute: 'minute',
  hour: 'hour',
  day: 'day'
}

function formatDurationAmount(amount: number, unit: string): string {
  const label = DURATION_UNIT_LABELS[unit] ?? unit
  if (amount === 1) return `1 ${label}`
  return `${amount} ${label}s`
}

export function formatSpellDuration(duration: unknown): string {
  if (!Array.isArray(duration) || !duration.length) return ''

  const parts: string[] = []
  for (const item of duration) {
    const entry = item as Record<string, unknown>
    const type = String(entry.type ?? '')

    if (type === 'instant') {
      parts.push('Instantaneous')
      continue
    }
    if (type === 'permanent') {
      parts.push('Permanent')
      continue
    }
    if (type === 'special') {
      parts.push('Special')
      continue
    }
    if (type === 'timed') {
      const inner = entry.duration as Record<string, unknown> | undefined
      const amount = Number(inner?.amount ?? 1)
      const unit = String(inner?.type ?? '')
      const span = formatDurationAmount(amount, unit)
      parts.push(entry.concentration ? `Concentration, up to ${span}` : `Up to ${span}`)
    }
  }

  return parts.join('; ')
}

export function formatSpellComponents(components: unknown): string {
  if (!components || typeof components !== 'object') return ''
  const c = components as Record<string, unknown>
  const parts: string[] = []
  if (c.v) parts.push('V')
  if (c.s) parts.push('S')
  if (c.m) parts.push(typeof c.m === 'string' ? `M (${c.m})` : 'M')
  return parts.join(', ')
}

export function formatSpellRange(range: unknown): string {
  if (!range || typeof range !== 'object') return ''
  const r = range as Record<string, unknown>
  const type = String(r.type ?? '')

  if (type === 'self') return 'Self'
  if (type === 'touch') return 'Touch'
  if (type === 'sight') return 'Sight'
  if (type === 'unlimited') return 'Unlimited'
  if (type === 'special') return 'Special'

  const distance = r.distance as Record<string, unknown> | undefined
  if (distance) {
    const amount = distance.amount
    const distType = String(distance.type ?? '')
    if (distType === 'feet' && amount !== undefined) return `${amount} feet`
    if (distType === 'miles' && amount !== undefined) return `${amount} mi.`
    if (distType === 'self') return 'Self'
  }

  if (type === 'point' && distance?.amount !== undefined) {
    return `${distance.amount} feet`
  }

  return type ? type.charAt(0).toUpperCase() + type.slice(1) : ''
}

export function spellRequiresConcentration(duration: unknown): boolean {
  if (!Array.isArray(duration)) return false
  return duration.some((d) => Boolean((d as Record<string, unknown>).concentration))
}

export function formatMonsterType(type: unknown): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  if (typeof type === 'object') {
    const obj = type as Record<string, unknown>
    const base = String(obj.type ?? '')
    const tags = Array.isArray(obj.tags) ? obj.tags.map(String).join(', ') : ''
    return tags ? `${base} (${tags})` : base
  }
  return ''
}

export function formatSize(size: unknown): string {
  if (!size) return ''
  if (Array.isArray(size)) return size.map(String).join('/')
  return String(size)
}

export function titleCase(value: string): string {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}
