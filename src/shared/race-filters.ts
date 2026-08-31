import type { CompendiumEntry } from './types'

export function isNpcRace(raw: {
  isNPCRace?: boolean
  traitTags?: string[] | unknown
}): boolean {
  if (raw.isNPCRace === true) return true
  const tags = raw.traitTags
  if (!Array.isArray(tags)) return false
  return tags.some((tag) => String(tag) === 'NPC Race')
}

/** Player-facing species/races suitable for character creation (excludes NPC-only options). */
export function isPlayableSpecies(entry: CompendiumEntry): boolean {
  return !entry.npcRace
}
