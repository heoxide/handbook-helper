import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SheetPanelId, SheetPanelLayout } from '../../../shared/sheet-layout'
import {
  BOARD_COLUMNS,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_W,
  PANEL_GAP,
  boardHeight,
  movePanel,
  placePanels,
  resizePanel,
  snapY,
  withResolvedPositions
} from '../../../shared/sheet-layout'

/** Below this width panels stack full width instead of holding their position. */
const STACKED_WIDTH = 720

/** Pointer travel before a press turns into a drag. */
const DRAG_THRESHOLD = 4

interface SheetBoardProps {
  layout: SheetPanelLayout[]
  onLayoutChange: (next: SheetPanelLayout[]) => void
  panels: Partial<Record<SheetPanelId, ReactNode>>
}

interface DragState {
  id: SheetPanelId
  /** Pointer position within the card, so it does not jump on grab. */
  grabX: number
  grabY: number
  startX: number
  startY: number
  /** Free position of the card while it follows the pointer, in board pixels. */
  left: number
  top: number
  active: boolean
}

interface ResizeState {
  id: SheetPanelId
  startX: number
  startY: number
  startW: number
  startHeight: number
  /** Natural content height — resize cannot exceed this. */
  maxHeight: number
  w: number
  height: number
  heightTouched: boolean
  active: boolean
}

/** Measure how tall a panel slot would be without a fixed height. */
function measureSlotContentHeight(slot: HTMLElement): number {
  const panel = slot.querySelector<HTMLElement>('.sheet-panel')
  const prev = slot.style.height
  slot.style.height = 'auto'
  const measured = Math.round((panel ?? slot).getBoundingClientRect().height)
  slot.style.height = prev
  return measured
}

