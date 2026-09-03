const DRAFT_STORAGE_KEY = 'handbook-creator-draft'

export interface SerializableCreatorDraft {
  name: string
  classEntry: { id: string; name: string; source: string } | null
  subclassEntry: { name: string; source: string } | null
  backgroundEntry: { id: string; name: string; source: string } | null
  speciesEntry: { id: string; name: string; source: string } | null
  scoreMethod: string
  baseScores: Record<string, number>
  rolledPool: number[]
  rollAssign: Record<string, number | null>
  boostMode: string
  boostPlusTwo: string | null
  boostPlusOne: string | null
  classSkills: string[]
  expertiseSkills: string[]
  backgroundSkillPicks: string[][]
  speciesSkillPicks: string[][]
  speciesLanguagePicks: string[]
  alignment: string | null
  originFeatSelections: unknown[]
  equipmentSelections: Record<string, unknown>
  equipmentFilterPicks: Record<string, unknown>
  speciesAsiPicks: string[][]
  step: number
  creatorEdition: string
  enabledBooks: string[]
  savedId: string | null
}

export function saveCreatorDraft(data: SerializableCreatorDraft): void {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota exceeded — ignore
  }
}

export function loadCreatorDraft(): SerializableCreatorDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SerializableCreatorDraft
  } catch {
    return null
  }
}

export function clearCreatorDraft(): void {
  sessionStorage.removeItem(DRAFT_STORAGE_KEY)
}
