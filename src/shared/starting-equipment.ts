export interface InventoryItem {
  label: string
  quantity: number
}

export interface EquipmentLineItem extends InventoryItem {
  goldCp?: number
  equipmentType?: string
}

export interface EquipmentOption {
  id: string
  label: string
  items: EquipmentLineItem[]
}

export interface EquipmentChoiceGroup {
  id: string
  prompt: string
  type: 'single' | 'filter'
  options?: EquipmentOption[]
  pickCount?: number
  filterType?: string
  filterOptions?: string[]
  /** When set, this choice only applies if the given package option was selected. */
  requiresOptionId?: string
}

export interface StartingEquipmentPlan {
  source: 'class' | 'background'
  title: string
  narrative: string[]
  groups: EquipmentChoiceGroup[]
  fixed: EquipmentLineItem[]
}

export interface StartingInventory {
  items: InventoryItem[]
  goldCp: number
}

export type EquipmentSelections = Record<string, string>
export type EquipmentFilterPicks = Record<string, string[]>

const EQUIPMENT_TYPE_OPTIONS: Record<string, string[]> = {
  weaponSimple: [
    'Club',
    'Dagger',
    'Greatclub',
    'Handaxe',
    'Javelin',
    'Light Hammer',
    'Mace',
    'Quarterstaff',
    'Sickle',
    'Spear',
    'Dart',
    'Light Crossbow',
    'Shortbow',
    'Sling'
  ],
  weaponSimpleMelee: [
    'Club',
    'Dagger',
    'Greatclub',
    'Handaxe',
    'Javelin',
    'Light Hammer',
    'Mace',
    'Quarterstaff',
    'Sickle',
    'Spear'
  ],
  weaponMartial: [
    'Battleaxe',
    'Flail',
    'Glaive',
    'Greataxe',
    'Greatsword',
    'Halberd',
    'Lance',
    'Longsword',
    'Maul',
    'Morningstar',
    'Pike',
    'Rapier',
    'Scimitar',
    'Shortsword',
    'Trident',
    'War Pick',
    'Warhammer',
    'Whip',
    'Blowgun',
    'Hand Crossbow',
    'Heavy Crossbow',
    'Longbow',
    'Net'
  ],
  weaponMartialMelee: [
    'Battleaxe',
    'Flail',
    'Glaive',
    'Greataxe',
    'Greatsword',
    'Halberd',
    'Lance',
    'Longsword',
    'Maul',
    'Morningstar',
    'Pike',
    'Rapier',
    'Scimitar',
    'Shortsword',
    'Trident',
    'War Pick',
    'Warhammer',
    'Whip'
  ],
  instrumentMusical: [
    'Bagpipes',
    'Drum',
    'Dulcimer',
    'Flute',
    'Lute',
    'Lyre',
    'Horn',
    'Pan Flute',
    'Shawm',
    'Viol'
  ],
  focusSpellcastingHoly: ['Amulet', 'Emblem', 'Reliquary'],
  focusSpellcastingArcane: ['Crystal', 'Orb', 'Rod', 'Staff', 'Wand'],
  focusSpellcastingDruidic: ['Sprig of Mistletoe', 'Totem', 'Wooden Staff', 'Yew Wand'],
  setGaming: ['Dragonchess Set', 'Playing Card Set', 'Three-Dragon Ante Set'],
  toolArtisan: [
    "Alchemist's Supplies",
    "Brewer's Supplies",
    "Calligrapher's Supplies",
    "Carpenter's Tools",
    "Cartographer's Tools",
    "Cobbler's Tools",
    "Cook's Utensils",
    "Glassblower's Tools",
    "Jeweler's Tools",
    "Leatherworker's Tools",
    "Mason's Tools",
    "Painter's Supplies",
    "Potter's Tools",
    "Smith's Tools",
    "Tinker's Tools",
    "Weaver's Tools",
    "Woodcarver's Tools"
  ]
}

function titleCase(text: string): string {
  return text
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function cleanTags(text: string): string {
  return text.replace(/\{@\w+\s([^|}]+)(?:\|[^}]*)?\}/g, '$1').trim()
}

function formatGoldCp(cp: number): string {
  const gp = cp / 100
  return Number.isInteger(gp) ? `${gp} GP` : `${gp.toFixed(2).replace(/\.?0+$/, '')} GP`
}

function formatEquipmentTypeLabel(type: string, quantity: number): string {
  const labels: Record<string, string> = {
    weaponSimple: 'simple weapon',
    weaponSimpleMelee: 'simple melee weapon',
    weaponMartial: 'martial weapon',
    weaponMartialMelee: 'martial melee weapon',
    instrumentMusical: 'musical instrument',
    focusSpellcastingHoly: 'holy symbol',
    focusSpellcastingArcane: 'arcane focus',
    focusSpellcastingDruidic: 'druidic focus',
    setGaming: 'gaming set',
    toolArtisan: "artisan's tools"
  }
  const base = labels[type] ?? type.replace(/([A-Z])/g, ' $1').trim().toLowerCase()
  return quantity > 1 ? `${quantity} ${base}s` : `1 ${base}`
}

