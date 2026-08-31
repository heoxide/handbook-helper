import { createHash } from 'crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import type { Plugin } from 'vite'

function walkFiles(dir: string, root = dir): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, root))
    } else {
      files.push(relative(root, fullPath).replace(/\\/g, '/'))
    }
  }

  return files
}

function fingerprintFile(filePath: string): string {
  const buffer = readFileSync(filePath)
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}

export function versionManifestPlugin(options: {
  version: string
  outDir: string
  buildId?: string
}): Plugin {
  const buildId = options.buildId ?? process.env.GITHUB_SHA?.slice(0, 12) ?? String(Date.now())

  return {
    name: 'handbook-version-manifest',
    apply: 'build',
    closeBundle() {
      const files = walkFiles(options.outDir)
      const assets: Record<string, string> = {}

      for (const file of files) {
        if (file === 'version.json') continue
        const fullPath = join(options.outDir, file)
        assets[file] = fingerprintFile(fullPath)
      }

      const manifest = {
        version: options.version,
        buildId,
        builtAt: new Date().toISOString(),
        assets
      }

      writeFileSync(join(options.outDir, 'version.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    }
  }
}
