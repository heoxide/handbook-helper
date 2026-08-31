import { mkdir, readdir, readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { SavedCharacter, SavedCharacterSummary } from '../../shared/character'
import { formatClassSummary, migrateCharacter } from '../../shared/character'

export class CharacterStore {
  private dir: string

  constructor(userDataPath: string) {
    this.dir = join(userDataPath, 'characters')
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true })
  }

  async list(): Promise<SavedCharacterSummary[]> {
    await this.ensureDir()
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'))
    const summaries: SavedCharacterSummary[] = []

    for (const file of files) {
      try {
        const raw = JSON.parse(await readFile(join(this.dir, file), 'utf-8')) as Record<string, unknown>
        const migrated = migrateCharacter(raw)
        summaries.push({
          id: migrated.id,
          name: migrated.name,
          className: formatClassSummary(migrated),
          speciesName: migrated.species.name,
          backgroundName: migrated.background.name,
          level: migrated.level,
          alignment: migrated.alignment,
          updatedAt: migrated.updatedAt
        })
      } catch {
        // skip corrupt files
      }
    }

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async save(character: SavedCharacter): Promise<SavedCharacter> {
    await this.ensureDir()
    await writeFile(join(this.dir, `${character.id}.json`), JSON.stringify(character, null, 2), 'utf-8')
    return character
  }

  async load(id: string): Promise<SavedCharacter | null> {
    const filePath = join(this.dir, `${id}.json`)
    if (!existsSync(filePath)) return null
    try {
      const raw = JSON.parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>
      return migrateCharacter(raw)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    const filePath = join(this.dir, `${id}.json`)
    if (!existsSync(filePath)) return false
    await unlink(filePath)
    return true
  }
}