function parseLineItem(raw: unknown): EquipmentLineItem | null {
  if (typeof raw === 'string') {
    const name = raw.split('|')[0]?.trim()
    if (!name) return null
    return { label: titleCase(name), quantity: 1 }
  }
  if (!raw || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>
  if (obj.item) {
    const name = String(obj.item).split('|')[0]?.trim()
    if (!name) return null
    const displayName = typeof obj.displayName === 'string' ? obj.displayName : null
    const item: EquipmentLineItem = {
      label: titleCase(displayName ?? name),
      quantity: Number(obj.quantity ?? 1)
    }
    if (obj.containsValue != null) {
      item.goldCp = Number(obj.containsValue)
    }
    return item
  }
  if (obj.special) {
    return { label: String(obj.special), quantity: 1 }
  }
  if (obj.value != null) {
    const cp = Number(obj.value)
    return { label: formatGoldCp(cp), quantity: 1, goldCp: cp }
  }
  if (obj.equipmentType) {
    const type = String(obj.equipmentType)
    const quantity = Number(obj.quantity ?? 1)
    return {
      label: formatEquipmentTypeLabel(type, quantity),
      quantity,
      equipmentType: type
    }
  }
  return null
}

function parseOptionItems(list: unknown): EquipmentLineItem[] {
  if (!Array.isArray(list)) return []
  return list.map(parseLineItem).filter((item): item is EquipmentLineItem => item != null)
}

function buildOption(optionId: string, label: string, items: EquipmentLineItem[]): {
  option: EquipmentOption
  extraGroups: EquipmentChoiceGroup[]
} {
  const cleanItems: EquipmentLineItem[] = []
  const extraGroups: EquipmentChoiceGroup[] = []

  for (const item of items) {
    if (item.equipmentType) {
      extraGroups.push({
        id: `${optionId}-${item.equipmentType}`,
        prompt: `Choose ${item.label.toLowerCase()}`,
        type: 'filter',
        pickCount: item.quantity,
        filterType: item.equipmentType,
        filterOptions: EQUIPMENT_TYPE_OPTIONS[item.equipmentType] ?? [],
        requiresOptionId: optionId
      })
    } else {
      cleanItems.push(item)
    }
  }

  return {
    option: { id: optionId, label, items: cleanItems },
    extraGroups
  }
}

function parseEquipmentBlock(block: Record<string, unknown>, prefix: string): EquipmentChoiceGroup[] {
  const keys = Object.keys(block)
  const groups: EquipmentChoiceGroup[] = []

  if (keys.length === 1 && keys[0] === '_') {
    const items = parseOptionItems(block._)
    const filterItem = items.find((item) => item.equipmentType)
    if (filterItem?.equipmentType) {
      groups.push({
        id: `${prefix}-filter`,
        prompt: `Choose ${filterItem.label}`,
        type: 'filter',
        pickCount: filterItem.quantity,
        filterType: filterItem.equipmentType,
        filterOptions: EQUIPMENT_TYPE_OPTIONS[filterItem.equipmentType] ?? []
      })
    } else if (items.some((item) => item.equipmentType)) {
      for (const item of items.filter((entry) => entry.equipmentType)) {
        groups.push({
          id: `${prefix}-filter-${item.equipmentType}`,
          prompt: `Choose ${item.label}`,
          type: 'filter',
          pickCount: item.quantity,
          filterType: item.equipmentType,
          filterOptions: EQUIPMENT_TYPE_OPTIONS[item.equipmentType] ?? []
        })
      }
    } else {
      groups.push({
        id: `${prefix}-fixed`,
        prompt: 'Included equipment',
        type: 'single',
        options: [{ id: `${prefix}-fixed`, label: 'Standard kit', items }]
      })
    }
    return groups
  }

  const optionKeys = keys.filter((key) => key !== '_')
  if (optionKeys.length > 1 || (optionKeys.length === 1 && optionKeys[0] !== '_')) {
    const options: EquipmentOption[] = []
    const nestedGroups: EquipmentChoiceGroup[] = []

    for (const key of optionKeys) {
      const items = parseOptionItems(block[key])
      const gold = items.reduce((sum, item) => sum + (item.goldCp ?? 0), 0)
      const optionId = `${prefix}-${key.toLowerCase()}`
      const label =
        items.every((item) => item.goldCp) && gold > 0
          ? `Option ${key.toUpperCase()} — ${formatGoldCp(gold)}`
          : `Option ${key.toUpperCase()}`
      const built = buildOption(optionId, label, items)
      options.push(built.option)
      nestedGroups.push(...built.extraGroups)
    }

    groups.push({
      id: prefix,
      prompt:
        optionKeys.every((key) => /^[A-C]$/.test(key))
          ? `Choose ${optionKeys.join(', ')}`
          : 'Choose one option',
      type: 'single',
      options
    })
    groups.push(...nestedGroups)
    return groups
  }

  return groups
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function normalizeEquipmentBlocks(raw: unknown): {
  narrative: string[]
  blocks: Record<string, unknown>[]
} {
  if (!raw) return { narrative: [], blocks: [] }

  if (Array.isArray(raw)) {
    return {
      narrative: [],
      blocks: raw.filter(
        (block): block is Record<string, unknown> => Boolean(block && typeof block === 'object')
      )
    }
  }

  if (typeof raw !== 'object') return { narrative: [], blocks: [] }

  const eq = raw as Record<string, unknown>
  const narrative = normalizeStringList(eq.entries ?? eq.default).map(cleanTags)
  const blocks = Array.isArray(eq.defaultData)
    ? (eq.defaultData as Record<string, unknown>[])
    : []

  return { narrative, blocks }
}

export function parseStartingEquipment(
  detail: Record<string, unknown> | null,
  source: 'class' | 'background',
  title: string
): StartingEquipmentPlan {
  if (!detail) {
    return { source, title, narrative: [], groups: [], fixed: [] }
  }

  const { narrative, blocks } = normalizeEquipmentBlocks(detail.startingEquipment)
  const groups: EquipmentChoiceGroup[] = []
  const fixed: EquipmentLineItem[] = []

  blocks.forEach((block, index) => {
    const parsed = parseEquipmentBlock(block, `${source}-${index}`)
    for (const group of parsed) {
      if (group.type === 'single' && group.options?.length === 1 && group.id.endsWith('-fixed')) {
        fixed.push(...(group.options[0]?.items ?? []))
      } else {
        groups.push(group)
      }
    }
  })

  return { source, title, narrative, groups, fixed }
}

export function equipmentPlanRequiresChoices(plan: StartingEquipmentPlan): boolean {
  return plan.groups.some((group) => {
    if (group.type === 'filter') return (group.filterOptions?.length ?? 0) > 0
    return (group.options?.length ?? 0) > 1
  })
}

function groupIsActive(group: EquipmentChoiceGroup, selections: EquipmentSelections): boolean {
  if (!group.requiresOptionId) return true
  return Object.values(selections).includes(group.requiresOptionId)
}

export function isEquipmentPlanComplete(
  plan: StartingEquipmentPlan,
  selections: EquipmentSelections,
  filterPicks: EquipmentFilterPicks
): boolean {
  for (const group of plan.groups) {
    if (!groupIsActive(group, selections)) continue

    if (group.type === 'single') {
      const optionCount = group.options?.length ?? 0
      if (optionCount <= 1) continue
      if (!selections[group.id]) return false
      continue
    }
    const needed = group.pickCount ?? 1
    const picks = filterPicks[group.id] ?? []
    if (picks.length !== needed) return false
  }
  return true
}

function flattenOptionItems(items: EquipmentLineItem[]): { items: InventoryItem[]; goldCp: number } {
  const result: InventoryItem[] = []
  let goldCp = 0
  for (const item of items) {
    if (item.goldCp) {
      goldCp += item.goldCp
      continue
    }
    if (item.equipmentType) continue
    result.push({ label: item.label, quantity: item.quantity })
  }
  return { items: result, goldCp }
}

export function resolveStartingInventory(
  plans: StartingEquipmentPlan[],
  selections: EquipmentSelections,
  filterPicks: EquipmentFilterPicks
): StartingInventory {
  const items: InventoryItem[] = []
  let goldCp = 0

  const pushItems = (next: InventoryItem[]) => {
    for (const item of next) {
      const existing = items.find((entry) => entry.label === item.label)
      if (existing) existing.quantity += item.quantity
      else items.push({ ...item })
    }
  }

  for (const plan of plans) {
    const fixed = flattenOptionItems(plan.fixed)
    pushItems(fixed.items)
    goldCp += fixed.goldCp

    for (const group of plan.groups) {
      if (!groupIsActive(group, selections)) continue

      if (group.type === 'single') {
        const optionCount = group.options?.length ?? 0
        if (optionCount <= 1) {
          const only = group.options?.[0]
          if (only) {
            const resolved = flattenOptionItems(only.items)
            pushItems(resolved.items)
            goldCp += resolved.goldCp
          }
          continue
        }
        const selected = group.options?.find((option) => option.id === selections[group.id])
        if (!selected) continue
        const resolved = flattenOptionItems(selected.items)
        pushItems(resolved.items)
        goldCp += resolved.goldCp
        continue
      }

      const picks = filterPicks[group.id] ?? []
      for (const label of picks) {
        pushItems([{ label, quantity: 1 }])
      }
    }
  }

  return { items, goldCp }
}

export function formatInventoryGold(goldCp: number): string {
  return formatGoldCp(goldCp)
}
