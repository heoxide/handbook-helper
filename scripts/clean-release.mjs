import { readFileSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

const alwaysRemove = ['builder-debug.yml', 'builder-effective-config.yaml', 'win-unpacked']

for (const name of alwaysRemove) {
  const target = join(releaseDir, name)
  try {
    rmSync(target, { recursive: true, force: true })
    console.log(`Removed ${name}`)
  } catch {
    /* missing */
  }
}

try {
  const files = readdirSync(releaseDir)
  for (const file of files) {
    const isOldBuild =
      file.includes('Handbook Helper') &&
      !file.includes(version) &&
      (file.endsWith('.exe') || file.endsWith('.blockmap'))

    if (isOldBuild) {
      rmSync(join(releaseDir, file), { force: true })
      console.log(`Removed old build: ${file}`)
    }
  }
} catch {
  console.log('No release folder to clean.')
}
