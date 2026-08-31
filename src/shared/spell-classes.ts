/** Standard 5e class order for spell list filters. */
export const SPELL_CLASS_ORDER = [
  'Artificer',
  'Bard',
  'Cleric',
  'Druid',
  'Monk',
  'Paladin',
  'Ranger',
  'Sorcerer',
  'Warlock',
  'Wizard'
] as const

export type SpellClassName = (typeof SPELL_CLASS_ORDER)[number]

export interface SpellSourceLookupEntry {
  class?: Record<string, Record<string, boolean>>
  subclass?: Record<string, Record<string, Record<string, Record<string, { name?: string }>>>>
}

export function extractSpellClasses(entry: SpellSourceLookupEntry | undefined): string[] {
  if (!entry) return []

  const classes = new Set<string>()

  if (entry.class) {
    for (const byBook of Object.values(entry.class)) {
      for (const className of Object.keys(byBook)) classes.add(className)
    }
  }

  if (entry.subclass) {
    for (const byBook of Object.values(entry.subclass)) {
      for (const className of Object.keys(byBook)) classes.add(className)
    }
  }

  return sortSpellClasses([...classes])
}

export function sortSpellClasses(classes: string[]): string[] {
  return [...classes].sort((a, b) => {
    const ai = SPELL_CLASS_ORDER.indexOf(a as SpellClassName)
    const bi = SPELL_CLASS_ORDER.indexOf(b as SpellClassName)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export function spellMatchesClass(spellClasses: string[] | undefined, className: string): boolean {
  return spellClasses?.includes(className) ?? false
}
