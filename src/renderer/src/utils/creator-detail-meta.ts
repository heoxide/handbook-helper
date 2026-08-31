import { ABILITY_NAMES, formatSkillName, parseBackgroundFeat, parseNamedProficiencies } from '../../../shared/character'
import type { Ability } from '../../../shared/character'
import type { CreatorEdition } from '../../../shared/origin-feat'
import {
  formatSpeciesAsiSummary,
  parseSpeciesAbility,
  speciesAsiHasBonuses
} from '../../../shared/species-asi'

export interface DetailMetaRow {
  label: string
  value: string
}

function pushRow(rows: DetailMetaRow[], label: string, value: string | null | undefined) {
  if (value?.trim()) rows.push({ label, value: value.trim() })
}

function formatSize(value: unknown): string | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    return value
      .map((s) => (s === 'S' ? 'Small' : s === 'M' ? 'Medium' : s === 'L' ? 'Large' : String(s)))
      .join(' or ')
  }
  return String(value)
}

function formatSpeed(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number') return `${value} ft.`
  if (typeof value === 'object' && value !== null) {
    const sp = value as Record<string, number>
    const parts: string[] = []
    if (sp.walk != null) parts.push(`${sp.walk} ft. walk`)
    if (sp.fly != null) parts.push(`${sp.fly} ft. fly`)
    if (sp.swim != null) parts.push(`${sp.swim} ft. swim`)
    if (sp.climb != null) parts.push(`${sp.climb} ft. climb`)
    if (sp.burrow != null) parts.push(`${sp.burrow} ft. burrow`)
    return parts.length ? parts.join(', ') : null
  }
  return String(value)
}

function formatLanguageProficiencies(list: unknown): string | null {
  if (!Array.isArray(list) || !list.length) return null
  const parts: string[] = []
  for (const block of list) {
    if (!block || typeof block !== 'object') continue
    for (const [key, val] of Object.entries(block as Record<string, unknown>)) {
      if (key === 'common' && val === true) parts.push('Common')
      else if (key === 'anyStandard' && typeof val === 'number') {
        parts.push(`${val} standard language${val === 1 ? '' : 's'} of your choice`)
      } else if (key === 'any' && typeof val === 'number') {
        parts.push(`${val} language${val === 1 ? '' : 's'} of your choice`)
      } else if (val === true) {
        parts.push(formatSkillName(key.replace(/\|.*$/, '')))
      }
    }
  }
  return parts.length ? parts.join(', ') : null
}

function formatTraitTags(tags: unknown): string | null {
  if (!Array.isArray(tags) || !tags.length) return null
  return tags.map((t) => formatSkillName(String(t))).join(', ')
}

function formatCreatureTypes(types: unknown): string | null {
  if (!Array.isArray(types) || !types.length) return null
  return types.map((t) => formatSkillName(String(t))).join(', ')
}

function formatResistances(resist: unknown): string | null {
  if (!Array.isArray(resist)) return null
  const parts: string[] = []
  for (const entry of resist) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    if (typeof obj.resist === 'string') parts.push(obj.resist)
    if (Array.isArray(obj.resist)) parts.push(...obj.resist.map(String))
    const choose = (obj.choose as { from?: string[] })?.from
    if (choose?.length) parts.push(`Choose: ${choose.map(formatSkillName).join(', ')}`)
  }
  return parts.length ? parts.join('; ') : null
}

function formatDamageList(list: unknown): string | null {
  if (!Array.isArray(list) || !list.length) return null
  return list.map((x) => formatSkillName(String(x))).join(', ')
}

function formatAdditionalSpellLineages(spells: unknown): string | null {
  if (!Array.isArray(spells) || !spells.length) return null
  const names = spells
    .map((s) => (s && typeof s === 'object' ? String((s as Record<string, unknown>).name ?? '') : ''))
    .filter(Boolean)
  return names.length ? names.join(', ') : null
}

export function buildSpeciesDetailMeta(
  detail: Record<string, unknown> | null,
  edition?: CreatorEdition
): DetailMetaRow[] {
  if (!detail) return []
  const rows: DetailMetaRow[] = []

  if (edition === '2014') {
    const asi = parseSpeciesAbility(detail)
    if (speciesAsiHasBonuses(asi)) {
      pushRow(rows, 'Ability Score Increase', formatSpeciesAsiSummary(asi))
    }
  }

  pushRow(rows, 'Size', formatSize(detail.size))
  pushRow(rows, 'Speed', formatSpeed(detail.speed))
  if (detail.darkvision != null) {
    pushRow(rows, 'Darkvision', `${String(detail.darkvision)} ft.`)
  }
  pushRow(rows, 'Creature Type', formatCreatureTypes(detail.creatureTypes))
  pushRow(rows, 'Traits', formatTraitTags(detail.traitTags))

  const skills = parseNamedProficiencies(detail.skillProficiencies as never)
  if (skills.length) pushRow(rows, 'Skill Proficiencies', skills.map(formatSkillName).join(', '))

  pushRow(rows, 'Languages', formatLanguageProficiencies(detail.languageProficiencies))
  pushRow(rows, 'Damage Resistance', formatResistances(detail.resist))
  pushRow(rows, 'Damage Immunity', formatDamageList(detail.immune))
  pushRow(rows, 'Damage Vulnerability', formatDamageList(detail.vulnerable))
  pushRow(rows, 'Condition Immunity', formatDamageList(detail.conditionImmune))
  pushRow(rows, 'Spell Lineages', formatAdditionalSpellLineages(detail.additionalSpells))

  if (typeof detail.sizeEntry === 'string') {
    pushRow(rows, 'Size Notes', detail.sizeEntry)
  }

  return rows
}

export function buildBackgroundDetailMeta(
  detail: Record<string, unknown> | null,
  backgroundAbilities: Ability[],
  backgroundSkills: string[],
  backgroundTools: string[]
): DetailMetaRow[] {
  if (!detail) return []
  const rows: DetailMetaRow[] = []

  if (backgroundAbilities.length) {
    pushRow(rows, 'Ability Options', backgroundAbilities.map((a) => ABILITY_NAMES[a]).join(', '))
  }
  pushRow(rows, 'Origin Feat', parseBackgroundFeat(detail))
  if (backgroundSkills.length) {
    pushRow(rows, 'Skill Proficiencies', backgroundSkills.map(formatSkillName).join(', '))
  }
  if (backgroundTools.length) {
    pushRow(rows, 'Tool Proficiencies', backgroundTools.map(formatSkillName).join(', '))
  }
  pushRow(rows, 'Languages', formatLanguageProficiencies(detail.languageProficiencies))

  return rows
}
