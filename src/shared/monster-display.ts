import { formatMonsterType, formatSize, titleCase } from './display'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ALIGNMENT_LABELS: Record<string, string> = {
  L: 'Lawful',
  N: 'Neutral',
  C: 'Chaotic',
  G: 'Good',
  E: 'Evil',
  U: 'Unaligned',
  A: 'Any',
  NX: 'Neutral (X-axis)',
  NY: 'Neutral (Y-axis)'
}

export interface MonsterStatRow {
  label: string
  value: string
}

export interface MonsterAbilityBlock {
  name: string
  entries: unknown[]
}

export interface MonsterDetailSection {
  title: string
  headerEntries?: unknown[]
  note?: string
  abilities: MonsterAbilityBlock[]
}

function cleanTag(text: string): string {
  return text.replace(/\{@\w+\s([^|}]+)(?:\|[^}]*)?\}/g, '$1')
}

function formatList(values: unknown[]): string {
  return values.map((v) => cleanTag(String(v))).join(', ')
}

export function formatMonsterAc(ac: unknown): string {
  if (!Array.isArray(ac) || !ac.length) return ''
  const parts: string[] = []
  for (const item of ac) {
    if (typeof item === 'number') {
      parts.push(String(item))
      continue
    }
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if (obj.special) {
      parts.push(String(obj.special))
      continue
    }
    const value = obj.ac
    if (value === undefined) continue
    const from = Array.isArray(obj.from) ? obj.from.map(String).join(', ') : ''
    const condition = obj.condition ? `, ${obj.condition}` : ''
    parts.push(from ? `${value} (${from}${condition})` : `${value}${condition}`)
  }
  return parts.join('; ')
}

export function formatMonsterHp(hp: unknown): string {
  if (!hp || typeof hp !== 'object') return ''
  const obj = hp as Record<string, unknown>
  if (obj.special) return String(obj.special)
  const average = obj.average
  const formula = obj.formula
  if (average !== undefined && formula) return `${average} (${formula})`
  if (average !== undefined) return String(average)
  return ''
}

export function formatMonsterSpeed(speed: unknown): string {
  if (!speed || typeof speed !== 'object') return ''
  const obj = speed as Record<string, unknown>
  const parts: string[] = []
  for (const [mode, value] of Object.entries(obj)) {
    if (mode === 'hover') continue
    if (value === true) {
      parts.push(mode)
      continue
    }
    if (value === false || value === undefined || value === null) continue
    if (typeof value === 'number') {
      parts.push(mode === 'walk' ? `${value} ft.` : `${mode} ${value} ft.`)
    }
  }
  if (obj.hover === true) {
    const flyIndex = parts.findIndex((part) => part.startsWith('fly '))
    if (flyIndex >= 0) parts[flyIndex] = `${parts[flyIndex]} (hover)`
  }
  return parts.join(', ')
}

export function formatMonsterAlignment(alignment: unknown): string {
  if (!alignment) return ''
  if (typeof alignment === 'string') return alignment
  if (Array.isArray(alignment)) {
    return alignment
      .map((part) => {
        if (typeof part === 'string') return ALIGNMENT_LABELS[part] ?? part
        return String(part)
      })
      .join(' ')
  }
  if (typeof alignment === 'object') {
    const obj = alignment as Record<string, unknown>
    if (obj.special) return String(obj.special)
    if (Array.isArray(obj.alignment)) return formatMonsterAlignment(obj.alignment)
  }
  return ''
}

export function formatAbilityModifier(score: unknown): string {
  const n = Number(score)
  if (!Number.isFinite(n)) return '—'
  const mod = Math.floor((n - 10) / 2)
  return mod >= 0 ? `+${mod}` : String(mod)
}

export function formatAbilityScores(raw: Record<string, unknown>): string {
  const parts = ABILITY_KEYS.map((key) => {
    const score = raw[key]
    if (score === undefined || score === null) return null
    return `${key.toUpperCase()} ${score} (${formatAbilityModifier(score)})`
  }).filter(Boolean)
  return parts.join(' · ')
}

