export const SHEET_PANEL_IDS = [
  'combat',
  'spells',
  'inventory',
  'features',
  'abilities',
  'optional'
] as const

export type SheetPanelId = (typeof SHEET_PANEL_IDS)[number]

/** Board width in resizable units. Panel widths and positions are spans of these columns. */
export const BOARD_COLUMNS = 12

/** Half the board: the medium starting size for every panel. */
export const DEFAULT_PANEL_W = 6
export const MIN_PANEL_W = 3

export const MIN_PANEL_HEIGHT = 140
export const MAX_PANEL_HEIGHT = 1400

/** Used while a content-sized panel has not been measured yet. */
export const FALLBACK_PANEL_HEIGHT = 220

export const PANEL_GAP = 14

/** Vertical positions snap to this many pixels. */
export const Y_SNAP = 8

export interface SheetPanelLayout {
  i: SheetPanelId
  /** Width in board columns, 3..12. */
  w: number
  /** Column the panel starts at. Absent until the board first places it. */
  x?: number
  /** Pixels from the top of the board. Absent until the board first places it. */
  y?: number
  /** Fixed pixel height. When absent the panel is as tall as its content. */
  height?: number
}

export const DEFAULT_SHEET_LAYOUT: SheetPanelLayout[] = SHEET_PANEL_IDS.map((i) => ({
  i,
  w: DEFAULT_PANEL_W
}))

const defaultById = new Map(DEFAULT_SHEET_LAYOUT.map((item) => [item.i, item]))

export function clampPanelWidth(w: number): number {
  if (!Number.isFinite(w)) return DEFAULT_PANEL_W
  return Math.max(MIN_PANEL_W, Math.min(Math.round(w), BOARD_COLUMNS))
}

export function clampPanelHeight(height: number): number {
  return Math.round(Math.max(MIN_PANEL_HEIGHT, Math.min(height, MAX_PANEL_HEIGHT)))
}

export function clampPanelX(x: number, w: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(Math.round(x), BOARD_COLUMNS - clampPanelWidth(w)))
}

export function snapY(y: number): number {
  if (!Number.isFinite(y) || y <= 0) return 0
  return Math.round(y / Y_SNAP) * Y_SNAP
}

/** Shapes written by earlier layout models, read once and converted. */
interface SavedPanelShape {
  i?: unknown
  w?: unknown
  x?: unknown
  y?: unknown
  h?: unknown
  col?: unknown
  order?: unknown
  height?: unknown
}

function readSaved(entry: SavedPanelShape): SheetPanelLayout | null {
  if (typeof entry?.i !== 'string') return null
  const i = entry.i as SheetPanelId
  const height = typeof entry.height === 'number' ? clampPanelHeight(entry.height) : undefined
  const w = typeof entry.w === 'number' ? clampPanelWidth(entry.w) : DEFAULT_PANEL_W

  // Earlier models had no free position: keep the width and let the board place it.
  const isLegacy = typeof entry.h === 'number' || typeof entry.order === 'number' || typeof entry.col === 'number'
  if (isLegacy) return { i, w, height }

  if (typeof entry.x === 'number' && typeof entry.y === 'number') {
    return { i, w, x: clampPanelX(entry.x, w), y: snapY(entry.y), height }
  }

  return { i, w, height }
}

export function resolveSheetLayout(
  saved: SheetPanelLayout[] | undefined,
  visibleIds: SheetPanelId[]
): SheetPanelLayout[] {
  const savedById = new Map<SheetPanelId, SheetPanelLayout>()
  for (const entry of saved ?? []) {
    const parsed = readSaved(entry as SavedPanelShape)
    if (parsed) savedById.set(parsed.i, parsed)
  }

  return visibleIds.map((id) => savedById.get(id) ?? defaultById.get(id)!)
}

export interface PanelPlacement {
  item: SheetPanelLayout
  x: number
  w: number
  /** Distance from the top of the board, in pixels. */
  top: number
  /** Height the panel occupies, in pixels. */
  height: number
}

function heightOf(item: SheetPanelLayout, heights: Record<string, number>): number {
  return item.height ?? heights[item.i] ?? FALLBACK_PANEL_HEIGHT
}

/**
 * Panels keep the position they were given. Only panels that have never been
 * placed get one, dropped into the first free space so they do not cover
 * anything the user has already arranged.
 */
