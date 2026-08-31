import type { CreatorEdition } from './origin-feat'

/** Source books available in the character creator */
export interface CreatorSourceBook {
  id: string
  label: string
  sources: string[]
  provides: ('class' | 'race' | 'background' | 'spells')[]
  /** Which rules edition this book belongs to. `both` = species only, usable with either edition. */
  edition: CreatorEdition | 'both'
}

/** Classic & supplemental species sources (MPMM, VGM, setting variants, etc.). */
export const LEGACY_SPECIES_SOURCES = [
  'PHB',
  'DMG',
  'VGM',
  'MPMM',
  'EEPC',
  'ERLW',
  'GGR',
  'MOT',
  'AAG',
  'VRGR',
  'FTD',
  'WBtW',
  'TCE',
  'MTF',
  'PSK',
  'PSA',
  'PSZ',
  'PSX',
  'PSD',
  'AI',
  'OGA',
  'AWM',
  'DSotDQ',
  'LR',
  'TTP',
  'EGW',
  'SCC',
  'PSI',
  'SCAG'
] as const

/** Individual supplemental spell source books — toggled separately in the creator. */
export const SPELL_SUPPLEMENT_BOOKS: CreatorSourceBook[] = [
  {
    id: 'xge',
    label: "Xanathar's Guide to Everything",
    sources: ['XGE'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'tce-spells',
    label: "Tasha's Cauldron of Everything",
    sources: ['TCE'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'scag-spells',
    label: "Sword Coast Adventurer's Guide",
    sources: ['SCAG'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'ftd',
    label: "Fizban's Treasury of Dragons",
    sources: ['FTD'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'scc-spells',
    label: 'Strixhaven: A Curriculum of Chaos',
    sources: ['SCC'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'aag-spells',
    label: "Astral Adventurer's Guide",
    sources: ['AAG'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'ggr-spells',
    label: "Guildmasters' Guide to Ravnica",
    sources: ['GGR'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'mot-spells',
    label: 'Mythic Odysseys of Theros',
    sources: ['MOT'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'egw-spells',
    label: "Explorer's Guide to Wildemount",
    sources: ['EGW'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'wbtw-spells',
    label: 'The Wild Beyond the Witchlight',
    sources: ['WBtW'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'ai-spells',
    label: 'Acquisitions Incorporated',
    sources: ['AI'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'tdcsr',
    label: "Tal'Dorei Campaign Setting Revisited",
    sources: ['TDCSR'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'bmt',
    label: 'Bigby Presents: Glory of the Giants',
    sources: ['BMT'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'sato',
    label: 'Planescape: Adventures in the Multiverse',
    sources: ['SATO'],
    provides: ['spells'],
    edition: 'both'
  },
  {
    id: 'llk',
    label: 'Lost Laboratory of Kwalish',
    sources: ['LLK'],
    provides: ['spells'],
    edition: 'both'
  }
]

/** Maps retired bundled book ids to their replacement individual book ids. */
const DEPRECATED_BOOK_ALIASES: Record<string, string[]> = {
  'spell-supplements': SPELL_SUPPLEMENT_BOOKS.map((book) => book.id)
}

export const CREATOR_SOURCE_BOOKS: CreatorSourceBook[] = [
  {
    id: 'xphb',
    label: "Player's Handbook (2024)",
    sources: ['XPHB'],
    provides: ['class', 'race', 'background'],
    edition: '2024'
  },
  {
    id: 'phb2014',
    label: "Player's Handbook (2014)",
    sources: ['PHB'],
    provides: ['class', 'race', 'background'],
    edition: '2014'
  },
  {
    id: 'legacy-species',
    label: 'Legacy & Supplemental Species',
    sources: [...LEGACY_SPECIES_SOURCES],
    provides: ['race'],
    edition: 'both'
  },
  {
    id: 'mpmm',
    label: 'Monsters of the Multiverse (MPMM)',
    sources: ['MPMM'],
    provides: ['race'],
    edition: 'both'
  },
  {
    id: 'vgm',
    label: "Volo's Guide to Monsters",
    sources: ['VGM'],
    provides: ['race'],
    edition: 'both'
  },
  {
    id: 'erlw',
    label: 'Eberron: Rising from the Last War',
    sources: ['ERLW'],
    provides: ['race'],
    edition: 'both'
  },
  {
    id: 'eepc',
    label: 'Elemental Evil Player\'s Companion',
    sources: ['EEPC'],
    provides: ['race'],
    edition: 'both'
  },
  {
    id: 'efa',
    label: 'Eberron: Forge of the Artificer',
    sources: ['EFA'],
    provides: ['class', 'race', 'background'],
    edition: '2024'
  },
  {
    id: 'frhof',
    label: 'Forgotten Realms: Heroes of Faerûn',
    sources: ['FRHoF'],
    provides: ['background'],
    edition: '2024'
  },
  {
    id: 'rhw',
    label: 'Ravenloft: The Horrors Within',
    sources: ['RHW'],
    provides: ['race', 'background'],
    edition: '2024'
  },
  {
    id: 'abh',
    label: "Astarion's Book of Hungers",
    sources: ['ABH'],
    provides: ['background'],
    edition: '2024'
  },
  {
    id: 'lfl',
    label: 'Lorwyn: First Light',
    sources: ['LFL'],
    provides: ['race', 'background'],
    edition: '2024'
  },
  ...SPELL_SUPPLEMENT_BOOKS
]

export function booksForEdition(edition: CreatorEdition): CreatorSourceBook[] {
  return CREATOR_SOURCE_BOOKS.filter((b) => b.edition === edition || b.edition === 'both')
}

/** Expand legacy bundled source book ids (e.g. spell-supplements) into individual books. */
export function normalizeEnabledBookIds(bookIds: string[]): string[] {
  const result = new Set<string>()
  for (const id of bookIds) {
    const aliases = DEPRECATED_BOOK_ALIASES[id]
    if (aliases) {
      for (const alias of aliases) result.add(alias)
    } else {
      result.add(id)
    }
  }
  return [...result]
}

/** New characters start with every source for the chosen edition enabled. */
export function defaultBooksForEdition(edition: CreatorEdition): string[] {
  return booksForEdition(edition).map((b) => b.id)
}

export function enabledSourceCodes(enabledBookIds: string[]): string[] {
  const codes = new Set<string>()
  for (const book of CREATOR_SOURCE_BOOKS) {
    if (enabledBookIds.includes(book.id)) {
      for (const source of book.sources) codes.add(source)
    }
  }
  return [...codes]
}

export function bookProvides(
  bookId: string,
  type: 'class' | 'race' | 'background' | 'spells'
): boolean {
  return CREATOR_SOURCE_BOOKS.find((b) => b.id === bookId)?.provides.includes(type) ?? false
}
