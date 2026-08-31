export interface SpellCastPreview {
  slotLevel: number
  description: string
  damageLine?: string
}

export function cleanSpellText(text: string): string {
  return text
    .replace(/\{@scaledamage\s([^|}]+)\|([^|}]+)\|([^}]+)\}/g, (_, base, _range, perLevel) => {
      return `${base} (+${perLevel} per slot above minimum)`
    })
    .replace(/\{@damage\s([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@dice\s([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+\s([^|}]+)(?:\|[^}]*)?\}/g, '$1')
}

export function getCantripDamageAtLevel(
  scalingLevelDice: unknown,
  characterLevel: number
): string | null {
  if (!scalingLevelDice || typeof scalingLevelDice !== 'object') return null

  const single = scalingLevelDice as { label?: string; scaling?: Record<string, string> }
  if (single.scaling) {
    const levels = Object.keys(single.scaling)
      .map(Number)
      .sort((a, b) => a - b)
    let dice = single.scaling[String(levels[0])]
    for (const lvl of levels) {
      if (characterLevel >= lvl) dice = single.scaling[String(lvl)]
    }
    return dice ? `${dice} ${single.label ?? 'damage'}` : null
  }

  if (Array.isArray(scalingLevelDice)) {
    return scalingLevelDice
      .map((entry) => {
        const e = entry as { label?: string; scaling?: Record<string, string> }
        const levels = Object.keys(e.scaling ?? {})
          .map(Number)
          .sort((a, b) => a - b)
        let dice = e.scaling?.[String(levels[0])]
        for (const lvl of levels) {
          if (characterLevel >= lvl) dice = e.scaling?.[String(lvl)]
        }
        return dice ? `${dice} ${e.label ?? ''}`.trim() : null
      })
      .filter(Boolean)
      .join('; ')
  }

  return null
}

function parseScaledamageTag(text: string, slotLevel: number, spellLevel: number): string | null {
  const match = text.match(/\{@scaledamage\s([^|}]+)\|([^|}]+)\|([^}]+)\}/)
  if (!match) return null
  const [, baseDice, rangePart, perSlot] = match
  const minSlot = Number.parseInt(rangePart.split('-')[0] ?? String(spellLevel), 10)
  const extra = Math.max(0, slotLevel - minSlot)
  if (extra === 0) return `${baseDice} (at ${ordinal(minSlot)}-level slot or higher)`
  return `${baseDice} + ${extra}${perSlot.replace(/^\d+/, '')} → ${scaleDiceString(baseDice, perSlot, extra)}`
}

function scaleDiceString(base: string, perSlot: string, times: number): string {
  const baseMatch = base.match(/(\d+)d(\d+)/)
  const perMatch = perSlot.match(/(\d+)d(\d+)/)
  if (!baseMatch || !perMatch) return base
  const totalCount = Number(baseMatch[1]) + Number(perMatch[1]) * times
  return `${totalCount}d${baseMatch[2]}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function getUpcastPreview(
  spell: Record<string, unknown>,
  slotLevel: number
): SpellCastPreview {
  const spellLevel = Number(spell.level ?? 0)
  const lines: string[] = []
  let damageLine: string | undefined

  if (spellLevel === 0) {
    const scaling = getCantripDamageAtLevel(spell.scalingLevelDice, slotLevel)
    return {
      slotLevel,
      description: scaling ? `Cantrip scales with character level: ${scaling}` : 'Cantrip — no slot required',
      damageLine: scaling ?? undefined
    }
  }

  if (slotLevel < spellLevel) {
    return {
      slotLevel,
      description: `Requires at least a ${ordinal(spellLevel)}-level slot.`
    }
  }

  if (slotLevel === spellLevel) {
    lines.push(`Cast at ${ordinal(spellLevel)} level (base).`)
  } else {
    lines.push(`Upcast: ${ordinal(spellLevel)}-level spell using a ${ordinal(slotLevel)}-level slot.`)
  }

  const higher = spell.entriesHigherLevel as Array<{ entries?: unknown[] }> | undefined
  if (higher?.length) {
    for (const block of higher) {
      for (const entry of block.entries ?? []) {
        if (typeof entry === 'string') {
          const cleaned = cleanSpellText(entry)
          lines.push(cleaned)
          const scaled = parseScaledamageTag(entry, slotLevel, spellLevel)
          if (scaled) damageLine = scaled
        }
      }
    }
  }

  return { slotLevel, description: lines.join(' '), damageLine }
}

export function availableSlotLevels(
  spellLevel: number,
  spellSlots: Record<number, { max: number; used: number }>
): number[] {
  if (spellLevel === 0) return [0]
  const levels: number[] = []
  for (let lvl = spellLevel; lvl <= 9; lvl++) {
    const slot = spellSlots[lvl]
    if (slot && slot.max - slot.used > 0) levels.push(lvl)
  }
  return levels
}
