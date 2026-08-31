/** Async file-system abstraction for 5etools data (Node disk or browser IndexedDB). */
export interface DataFs {
  exists(path: string): Promise<boolean>
  readText(path: string): Promise<string | null>
  writeText(path: string, content: string): Promise<void>
  delete(path: string): Promise<void>
  /** List file names in a directory (not nested paths). */
  listFiles(dir: string): Promise<string[]>
}

export function joinDataPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
}
