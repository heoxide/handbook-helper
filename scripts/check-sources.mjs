import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const generated = JSON.parse(
  readFileSync(join(__dirname, '../src/shared/generated-source-map.json'), 'utf8')
)

const dataDir = join(process.env.APPDATA || '', 'handbook-helper', '5etools-data')

const screenshot = [
  'A Copper for a Song',
  'A Reckoning in Ruins',
  'Acquisitions Incorporated',
  "Astral Adventurer's Guide",
  "Baker's Doesn't",
  "Baldur's Gate: Descent Into Avernus",
  'Before the Storm',
  'Campus Kerfuffle',
  'Candlekeep Mysteries',
  'Critical Role: Call of the Netherdeep',
  'Curse of Strahd',
  'Dangerous Designs',
  'Death at Sunset',
  'Descent into the Lost Caverns of Tsojcanth',
  'Divine Contention',
  'Dragon of Icespire Peak',
  'Dragonlance: Shadow of the Dragon Queen',
  'Dragons of Stormwreck Isle',
  'Dragons of the Sandstone City',
  'Dungeons & Dragons vs. Rick and Morty: Basic Rules',
  'Eberron: Forge of the Artificer',
  'Eberron: Forgotten Relics',
  'Eberron: Rising from the Last War',
  "Elemental Evil Player's Companion",
  "Explorer's Guide to Wildemount",
  'Fated Flight of the Recluse',
  "Fizban's Treasury of Dragons",
  'For Whom the Void Calls',
  'Forgotten Realms: Adventures in Faerûn',
  'Forgotten Realms: Heroes of Faerûn',
  'Frozen Sick',
  'Ghosts of Saltmarsh',
  "Guildmasters' Guide to Ravnica",
  'Heroes of the Borderlands',
  'Hoard of the Dragon Queen',
  'Hunt for Mage Tower',
  'Icewind Dale: Rime of the Frostmaiden',
  'Journeys through the Radiant Citadel',
  'Keys from the Golden Vault',
  "Krenko's Way",
  'Light of Xaryxis',
  'Lost Mine of Phandelver',
  'Mythic Odysseys of Theros',
  'Out of the Abyss',
  'Phandelver and Below: The Shattered Obelisk',
  "Player's Handbook (2014)",
  "Player's Handbook (2024)",
  'Princes of the Apocalypse',
  'Quests from the Infinite Staircase',
  "Red Dragon's Tale: A LEGO Adventure",
  'Shivering Death',
  'Sigil and the Outlands',
  "Sleeping Dragon's Wake",
  "Storm King's Thunder",
  "Storm Lord's Wrath",
  'Strixhaven: A Curriculum of Chaos',
  "Sword Coast Adventurer's Guide",
  'Tales from the Yawning Portal: Against the Giants',
  'Tales from the Yawning Portal: Dead in Thay',
  'Tales from the Yawning Portal: The Forge of Fury',
  'Tales from the Yawning Portal: The Hidden Shrine of Tamoachan',
  'Tales from the Yawning Portal: The Sunless Citadel',
  'Tales from the Yawning Portal: Tomb of Horrors',
  'Tales from the Yawning Portal: White Plume Mountain',
  "Tasha's Cauldron of Everything",
  'The Book of Many Things',
  'The Dragon of Najkir',
  'The Forbidden Vale',
  'The House of Lament',
  'The Lost Dungeon of Rickedness: Big Rick Energy',
  "The Magister's Masquerade",
  'The Orrery of the Wanderer',
  'The Rise of Tiamat',
  'The Wild Beyond the Witchlight',
  'The Will of Orcus',
  'Tide of Retribution',
  'Tomb of Annihilation',
  "Turn of Fortune's Wheel",
  'Unwelcome Spirits',
  'Vecna: Eve of Ruin',
  'Vecna: Nest of the Eldritch Eye',
  "Volo's Guide to Monsters",
  'Waterdeep: Dragon Heist',
  'Waterdeep: Dungeon of the Mad Mage',
  "Xanathar's Guide to Everything"
]

const map = new Map(Object.entries(generated.full))
const catalog = new Set(Object.keys(generated.full))

function resolveName(code) {
  return generated.full[code] ?? map.get(code) ?? code
}

if (existsSync(join(dataDir, 'books.json'))) {
  const books = JSON.parse(readFileSync(join(dataDir, 'books.json'), 'utf8'))
  for (const b of books.book ?? []) {
    const code = b.source ?? b.id
    if (code) {
      catalog.add(code)
      if (!generated.full[code]) map.set(code, b.name)
    }
    if (b.id) {
      catalog.add(b.id)
      if (!generated.full[b.id]) map.set(b.id, b.name)
    }
  }
}

if (existsSync(join(dataDir, 'adventures.json'))) {
  const adv = JSON.parse(readFileSync(join(dataDir, 'adventures.json'), 'utf8'))
  for (const a of adv.adventure ?? []) {
    for (const code of [a.id, a.source].filter(Boolean)) {
      catalog.add(code)
      if (a.id === code && a.name && !generated.full[code]) map.set(code, a.name)
      else if (code === a.source && code !== a.id && !map.has(code) && !generated.full[code]) {
        map.set(code, a.name ?? code)
      }
    }
    for (const c of a.contents ?? []) {
      if (c.source) {
        catalog.add(c.source)
        if (!generated.full[c.source]) map.set(c.source, c.name ?? c.source)
      }
    }
  }
}

const names = [...catalog].map((c) => resolveName(c)).sort((a, b) => a.localeCompare(b))
const nameSet = new Set(names)

console.log('Catalog count:', names.length)
console.log('Screenshot count:', screenshot.length)

const missing = screenshot.filter((s) => !nameSet.has(s))
console.log('\nMissing from catalog (' + missing.length + '):')
missing.forEach((m) => console.log('  -', m))

const notInScreenshot = names.filter((n) => !screenshot.includes(n))
console.log('\nIn catalog but not in screenshot (' + notInScreenshot.length + '):')
notInScreenshot.slice(0, 30).forEach((n) => console.log('  +', n))
if (notInScreenshot.length > 30) console.log('  ... and', notInScreenshot.length - 30, 'more')
