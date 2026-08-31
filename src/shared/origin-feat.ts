import type { Ability, EntityRef } from './character'
import { ABILITIES, formatSkillName, isSkillInList, normalizeSkillKey } from './character'

export type CreatorEdition = '2024' | '2014'

export interface BackgroundFeatRef {
  id: string
  type: 'fixed' | 'category'
  name: string
  source: string
  variant?: string
  categories?: string[]
}

export interface OriginFeatChoices {
  skills?: string[]
  tools?: string[]
  languages?: string[]
  weapons?: string[]
  spellAbility?: Ability
  cantrips?: EntityRef[]
  spells?: EntityRef[]
  categoryFeat?: EntityRef
}

export interface OriginFeatSelection {
  refId: string
  name: string
  source: string
  variant?: string
  choices: OriginFeatChoices
}

export type FeatChoiceKind =
  | 'skills-or-tools'
  | 'tools'
  | 'skill-one'
  | 'spell-ability'
  | 'cantrips'
  | 'spells'
  | 'category-feat'
  | 'none'

export interface FeatChoiceRequirement {
  kind: FeatChoiceKind
  count?: number
  skillOptions?: string[]
  toolOptions?: string[]
  spellClass?: string
  cantripCount?: number
  spellCount?: number
  category?: string[]
}

export const STANDARD_SKILLS = [
  'acrobatics',
  'animal handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight of hand',
  'stealth',
  'survival'
] as const

export const ARTISAN_TOOLS = [
  "carpenter's tools",
  "leatherworker's tools",
  "mason's tools",
  "potter's tools",
  "smith's tools",
  "tinker's tools",
  "weaver's tools",
  "woodcarver's tools"
] as const

export const GENERAL_TOOLS = [
  "alchemist's supplies",
  "brewer's supplies",
  "calligrapher's supplies",
  "carpenter's tools",
  "cartographer's tools",
  "cobbler's tools",
  "cook's utensils",
  'disguise kit',
  'forgery kit',
  'gaming set',
  'glassblower\'s tools',
  'herbalism kit',
  "jeweler's tools",
  "leatherworker's tools",
  "mason's tools",
  "navigator's tools",
  "painter's supplies",
  "poisoner's kit",
  "potter's tools",
  "smith's tools",
  'thieves\' tools',
  "tinker's tools",
  "weaver's tools",
  "woodcarver's tools"
] as const

export const MUSICAL_INSTRUMENTS = [
  'bagpipes',
  'drum',
  'dulcimer',
  'flute',
  'lute',
  'lyre',
  'horn',
  'pan flute',
  'shawm',
  'viol'
] as const

