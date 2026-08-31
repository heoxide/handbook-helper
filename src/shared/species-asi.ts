import { ABILITIES, ABILITY_NAMES, type Ability } from './character'

export interface SpeciesAsiChoice {
  from: Ability[]
  /** How many distinct abilities to pick from `from`. */
  count: number
  /** Bonus applied per pick (+1 default; Custom Lineage uses +2). */
  amountPerPick: number
}

export interface SpeciesAsiBlock {
  fixed: Partial<Record<Ability, number>>
  choices: SpeciesAsiChoice[]
}

function isAbilityKey(key: string): key is Ability {
  return (ABILITIES as readonly string[]).includes(key)
}

function parseChooseBlock(choose: {
  from?: string[]
  count?: number
  amount?: number
}): SpeciesAsiChoice | null {
  const from = (choose.from ?? []).filter(isAbilityKey)
  if (!from.length) return null

  if (choose.count != null && choose.count > 0) {
    return { from, count: choose.count, amountPerPick: 1 }
  }

  const amount = choose.amount ?? 1
  return { from, count: 1, amountPerPick: amount }
}

function parseAbilityEntry(entry: Record<string, unknown>): SpeciesAsiBlock {
  const fixed: Partial<Record<Ability, number>> = {}
  const choices: SpeciesAsiChoice[] = []

  for (const key of ABILITIES) {
    const value = entry[key]
    if (typeof value === 'number' && value !== 0) {
      fixed[key] = value
    }
  }

  const choose = entry.choose as
    | { from?: string[]; count?: number; amount?: number }
    | undefined
  if (choose) {
    const block = parseChooseBlock(choose)
    if (block) choices.push(block)
  }

  return { fixed, choices }
}

function mergeBlocks(...blocks: SpeciesAsiBlock[]): SpeciesAsiBlock {
  const fixed: Partial<Record<Ability, number>> = {}
  const choices: SpeciesAsiChoice[] = []

  for (const block of blocks) {
    for (const [ab, amount] of Object.entries(block.fixed) as [Ability, number][]) {
      fixed[ab] = (fixed[ab] ?? 0) + amount
    }
    choices.push(...block.choices)
  }

  return { fixed, choices }
}

/** PHB Human grants +1 to all abilities (not stored in 5etools JSON). */
function isPhbStandardHuman(detail: Record<string, unknown>): boolean {
  const name = String(detail.name ?? '')
  const source = String(detail.source ?? '').toUpperCase()
  const raceName = detail.raceName as string | undefined
  if (source !== 'PHB') return false
  if (name === 'Variant' && raceName === 'Human') return false
  return name === 'Human' && !raceName
}

/** Parse 2014 species ability score increases from resolved race detail. */
export function parseSpeciesAbility(detail: Record<string, unknown>): SpeciesAsiBlock {
  if (isPhbStandardHuman(detail)) {
    return {
      fixed: Object.fromEntries(ABILITIES.map((ab) => [ab, 1])) as Record<Ability, number>,
      choices: []
    }
  }

  const raw = detail.ability
  if (!Array.isArray(raw) || !raw.length) {
    return { fixed: {}, choices: [] }
  }

  const blocks = raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map(parseAbilityEntry)

  return mergeBlocks(...blocks)
}

export function speciesAsiHasChoices(asi: SpeciesAsiBlock): boolean {
  return asi.choices.length > 0
}

export function speciesAsiHasBonuses(asi: SpeciesAsiBlock): boolean {
  return (
    Object.keys(asi.fixed).length > 0 ||
    asi.choices.length > 0
  )
}

export function emptySpeciesAsiPicks(asi: SpeciesAsiBlock): Ability[][] {
  return asi.choices.map(() => [])
}

export function validateSpeciesAsiPicks(asi: SpeciesAsiBlock, picks: Ability[][]): boolean {
  if (asi.choices.length !== picks.length) return false

  for (let i = 0; i < asi.choices.length; i++) {
    const choice = asi.choices[i]!
    const blockPicks = picks[i] ?? []
    const seen = new Set<Ability>()

    for (let pickIdx = 0; pickIdx < choice.count; pickIdx++) {
      const ab = blockPicks[pickIdx]
      if (!ab || !choice.from.includes(ab)) return false
      if (seen.has(ab)) return false
      seen.add(ab)
    }
  }

  return true
}

export function applySpeciesAsi(
  scores: Record<Ability, number>,
  asi: SpeciesAsiBlock,
  picks: Ability[][]
): Record<Ability, number> {
  const result = { ...scores }

  for (const [ab, amount] of Object.entries(asi.fixed) as [Ability, number][]) {
    if (amount) result[ab] = Math.min(20, result[ab] + amount)
  }

  asi.choices.forEach((choice, blockIdx) => {
    const blockPicks = picks[blockIdx] ?? []
    for (const ab of blockPicks) {
      result[ab] = Math.min(20, result[ab] + choice.amountPerPick)
    }
  })

  return result
}

export function getSpeciesAsiBonusForAbility(
  ability: Ability,
  asi: SpeciesAsiBlock,
  picks: Ability[][]
): number {
  let bonus = asi.fixed[ability] ?? 0

  asi.choices.forEach((choice, blockIdx) => {
    const blockPicks = picks[blockIdx] ?? []
    for (const ab of blockPicks) {
      if (ab === ability) bonus += choice.amountPerPick
    }
  })

  return bonus
}

export function formatSpeciesAsiSummary(
  asi: SpeciesAsiBlock,
  picks?: Ability[][]
): string {
  const parts: string[] = []

  for (const ab of ABILITIES) {
    const amount = asi.fixed[ab]
    if (amount) {
      parts.push(
        amount > 0 ? `+${amount} ${ABILITY_NAMES[ab]}` : `${amount} ${ABILITY_NAMES[ab]}`
      )
    }
  }

  asi.choices.forEach((choice, blockIdx) => {
    const blockPicks = picks?.[blockIdx]
    if (blockPicks?.length === choice.count) {
      for (const ab of blockPicks) {
        const label =
          choice.amountPerPick > 1
            ? `+${choice.amountPerPick} ${ABILITY_NAMES[ab]}`
            : `+1 ${ABILITY_NAMES[ab]}`
        parts.push(label)
      }
    } else if (choice.count === 1 && choice.amountPerPick > 1) {
      parts.push(
        `+${choice.amountPerPick} to one of ${choice.from.map((a) => ABILITY_NAMES[a]).join(', ')}`
      )
    } else {
      parts.push(
        `+${choice.amountPerPick} to ${choice.count} of ${choice.from.map((a) => ABILITY_NAMES[a]).join(', ')}`
      )
    }
  })

  return parts.length ? parts.join(', ') : 'None'
}