/** Live content height for a panel (used when the slot is not fixed). */
function measurePanelContentHeight(slot: HTMLElement): number {
  const panel = slot.querySelector<HTMLElement>('.sheet-panel')
  return Math.round((panel ?? slot).getBoundingClientRect().height)
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const update = () => setWidth(node.clientWidth)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

export function SheetBoard({ layout, onLayoutChange, panels }: SheetBoardProps) {
  const { ref: boardRef, width } = useElementWidth<HTMLDivElement>()
  const [heights, setHeights] = useState<Record<string, number>>({})
  const [drag, setDrag] = useState<DragState | null>(null)
  const [resize, setResize] = useState<ResizeState | null>(null)
  const [frontId, setFrontId] = useState<SheetPanelId | null>(null)

  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const clampedHeightsRef = useRef<Set<string>>(new Set())

  const stacked = width > 0 && width < STACKED_WIDTH
  const flow = stacked || width === 0
  const columnWidth = (width - PANEL_GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS
  const columnStep = columnWidth + PANEL_GAP

  const leftOf = useCallback((x: number) => x * columnStep, [columnStep])
  const widthOf = useCallback(
    (w: number) => w * columnWidth + (w - 1) * PANEL_GAP,
    [columnWidth]
  )

  /** Only the panel being resized changes size; every other panel is untouched. */
  const sizedLayout = useMemo(() => {
    if (!resize?.active) return layout
    const current = layout.find((item) => item.i === resize.id)
    return resizePanel(layout, resize.id, {
      w: resize.w,
      height: resize.heightTouched ? resize.height : current?.height
    })
  }, [layout, resize])

  const placements = useMemo(
    () => placePanels(sizedLayout, heights),
    [sizedLayout, heights]
  )

  const dragged = drag?.active ? placements.find((p) => p.item.i === drag.id) : undefined
  const dropTarget = useMemo(() => {
    if (!drag?.active || !dragged) return null
    return {
      x: Math.max(0, Math.min(Math.round(drag.left / columnStep), BOARD_COLUMNS - dragged.w)),
      y: snapY(Math.max(0, drag.top))
    }
  }, [drag?.active, drag?.left, drag?.top, dragged, columnStep])

  /** Panels placed by the board are written back once, so positions stay put from then on. */
  const writtenRef = useRef('')
  useEffect(() => {
    if (flow || drag || resize) return
    const unplaced = layout.filter((item) => item.x == null || item.y == null)
    if (unplaced.length === 0) return
    if (unplaced.some((item) => item.height == null && heights[item.i] == null)) return

    // The save is async, so remember what was sent instead of resending each render.
    const signature = unplaced.map((item) => item.i).join(',')
    if (writtenRef.current === signature) return
    writtenRef.current = signature

    onLayoutChange(withResolvedPositions(layout, placements))
  }, [flow, drag, resize, layout, heights, placements, onLayoutChange])

  useEffect(() => {
    const board = boardRef.current
    if (!board) return

    let frame = 0

    const measure = () => {
      const next: Record<string, number> = {}
      const oversized: SheetPanelId[] = []

      board.querySelectorAll<HTMLElement>('.sheet-board-slot').forEach((slot) => {
        const id = slot.dataset.panel as SheetPanelId | undefined
        if (!id) return

        const item = layoutRef.current.find((entry) => entry.i === id)
        const natural = measureSlotContentHeight(slot)
        next[id] = item?.height != null ? item.height : measurePanelContentHeight(slot)

        if (
          item?.height != null &&
          item.height > natural + 2 &&
          !clampedHeightsRef.current.has(id)
        ) {
          oversized.push(id)
        }
      })

      if (oversized.length > 0 && !drag && !resize) {
        for (const id of oversized) clampedHeightsRef.current.add(id)
        onLayoutChange(
          layoutRef.current.map((item) =>
            oversized.includes(item.i) ? { ...item, height: undefined } : item
          )
        )
      }

      setHeights((prev) => {
        const ids = new Set([...Object.keys(prev), ...Object.keys(next)])
        const changed = [...ids].some((id) => Math.abs((prev[id] ?? 0) - (next[id] ?? 0)) > 1)
        return changed ? next : prev
      })
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    const observer = new ResizeObserver(schedule)
    board.querySelectorAll<HTMLElement>('.sheet-board-slot').forEach((slot) => {
      observer.observe(slot)
      const panel = slot.querySelector<HTMLElement>('.sheet-panel')
      if (panel) observer.observe(panel)
    })
    schedule()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [boardRef, layout, width, drag, resize, onLayoutChange])

  const handleSlotPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, id: SheetPanelId) => {
      if (event.button !== 0) return
      setFrontId(id)
      if (flow) return

      const target = event.target as HTMLElement
      if (
        target.closest(
          'button, a, input, select, textarea, label, .sheet-board-resize, .sheet-panel-head-actions'
        )
      ) {
        return
      }
      if (!target.closest('.sheet-panel-drag-handle')) return

      const board = boardRef.current
      const slot = target.closest<HTMLElement>('.sheet-board-slot')
      if (!board || !slot) return

      const boardRect = board.getBoundingClientRect()
      const slotRect = slot.getBoundingClientRect()

      event.preventDefault()
      setDrag({
        id,
        grabX: event.clientX - slotRect.left,
        grabY: event.clientY - slotRect.top,
        startX: event.clientX,
        startY: event.clientY,
        left: slotRect.left - boardRect.left,
        top: slotRect.top - boardRect.top,
        active: false
      })
    },
    [boardRef, flow]
  )

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, item: SheetPanelLayout) => {
      if (event.button !== 0) return
      const slot = (event.target as HTMLElement).closest<HTMLElement>('.sheet-board-slot')
      if (!slot) return

      event.preventDefault()
      event.stopPropagation()
      const startHeight = slot.getBoundingClientRect().height
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, measureSlotContentHeight(slot))
      setResize({
        id: item.i,
        startX: event.clientX,
        startY: event.clientY,
        startW: item.w,
        startHeight,
        maxHeight,
        w: item.w,
        height: Math.min(startHeight, maxHeight),
        heightTouched: false,
        active: false
      })
    },
    []
  )

  useEffect(() => {
    if (!drag) return

    const onMove = (event: PointerEvent) => {
      const board = boardRef.current
      if (!board) return
      const travel = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
      if (!drag.active && travel < DRAG_THRESHOLD) return

      const boardRect = board.getBoundingClientRect()
      setDrag((current) =>
        current
          ? {
              ...current,
              left: event.clientX - boardRect.left - current.grabX,
              top: event.clientY - boardRect.top - current.grabY,
              active: true
            }
          : current
      )
    }

    const onUp = () => {
      if (drag.active && dropTarget) {
        onLayoutChange(movePanel(layoutRef.current, drag.id, dropTarget.x, dropTarget.y))
      }
      setDrag(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drag, dropTarget, boardRef, onLayoutChange])

  useEffect(() => {
    if (!resize) return

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - resize.startX
      const dy = event.clientY - resize.startY
      if (!resize.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

      setResize((current) => {
        if (!current) return current
        const maxW = BOARD_COLUMNS - (layoutRef.current.find((i) => i.i === current.id)?.x ?? 0)
        return {
          ...current,
          w: Math.max(MIN_PANEL_W, Math.min(current.startW + Math.round(dx / columnStep), maxW)),
          height: Math.max(
            MIN_PANEL_HEIGHT,
            Math.min(current.startHeight + dy, current.maxHeight)
          ),
          heightTouched: current.heightTouched || Math.abs(dy) >= DRAG_THRESHOLD,
          active: true
        }
      })
    }

    const onUp = () => {
      if (resize.active) {
        const current = layoutRef.current.find((item) => item.i === resize.id)
        let height = resize.heightTouched ? resize.height : current?.height
        if (height != null && height >= resize.maxHeight - 2) {
          height = undefined
        }
        onLayoutChange(
          resizePanel(layoutRef.current, resize.id, {
            w: resize.w,
            height: resize.heightTouched ? height : current?.height
          })
        )
      }
      setResize(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResize(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [resize, columnStep, onLayoutChange])

  const fitToContent = useCallback(
    (item: SheetPanelLayout) =>
      onLayoutChange(resizePanel(layoutRef.current, item.i, { w: item.w })),
    [onLayoutChange]
  )

  const height = boardHeight(placements)
  const contentHeight = drag?.active && dragged ? Math.max(height, drag.top + dragged.height) : height

  return (
    <div
      ref={boardRef}
      className="sheet-board"
      data-stacked={flow || undefined}
      data-dragging={drag?.active || undefined}
      style={
        flow
          ? undefined
          : ({
              height: `${Math.round(contentHeight)}px`,
              '--sheet-col-width': `${columnWidth}px`,
              '--sheet-col-gap': `${PANEL_GAP}px`
            } as React.CSSProperties)
      }
    >
      {!flow && dropTarget && dragged && (
        <div
          className="sheet-board-target"
          style={{
            left: `${Math.round(leftOf(dropTarget.x))}px`,
            top: `${dropTarget.y}px`,
            width: `${Math.round(widthOf(dragged.w))}px`,
            height: `${Math.round(dragged.height)}px`
          }}
        />
      )}

      {placements.map((placement) => {
        const item = placement.item
        const isDragged = drag?.active && drag.id === item.i
        const isResized = resize?.active && resize.id === item.i
        const isFront = frontId === item.i

        return (
          <div
            key={item.i}
            className="sheet-board-slot"
            data-panel={item.i}
            data-dragging={isDragged || undefined}
            data-active={isDragged || isResized || undefined}
            data-fixed={item.height != null || undefined}
            data-front={isFront || undefined}
            style={
              flow
                ? item.height
                  ? { height: `${Math.round(item.height)}px` }
                  : undefined
                : {
                    left: `${Math.round(isDragged ? drag.left : leftOf(placement.x))}px`,
                    top: `${Math.round(isDragged ? drag.top : placement.top)}px`,
                    width: `${Math.round(widthOf(placement.w))}px`,
                    height: item.height ? `${Math.round(item.height)}px` : undefined
                  }
            }
            onPointerDown={(event) => handleSlotPointerDown(event, item.i)}
          >
            {panels[item.i]}
            <button
              type="button"
              className="sheet-board-resize"
              aria-label="Resize panel"
              title="Drag to resize · double-click to fit content"
              onPointerDown={(event) => handleResizePointerDown(event, item)}
              onDoubleClick={() => fitToContent(item)}
            />
          </div>
        )
      })}
    </div>
  )
}

export function SheetPanelTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="sheet-panel-drag-handle" title="Drag to move panel">
      {children}
    </h3>
  )
}

export function SheetPanelHead({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="sheet-panel-head sheet-panel-drag-handle" title="Drag to move panel">
      <h3>{title}</h3>
      {actions}
    </div>
  )
}
