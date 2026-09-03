import { normalizeSkillKey } from './character'

export interface ProficiencyChoiceGroup {
  from: string[]
  count: number
}

function normalizeProficiencyKey(key: string): string {
  return key.replace(/\|.*$/, '').replace(/;.*$/, '').trim()
}

/** Fixed proficiencies plus optional choose blocks from 5etools proficiency arrays. */
export function parseProficiencyBlocks(list: unknown): {
  fixed: string[]
  choices: ProficiencyChoiceGroup[]
} {
  const fixed: string[] = []
  const choices: ProficiencyChoiceGroup[] = []

  if (!Array.isArray(list)) return { fixed, choices }

  for (const block of list) {
    if (!block || typeof block !== 'object') continue
    const record = block as Record<string, unknown>

    const choose = record.choose as { from?: string[]; count?: number } | undefined
    if (choose?.from?.length && choose.count) {
      choices.push({
        from: choose.from.map(normalizeProficiencyKey),
        count: choose.count
      })
      continue
    }

    for (const key of Object.keys(record)) {
      if (key === 'choose') continue
      if (record[key] === true) {
        fixed.push(normalizeProficiencyKey(key))
      }
    }
  }

  return { fixed, choices }
}

export function resolveProficiencyChoices(
  fixed: string[],
  choices: ProficiencyChoiceGroup[],
  picks: string[][]
): string[] {
  const result = [...fixed]
  choices.forEach((group, idx) => {
    const groupPicks = picks[idx] ?? []
    for (const pick of groupPicks) {
      if (!result.some((s) => normalizeSkillKey(s) === normalizeSkillKey(pick))) {
        result.push(pick)
      }
    }
  })
  return result
}

export function validateProficiencyChoices(
  choices: ProficiencyChoiceGroup[],
  picks: string[][]
): boolean {
  if (choices.length !== picks.length) return false
  for (let i = 0; i < choices.length; i++) {
    const group = choices[i]!
    const groupPicks = picks[i] ?? []
    if (groupPicks.length !== group.count) return false
    const seen = new Set<string>()
    for (const pick of groupPicks) {
      const key = normalizeSkillKey(pick)
      if (!group.from.some((s) => normalizeSkillKey(s) === key)) return false
      if (seen.has(key)) return false
      seen.add(key)
    }
  }
  return true
}

export function emptyProficiencyPicks(choices: ProficiencyChoiceGroup[]): string[][] {
  return choices.map(() => [])
}
