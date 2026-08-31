import { mkdir, readFile, writeFile, unlink, readdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import type { DataFs } from '../../shared/data-fs'
import { joinDataPath } from '../../shared/data-fs'

export class NodeDataFs implements DataFs {
  constructor(private root: string) {}

  private abs(path: string): string {
    return join(this.root, path.replace(/\\/g, '/'))
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(this.abs(path))
  }

  async readText(path: string): Promise<string | null> {
    const file = this.abs(path)
    if (!existsSync(file)) return null
    try {
      return await readFile(file, 'utf-8')
    } catch {
      return null
    }
  }

  async writeText(path: string, content: string): Promise<void> {
    const file = this.abs(path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content, 'utf-8')
  }

  async delete(path: string): Promise<void> {
    const file = this.abs(path)
    if (existsSync(file)) await unlink(file)
  }

  async listFiles(dir: string): Promise<string[]> {
    const folder = this.abs(dir)
    if (!existsSync(folder)) return []
    const files = await readdir(folder)
    return files.filter(
      (f) =>
        f.endsWith('.json') &&
        !f.startsWith('fluff-') &&
        f !== 'index.json' &&
        f !== 'foundry.json' &&
        f !== 'sources.json'
    )
  }

  getRoot(): string {
    return this.root
  }

  static join(...parts: string[]): string {
    return joinDataPath(...parts)
  }
}