function formatModifierMap(map: unknown, label: string): string {
  if (!map || typeof map !== 'object') return ''
  const parts = Object.entries(map as Record<string, unknown>)
    .filter(([key]) => key !== 'special' && key !== 'other')
    .map(([key, value]) => `${titleCase(key)} ${value}`)
  if (!parts.length) return ''
  return `${label}: ${parts.join(', ')}`
}

function formatDamageList(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return cleanTag(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return cleanTag(entry)
        if (entry && typeof entry === 'object') {
          const obj = entry as Record<string, unknown>
          if (obj.special) return String(obj.special)
          if (Array.isArray(obj.preNote)) return formatList(obj.preNote)
        }
        return ''
      })
      .filter(Boolean)
      .join('; ')
  }
  return ''
}

function formatSenses(raw: Record<string, unknown>): string {
  const parts: string[] = []
  if (Array.isArray(raw.senses)) parts.push(formatList(raw.senses))
  if (raw.passive !== undefined && raw.passive !== null) {
    parts.push(`passive Perception ${raw.passive}`)
  }
  return parts.join(', ')
}

function formatLanguages(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) return formatList(value)
  return cleanTag(String(value))
}

export function getMonsterStatRows(detail: Record<string, unknown>): MonsterStatRow[] {
  const rows: MonsterStatRow[] = []

  const ac = formatMonsterAc(detail.ac)
  if (ac) rows.push({ label: 'Armor Class', value: ac })

  const hp = formatMonsterHp(detail.hp)
  if (hp) rows.push({ label: 'Hit Points', value: hp })

  const speed = formatMonsterSpeed(detail.speed)
  if (speed) rows.push({ label: 'Speed', value: speed })

  if (detail.cr !== undefined) rows.push({ label: 'Challenge Rating', value: String(detail.cr) })

  const size = formatSize(detail.size)
  const type = formatMonsterType(detail.type)
  if (size || type) {
    rows.push({ label: 'Size / Type', value: [size, type].filter(Boolean).join(' ') })
  }

  const alignment = formatMonsterAlignment(detail.alignment)
  if (alignment) rows.push({ label: 'Alignment', value: alignment })

  const abilities = formatAbilityScores(detail)
  if (abilities) rows.push({ label: 'Ability Scores', value: abilities })

  const saves = formatModifierMap(detail.save, 'Saving Throws')
  if (saves) rows.push({ label: 'Saving Throws', value: saves.replace(/^Saving Throws: /, '') })

  const skills = formatModifierMap(detail.skill, 'Skills')
  if (skills) rows.push({ label: 'Skills', value: skills.replace(/^Skills: /, '') })

  const vulnerable = formatDamageList(detail.vulnerable)
  if (vulnerable) rows.push({ label: 'Damage Vulnerabilities', value: vulnerable })

  const resist = formatDamageList(detail.resist)
  if (resist) rows.push({ label: 'Damage Resistances', value: resist })

  const immune = formatDamageList(detail.immune)
  if (immune) rows.push({ label: 'Damage Immunities', value: immune })

  const conditionImmune = formatDamageList(detail.conditionImmune)
  if (conditionImmune) rows.push({ label: 'Condition Immunities', value: conditionImmune })

  const senses = formatSenses(detail)
  if (senses) rows.push({ label: 'Senses', value: senses })

  const languages = formatLanguages(detail.languages)
  if (languages) rows.push({ label: 'Languages', value: languages })

  if (detail.pbNote) rows.push({ label: 'Proficiency Bonus', value: String(detail.pbNote) })

  return rows
}

