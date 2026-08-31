import { FIVETOOLS } from './types'

export interface FluffImageInfo {
  url: string
  title?: string
  credit?: string
  width?: number
  height?: number
}

export interface FluffImageHref {
  type: string
  path?: string
  url?: string
}

interface RawFluffImage {
  href?: FluffImageHref
  title?: string
  credit?: string
  width?: number
  height?: number
}

export type FluffEntry = Record<string, unknown>

export function resolve5eToolsMediaUrl(
  href: FluffImageHref | undefined,
  mediaDir: 'img' | 'audio' = 'img',
  baseUrl: string = FIVETOOLS.liveBase
): string | null {
  if (!href) return null
  if (href.type === 'external' && href.url) return href.url
  if (href.type === 'internal' && href.path) {
    return `${baseUrl}/${mediaDir}/${encodeURI(href.path)}`
  }
  return null
}

export function parseFluffImages(
  images: unknown,
  baseUrl: string = FIVETOOLS.liveBase
): FluffImageInfo[] {
  if (!Array.isArray(images)) return []
  const out: FluffImageInfo[] = []
  for (const raw of images) {
    if (!raw || typeof raw !== 'object') continue
    const img = raw as RawFluffImage
    const url = resolve5eToolsMediaUrl(img.href, 'img', baseUrl)
    if (!url) continue
    out.push({
      url,
      title: img.title ? String(img.title) : undefined,
      credit: img.credit ? String(img.credit) : undefined,
      width: typeof img.width === 'number' ? img.width : undefined,
      height: typeof img.height === 'number' ? img.height : undefined
    })
  }
  return out
}

export function findFluffEntry(
  list: FluffEntry[],
  name: string,
  source: string
): FluffEntry | null {
  const nameKey = name.toLowerCase()
  const sourceKey = source.toLowerCase()
  return (
    list.find(
      (entry) =>
        String(entry.name).toLowerCase() === nameKey &&
        String(entry.source).toLowerCase() === sourceKey
    ) ?? null
  )
}

/** Resolve image array from a fluff entry, following `_copy` when images are inherited. */
export function collectFluffImageData(list: FluffEntry[], entry: FluffEntry): unknown[] {
  if (Array.isArray(entry.images) && entry.images.length > 0) return entry.images
  const copy = entry._copy as { name?: string; source?: string } | undefined
  if (copy?.name && copy?.source) {
    const base = findFluffEntry(list, copy.name, copy.source)
    if (base) return collectFluffImageData(list, base)
  }
  return []
}

export function getFluffImagesFromDetail(detail: unknown): FluffImageInfo[] {
  if (!detail || typeof detail !== 'object') return []
  const obj = detail as Record<string, unknown>
  if (Array.isArray(obj.fluffImages)) {
    return obj.fluffImages.filter(
      (img): img is FluffImageInfo =>
        !!img &&
        typeof img === 'object' &&
        typeof (img as FluffImageInfo).url === 'string'
    )
  }
  return parseFluffImages(obj.images)
}

export function monsterTokenImagePath(name: string, source: string): string {
  return `bestiary/tokens/${source}/${name}.webp`
}