function titleCaseWords(text: string): string {
  return text
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function refId(type: string, name: string, source: string, variant?: string): string {
  return `${type}:${name}:${source}:${variant ?? ''}`.toLowerCase()
}

export function parseBackgroundFeatRefs(detail: Record<string, unknown>): BackgroundFeatRef[] {
  const feats = detail.feats as Array<Record<string, unknown>> | undefined
  if (!feats?.length) return []

  const result: BackgroundFeatRef[] = []
  for (const block of feats) {
    if (block.anyFromCategory) {
      const categories = (block.anyFromCategory as { category?: string[] }).category ?? []
      result.push({
        id: refId('category', categories.join('+'), '', ''),
        type: 'category',
        name: 'Choose Feat',
        source: '',
        categories
      })
      continue
    }

    const raw = Object.keys(block).find((k) => k !== 'anyFromCategory' && block[k] === true)
    if (!raw) continue

    const [namePart, sourcePart = ''] = raw.split('|')
    const semi = namePart.indexOf(';')
    const name = (semi >= 0 ? namePart.slice(0, semi) : namePart).trim()
    const variant = semi >= 0 ? namePart.slice(semi + 1).trim() : undefined
    const source = sourcePart.split(';')[0]?.trim() ?? ''

    result.push({
      id: refId('fixed', name, source, variant),
      type: 'fixed',
      name: titleCaseWords(name),
      source: source || sourcePart.trim(),
      variant
    })
  }
  return result
}

export function formatOriginFeatLabel(ref: BackgroundFeatRef): string {
  if (ref.type === 'category') {
    const label = ref.categories?.includes('DG') ? 'Dark Gift' : 'Feat'
    return `Choose ${label}`
  }
  if (ref.variant) {
    return `${ref.name} (${titleCaseWords(ref.variant)})`
  }
  return ref.name
}

export function mergeFeatVersion(
  base: Record<string, unknown>,
  variant?: string
): Record<string, unknown> {
  if (!variant) return base
  const versions = base._versions as Array<Record<string, unknown>> | undefined
  const target = `; ${variant}`.toLowerCase()
  const version = versions?.find((v) =>
    String(v.name ?? '')
      .toLowerCase()
      .endsWith(target)
  )
  if (!version) return base
  const merged = { ...base, ...version }
  delete merged._mod
  delete merged._versions
  return merged
}

export function analyzeFeatChoices(feat: Record<string, unknown>, variant?: string): FeatChoiceRequirement[] {
  const detail = mergeFeatVersion(feat, variant)
  const requirements: FeatChoiceRequirement[] = []

  const stl = detail.skillToolLanguageProficiencies as Array<Record<string, unknown>> | undefined
  if (stl?.length) {
    for (const block of stl) {
      const choose = (block.choose as Array<Record<string, unknown>> | undefined)?.[0]
      const from = (choose?.from as string[] | undefined) ?? []
      const count = Number(choose?.count ?? 0)
      if (from.includes('anySkill') || from.includes('anyTool')) {
        requirements.push({ kind: 'skills-or-tools', count })
      }
    }
  }

  const tools = detail.toolProficiencies as Array<Record<string, unknown>> | undefined
  if (tools?.length) {
    for (const block of tools) {
      const choose = block.choose as { from?: string[]; count?: number } | undefined
      if (choose?.from?.length) {
        requirements.push({
          kind: 'tools',
          count: choose.count ?? 1,
          toolOptions: choose.from.map((t) => t.replace(/\|.*$/, ''))
        })
        continue
      }
      const musical = block.anyMusicalInstrument as number | undefined
      if (musical) {
        requirements.push({
          kind: 'tools',
          count: musical,
          toolOptions: [...MUSICAL_INSTRUMENTS]
        })
      }
    }
  }

  const skills = detail.skillProficiencies as Array<Record<string, unknown>> | undefined
  if (skills?.length) {
    for (const block of skills) {
      const choose = block.choose as { from?: string[]; count?: number } | undefined
      if (choose?.from?.length) {
        requirements.push({
          kind: 'skill-one',
          count: choose.count ?? 1,
          skillOptions: choose.from.map((s) => s.replace(/\|.*$/, ''))
        })
      }
    }
  }

  const spells = detail.additionalSpells as Array<Record<string, unknown>> | undefined
  if (spells?.length) {
    const block = spells[0]
    const abilityChoose = (block.ability as { choose?: string[] } | undefined)?.choose
    if (abilityChoose?.length) {
      requirements.push({ kind: 'spell-ability' })
    }

    const known = block.known as Record<string, unknown[]> | undefined
    const knownList = known?._
    if (knownList?.length) {
      for (const entry of knownList) {
        if ((entry as { choose?: string }).choose) {
          const count = Number((entry as { count?: number }).count ?? 1)
          const choose = String((entry as { choose?: string }).choose)
          const classMatch = choose.match(/class=([^|]+)/i)
          if (choose.includes('level=0')) {
            requirements.push({
              kind: 'cantrips',
              cantripCount: count,
              spellClass: classMatch?.[1] ?? variant ?? 'Cleric'
            })
          } else if (choose.includes('level=1')) {
            requirements.push({
              kind: 'spells',
              spellCount: count,
              spellClass: classMatch?.[1] ?? variant ?? 'Cleric'
            })
          }
        }
      }
    }

    const innate = block.innate as Record<string, { daily?: Record<string, unknown[]> }> | undefined
    const daily = innate?._?.daily?.['1']
    if (daily?.length) {
      for (const entry of daily) {
        if ((entry as { choose?: string }).choose) {
          const choose = String((entry as { choose?: string }).choose)
          const classMatch = choose.match(/class=([^|]+)/i)
          requirements.push({
            kind: 'spells',
            spellCount: 1,
            spellClass: classMatch?.[1] ?? variant ?? 'Cleric'
          })
        }
      }
    }
  }

  if (!requirements.length) {
    requirements.push({ kind: 'none' })
  }

  return requirements
}

export function autoGrantFromFeat(feat: Record<string, unknown>, variant?: string): OriginFeatChoices {
  const detail = mergeFeatVersion(feat, variant)
  const grants: OriginFeatChoices = { skills: [], tools: [], languages: [], weapons: [] }

  const langs = detail.languageProficiencies as Array<Record<string, unknown>> | undefined
  if (langs?.length) {
    for (const block of langs) {
      for (const key of Object.keys(block)) {
        if (block[key] === true) grants.languages!.push(key.replace(/\|.*$/, ''))
      }
    }
  }

  const weapons = detail.weaponProficiencies as Array<Record<string, unknown>> | undefined
  if (weapons?.some((w) => w.improvised === true)) {
    grants.weapons!.push('improvised weapons')
  }

  return grants
}

export function featGrantsTough(feat: Record<string, unknown>): boolean {
  return String(feat.name ?? '').toLowerCase() === 'tough'
}

export function isOriginFeatComplete(
  requirements: FeatChoiceRequirement[],
  choices: OriginFeatChoices,
  ref?: BackgroundFeatRef
): boolean {
  if (ref?.type === 'category') {
    return !!choices.categoryFeat
  }

  for (const req of requirements) {
    switch (req.kind) {
      case 'skills-or-tools': {
        const picked = (choices.skills?.length ?? 0) + (choices.tools?.length ?? 0)
        if (picked !== (req.count ?? 0)) return false
        break
      }
      case 'tools':
        if ((choices.tools?.length ?? 0) !== (req.count ?? 0)) return false
        break
      case 'skill-one':
        if ((choices.skills?.length ?? 0) !== (req.count ?? 1)) return false
        break
      case 'spell-ability':
        if (!choices.spellAbility) return false
        break
      case 'cantrips':
        if ((choices.cantrips?.length ?? 0) !== (req.cantripCount ?? 0)) return false
        break
      case 'spells':
        if ((choices.spells?.length ?? 0) !== (req.spellCount ?? 0)) return false
        break
      case 'category-feat':
        if (!choices.categoryFeat) return false
        break
      case 'none':
        break
    }
  }
  return true
}

export function formatOriginFeatSummary(selections: OriginFeatSelection[]): string {
  if (!selections.length) return 'None'
  return selections
    .map((s) => {
      const label = s.variant ? `${s.name} (${titleCaseWords(s.variant)})` : s.name
      return label
    })
    .join(' · ')
}

export function mergeFeatProficiencies(
  backgroundSkills: string[],
  backgroundTools: string[],
  selections: OriginFeatSelection[]
): { skills: string[]; tools: string[]; languages: string[]; weapons: string[] } {
  const skills = [...backgroundSkills]
  const tools = [...backgroundTools]
  const languages: string[] = []
  const weapons: string[] = []

  for (const sel of selections) {
    for (const s of sel.choices.skills ?? []) {
      if (!isSkillInList(s, skills)) skills.push(s)
    }
    for (const t of sel.choices.tools ?? []) {
      if (!tools.some((x) => normalizeSkillKey(x) === normalizeSkillKey(t))) tools.push(t)
    }
    for (const l of sel.choices.languages ?? []) {
      if (!languages.some((x) => normalizeSkillKey(x) === normalizeSkillKey(l))) languages.push(l)
    }
    for (const w of sel.choices.weapons ?? []) {
      if (!weapons.includes(w)) weapons.push(w)
    }
  }

  return { skills, tools, languages, weapons }
}

export function displayFeatChoiceSummary(choices: OriginFeatChoices): string[] {
  const lines: string[] = []
  if (choices.skills?.length) {
    lines.push(`Skills: ${choices.skills.map(formatSkillName).join(', ')}`)
  }
  if (choices.tools?.length) {
    lines.push(`Tools: ${choices.tools.map(formatSkillName).join(', ')}`)
  }
  if (choices.languages?.length) {
    lines.push(`Languages: ${choices.languages.map(formatSkillName).join(', ')}`)
  }
  if (choices.weapons?.length) {
    lines.push(`Weapons: ${choices.weapons.join(', ')}`)
  }
  if (choices.spellAbility) {
    lines.push(`Spellcasting: ${choices.spellAbility.toUpperCase()}`)
  }
  if (choices.cantrips?.length) {
    lines.push(`Cantrips: ${choices.cantrips.map((s) => s.name).join(', ')}`)
  }
  if (choices.spells?.length) {
    lines.push(`Spells: ${choices.spells.map((s) => s.name).join(', ')}`)
  }
  if (choices.categoryFeat) {
    lines.push(`Chosen: ${choices.categoryFeat.name}`)
  }
  return lines
}

export function spellClassFromVariant(variant?: string): string | undefined {
  if (!variant) return undefined
  return titleCaseWords(variant)
}

export function abilityFromString(value: string): Ability | null {
  const key = value.toLowerCase() as Ability
  return ABILITIES.includes(key) ? key : null
}