export function placePanels(
  layout: SheetPanelLayout[],
  heights: Record<string, number>,
  columns = BOARD_COLUMNS,
  gap = PANEL_GAP
): PanelPlacement[] {
  const placements: PanelPlacement[] = []
  const skyline = new Array<number>(columns).fill(0)

  const occupy = (x: number, w: number, bottom: number) => {
    for (let c = x; c < Math.min(x + w, columns); c++) skyline[c] = Math.max(skyline[c], bottom)
  }

  for (const item of layout) {
    if (item.x == null || item.y == null) continue
    const w = clampPanelWidth(item.w)
    const x = clampPanelX(item.x, w)
    const height = heightOf(item, heights)
    placements.push({ item, x, w, top: item.y, height })
    occupy(x, w, item.y + height + gap)
  }

  for (const item of layout) {
    if (item.x != null && item.y != null) continue
    const w = clampPanelWidth(item.w)
    const height = heightOf(item, heights)

    let bestX = 0
    let bestTop = Number.POSITIVE_INFINITY
    for (let x = 0; x + w <= columns; x++) {
      let top = 0
      for (let c = x; c < x + w; c++) top = Math.max(top, skyline[c])
      if (top < bestTop) {
        bestTop = top
        bestX = x
      }
    }
    if (!Number.isFinite(bestTop)) bestTop = 0

    placements.push({ item, x: bestX, w, top: bestTop, height })
    occupy(bestX, w, bestTop + height + gap)
  }

  return placements
}

export function boardHeight(placements: PanelPlacement[]): number {
  return placements.reduce((max, placement) => Math.max(max, placement.top + placement.height), 0)
}

/** Freeze auto-placed panels so the board stops deciding anything for them. */
export function withResolvedPositions(
  layout: SheetPanelLayout[],
  placements: PanelPlacement[]
): SheetPanelLayout[] {
  return layout.map((item) => {
    if (item.x != null && item.y != null) return item
    const placement = placements.find((entry) => entry.item.i === item.i)
    if (!placement) return item
    return { ...item, x: placement.x, y: snapY(placement.top) }
  })
}

export function movePanel(
  layout: SheetPanelLayout[],
  id: SheetPanelId,
  x: number,
  y: number
): SheetPanelLayout[] {
  return layout.map((item) =>
    item.i === id ? { ...item, x: clampPanelX(x, item.w), y: snapY(y) } : item
  )
}

/** Applies a full size; an absent height means the panel goes back to hugging its content. */
export function resizePanel(
  layout: SheetPanelLayout[],
  id: SheetPanelId,
  size: { w: number; height?: number }
): SheetPanelLayout[] {
  return layout.map((item) => {
    if (item.i !== id) return item
    const w = clampPanelWidth(size.w)
    return {
      ...item,
      w,
      x: item.x == null ? item.x : clampPanelX(item.x, w),
      height: size.height ? clampPanelHeight(size.height) : undefined
    }
  })
}

export function layoutItemsEqual(a: SheetPanelLayout[], b: SheetPanelLayout[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item) => {
    const other = b.find((entry) => entry.i === item.i)
    if (!other) return false
    return (
      item.w === other.w &&
      item.x === other.x &&
      item.y === other.y &&
      item.height === other.height
    )
  })
}

/** Chars per text row for prose blocks; used to decide when to show "higher levels" text. */
const CHARS_PER_ROW = 380

/** Count rough text row units inside feature/compendium entry trees. */
export function countEntryUnits(entries: unknown): number {
  if (entries == null) return 0
  if (typeof entries === 'string') {
    const text = entries.trim()
    if (!text) return 0
    return Math.max(1, Math.ceil(text.length / CHARS_PER_ROW))
  }
  if (!Array.isArray(entries)) {
    if (typeof entries === 'object') {
      const obj = entries as Record<string, unknown>
      if (obj.type === 'list' && Array.isArray(obj.items)) {
        return obj.items.reduce<number>((sum, item) => sum + countEntryUnits(item), 0)
      }
      if (obj.entries) return 1 + countEntryUnits(obj.entries)
      if (obj.items) return countEntryUnits(obj.items)
      if (obj.entry) return countEntryUnits(obj.entry)
    }
    return 0
  }
  return entries.reduce<number>((sum, entry) => sum + countEntryUnits(entry), 0)
}