function abilityEntries(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const parts: unknown[] = []
  if (Array.isArray(obj.headerEntries)) parts.push(...obj.headerEntries)
  if (Array.isArray(obj.entries)) parts.push(...obj.entries)
  if (Array.isArray(obj.footerEntries)) parts.push(...obj.footerEntries)

  if (Array.isArray(obj.will) && obj.will.length) {
    parts.push(`At will: ${formatList(obj.will)}`)
  }
  if (obj.daily && typeof obj.daily === 'object') {
    for (const [uses, spells] of Object.entries(obj.daily as Record<string, unknown>)) {
      if (Array.isArray(spells) && spells.length) {
        parts.push(`${uses.replace('e', '')}/day each: ${formatList(spells)}`)
      }
    }
  }
  if (obj.weekly && typeof obj.weekly === 'object') {
    for (const [uses, spells] of Object.entries(obj.weekly as Record<string, unknown>)) {
      if (Array.isArray(spells) && spells.length) {
        parts.push(`${uses.replace('e', '')}/week each: ${formatList(spells)}`)
      }
    }
  }
  if (obj.spells && typeof obj.spells === 'object') {
    for (const [level, slot] of Object.entries(obj.spells as Record<string, unknown>)) {
      if (!slot || typeof slot !== 'object') continue
      const slotObj = slot as Record<string, unknown>
      const slots = slotObj.slots !== undefined ? ` (${slotObj.slots} slots)` : ''
      const spells = Array.isArray(slotObj.spells) ? formatList(slotObj.spells) : ''
      if (spells) parts.push(`Level ${level}${slots}: ${spells}`)
    }
  }

  return parts
}

function toAbilityBlocks(list: unknown): MonsterAbilityBlock[] {
  if (!Array.isArray(list)) return []
  const blocks: MonsterAbilityBlock[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const name = String(obj.name ?? '').trim()
    const entries = abilityEntries(obj)
    if (!name && !entries.length) continue
    blocks.push({ name: name || 'Feature', entries })
  }
  return blocks
}

const MONSTER_SECTION_DEFS: {
  key: keyof Record<string, unknown> | string
  title: string
  headerKey?: string
  noteKey?: string
}[] = [
  { key: 'trait', title: 'Traits' },
  { key: 'spellcasting', title: 'Spellcasting' },
  { key: 'action', title: 'Actions', headerKey: 'actionHeader', noteKey: 'actionNote' },
  { key: 'bonus', title: 'Bonus Actions', headerKey: 'bonusHeader', noteKey: 'bonusNote' },
  { key: 'reaction', title: 'Reactions', headerKey: 'reactionHeader', noteKey: 'reactionNote' },
  { key: 'legendary', title: 'Legendary Actions', headerKey: 'legendaryHeader' },
  { key: 'mythic', title: 'Mythic Actions' },
  { key: 'lair', title: 'Lair Actions' },
  { key: 'regional', title: 'Regional Effects' },
  { key: 'variant', title: 'Variants' }
]

export function getMonsterDetailSections(detail: Record<string, unknown>): MonsterDetailSection[] {
  const sections: MonsterDetailSection[] = []
  for (const def of MONSTER_SECTION_DEFS) {
    const abilities = toAbilityBlocks(detail[def.key])
    const headerEntries = def.headerKey && Array.isArray(detail[def.headerKey])
      ? (detail[def.headerKey] as unknown[])
      : undefined
    const note = def.noteKey && detail[def.noteKey] ? String(detail[def.noteKey]) : undefined
    if (!abilities.length && !headerEntries?.length && !note) continue
    sections.push({
      title: def.title,
      headerEntries,
      note,
      abilities
    })
  }
  return sections
}

export function isMonsterDetail(detail: unknown): detail is Record<string, unknown> {
  if (!detail || typeof detail !== 'object') return false
  const obj = detail as Record<string, unknown>
  return (
    obj.trait !== undefined ||
    obj.action !== undefined ||
    obj.spellcasting !== undefined ||
    obj.hp !== undefined ||
    (obj.ac !== undefined && obj.str !== undefined)
  )
}
