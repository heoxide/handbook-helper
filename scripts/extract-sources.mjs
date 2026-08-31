import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const parserUrl = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/js/parser.js'
const res = await fetch(parserUrl, { headers: { 'User-Agent': 'Handbook-Helper/1.0' } })
const raw = await res.text()

/** @type {Record<string, string>} */
const parserVars = {}
for (const m of raw.matchAll(/Parser\.(\w+)\s*=\s*"([^"]+)"/g)) {
  parserVars[m[1]] = m[2].replace(/\\u2019/g, "'")
}

/** @type {Record<string, string>} */
const SRC_CONST = {}
for (const m of raw.matchAll(/Parser\.SRC_(\w+)\s*=\s*"([^"]+)"/g)) {
  SRC_CONST[m[1]] = m[2]
}
for (const m of raw.matchAll(/Parser\.SRC_(\w+)\s*=\s*`([^`]+)`/g)) {
  SRC_CONST[m[1]] = evalTemplate(m[2], parserVars)
}

function evalTemplate(template, vars) {
  return template.replace(/\$\{Parser\.(\w+)\}/g, (_, name) => vars[name] ?? '')
}

function evalRhs(rhs, vars) {
  rhs = rhs.trim()
  const strMatch = rhs.match(/^"([^"]*)"$/)
  if (strMatch) return strMatch[1].replace(/\\u2019/g, "'")
  const tplMatch = rhs.match(/^`([^`]*)`$/)
  if (tplMatch) return evalTemplate(tplMatch[1], vars)
  const varMatch = rhs.match(/^Parser\.(\w+)$/)
  if (varMatch) return vars[varMatch[1]] ?? null
  return null
}

/** @type {Record<string, string>} */
const full = {}
for (const m of raw.matchAll(
  /Parser\.SOURCE_JSON_TO_FULL\[Parser\.SRC_(\w+)\]\s*=\s*(.+?);/g
)) {
  const code = SRC_CONST[m[1]]
  const value = evalRhs(m[2], parserVars)
  if (code && value) full[code] = value
}

/** @type {Record<string, string>} */
const abv = {}
for (const m of raw.matchAll(
  /Parser\.SOURCE_JSON_TO_ABV\[Parser\.SRC_(\w+)\]\s*=\s*(.+?);/g
)) {
  const code = SRC_CONST[m[1]]
  const value = evalRhs(m[2], parserVars)
  if (code && value) abv[code] = value
}

// Manual supplements for sources not in parser maps (homebrew markers, UA, etc.)
const manualFull = {
  Generic: 'Generic',
  PSA: 'Plane Shift: Amonkhet',
  PSD: 'Plane Shift: Dominaria',
  PSI: 'Plane Shift: Innistrad',
  PSK: 'Plane Shift: Kaladesh',
  PSX: 'Plane Shift: Ixalan',
  PSZ: 'Plane Shift: Zendikar',
  UATheMysticClass: 'Unearthed Arcana: The Mystic Class',
  MCV1SC: 'Monstrous Compendium Volume 1: Spelljammer Creatures',
  MCV2DC: 'Monstrous Compendium Volume 2: Dragonlance Creatures',
  MCV3MC: 'Monstrous Compendium Volume 3: Minecraft Creatures',
  MCV4EC: 'Monstrous Compendium Volume 4: Eldraine Creatures',
  MisMV1: 'Misplaced Monsters: Volume 1',
  AATM: "Adventure Atlas: The Mortuary",
  XMtS: 'X Marks the Spot',
  XScreenRHW: "Dungeon Master's Screen; Ravenloft: The Horrors Within"
}

const manualAbv = {
  Generic: 'Generic',
  PSA: 'PSA',
  PSD: 'PSD',
  PSI: 'PSI',
  PSK: 'PSK',
  PSX: 'PSX',
  PSZ: 'PSZ',
  UATheMysticClass: 'UA',
  MCV1SC: 'MCV1SC',
  MCV2DC: 'MCV2DC',
  MCV3MC: 'MCV3MC',
  MCV4EC: 'MCV4EC',
  MisMV1: 'MisMV1',
  AATM: 'AATM'
}

const mergedFull = { ...manualFull, ...full }
const mergedAbv = { ...manualAbv, ...abv }

console.log('Parsed full names:', Object.keys(mergedFull).length)
console.log('Parsed abbreviations:', Object.keys(mergedAbv).length)

writeFileSync(
  join(root, 'src/shared/generated-source-map.json'),
  JSON.stringify({ full: mergedFull, abv: mergedAbv }, null, 2)
)
console.log('Wrote src/shared/generated-source-map.json')
