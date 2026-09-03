import { requiresSubclassAtLevel } from '../../../shared/class-mechanics'
import type { CreatorEdition } from '../../../shared/origin-feat'
import { parseSpeciesAbility, speciesAsiHasChoices } from '../../../shared/species-asi'

/** Wizard step indices — keep in sync with CharacterCreatorPage STEPS. */
export const CREATOR_STEP = {
  CLASS: 0,
  SUBCLASS: 1,
  BACKGROUND: 2,
  ORIGIN_FEAT: 3,
  SPECIES: 4,
  SPECIES_ASI: 5,
  ABILITIES: 6,
  SKILLS: 7,
  ALIGNMENT: 8,
  EQUIPMENT: 9,
  SUMMARY: 10
} as const

export function subclassRequiredAtCreation(
  classDetail: Record<string, unknown> | null | undefined
): boolean {
  return classDetail ? requiresSubclassAtLevel(classDetail, 1) : false
}

export function speciesAsiStepRequired(
  edition: CreatorEdition,
  speciesDetail: Record<string, unknown> | null | undefined
): boolean {
  if (!speciesDetail) return false
  return speciesAsiHasChoices(parseSpeciesAbility(speciesDetail))
}

function skippedSteps(
  classDetail: Record<string, unknown> | null | undefined,
  speciesAsiRequired: boolean
): Set<number> {
  const skip = new Set<number>()
  if (!subclassRequiredAtCreation(classDetail)) skip.add(CREATOR_STEP.SUBCLASS)
  if (!speciesAsiRequired) skip.add(CREATOR_STEP.SPECIES_ASI)
  return skip
}

export function navigateCreatorStep(
  step: number,
  direction: 1 | -1,
  classDetail: Record<string, unknown> | null | undefined,
  speciesAsiRequired: boolean
): number {
  const skip = skippedSteps(classDetail, speciesAsiRequired)
  let next = step + direction
  while (skip.has(next) && next >= CREATOR_STEP.CLASS && next <= CREATOR_STEP.SUMMARY) {
    next += direction
  }
  return Math.max(CREATOR_STEP.CLASS, Math.min(CREATOR_STEP.SUMMARY, next))
}

export function isCreatorStepSkipped(
  stepIndex: number,
  classDetail: Record<string, unknown> | null | undefined,
  speciesAsiRequired: boolean
): boolean {
  return skippedSteps(classDetail, speciesAsiRequired).has(stepIndex)
}
