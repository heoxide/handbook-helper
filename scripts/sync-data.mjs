/**
 * Standalone CLI script to sync 5e.tools data outside the Electron app.
 * Usage: node scripts/sync-data.mjs [--force]
 */
import { mkdir, readFile, writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { homedir } from 'os'

const REPO = '5etools-mirror-3/5etools-src'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}`
const GITHUB_API = 'https://api.github.com'
const DATA_PREFIX = 'data/'

const dataRoot = join(homedir(), 'AppData', 'Roaming', 'handbook-helper')
const dataDir = join(dataRoot, '5etools-data')
const manifestPath = join(dataRoot, 'manifest.json')
const force = process.argv.includes('--force')

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Handbook-Helper/1.0' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

async function getLatestVersion() {
  const release = await fetchJson(`${GITHUB_API}/repos/${REPO}/releases/latest`)
  return release.tag_name.replace(/^v/, '')
}

async function buildRemoteManifest(version) {
  const tag = `v${version}`
  const ref = await fetchJson(`${GITHUB_API}/repos/${REPO}/git/ref/tags/${tag}`)
  let commitSha = ref.object.sha

  try {
    const tagObj = await fetchJson(`${GITHUB_API}/repos/${REPO}/git/tags/${ref.object.sha}`)
    if (tagObj.object?.type === 'commit') commitSha = tagObj.object.sha
  } catch {}

  const commit = await fetchJson(`${GITHUB_API}/repos/${REPO}/git/commits/${commitSha}`)
  const tree = await fetchJson(
    `${GITHUB_API}/repos/${REPO}/git/trees/${commit.tree.sha}?recursive=1`
  )

  const files = {}
  for (const item of tree.tree) {
    if (item.type !== 'blob') continue
    if (!item.path.startsWith(DATA_PREFIX)) continue
    files[item.path] = { sha: item.sha, size: item.size ?? 0 }
  }

  return { version, generatedAt: new Date().toISOString(), lastCheckedAt: new Date().toISOString(), files }
}

async function getChangedPaths(localVersion, remoteVersion) {
  const compare = await fetchJson(
    `${GITHUB_API}/repos/${REPO}/compare/v${localVersion}...v${remoteVersion}`
  )
  return new Set(
    (compare.files ?? [])
      .filter((f) => f.filename.startsWith(DATA_PREFIX) && f.status !== 'removed')
      .map((f) => f.filename)
  )
}

function rel(path) {
  return path.replace(/^data\//, '')
}

async function downloadFile(path, version) {
  const url = `${RAW_BASE}/v${version}/${path}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Handbook-Helper/1.0' } })
  if (!res.ok) throw new Error(`Failed: ${path}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  console.log('Handbook Helper — 5e.tools data sync')
  await mkdir(dataDir, { recursive: true })

  let localManifest = null
  if (existsSync(manifestPath)) {
    localManifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
    console.log(`Local version: v${localManifest.version}`)
  } else {
    console.log('No local data found — first sync')
  }

  const remoteVersion = await getLatestVersion()
  console.log(`Remote version: v${remoteVersion}`)

  console.log('Building remote manifest…')
  const remoteManifest = await buildRemoteManifest(remoteVersion)

  const versionChanged = localManifest?.version && localManifest.version !== remoteVersion
  let comparePaths = null
  if (!force && versionChanged) {
    try {
      comparePaths = await getChangedPaths(localManifest.version, remoteVersion)
      console.log(`Compare API: ${comparePaths.size} changed path(s) between versions`)
    } catch {
      comparePaths = null
    }
  }

  const toDownload = []
  const added = []
  const updated = []
  let unchanged = 0

  for (const [path, entry] of Object.entries(remoteManifest.files)) {
    const localPath = join(dataDir, rel(path))
    const hadLocally = localManifest?.files?.[path] && existsSync(localPath)
    const shaMatches = hadLocally && localManifest.files[path].sha === entry.sha

    if (!hadLocally) {
      added.push(rel(path))
      toDownload.push(path)
      continue
    }
    if (!shaMatches || force) {
      updated.push(rel(path))
      toDownload.push(path)
      continue
    }
    if (versionChanged && comparePaths && !comparePaths.has(path)) {
      unchanged++
      continue
    }
    unchanged++
  }

  console.log(`\nPlan: ${toDownload.length} to download, ${unchanged} unchanged`)

  if (added.length) {
    console.log('\nNew files:')
    for (const p of added) console.log(`  + ${p}`)
  }
  if (updated.length) {
    console.log('\nUpdated files:')
    for (const p of updated) console.log(`  ~ ${p}`)
  }

  for (let i = 0; i < toDownload.length; i++) {
    const path = toDownload[i]
    process.stdout.write(`\r[${i + 1}/${toDownload.length}] ${rel(path).slice(0, 60).padEnd(60)}`)
    const buf = await downloadFile(path, remoteVersion)
    const dest = join(dataDir, rel(path))
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, buf)
  }

  if (localManifest) {
    for (const path of Object.keys(localManifest.files)) {
      if (!remoteManifest.files[path]) {
        const localPath = join(dataDir, rel(path))
        if (existsSync(localPath)) {
          await unlink(localPath)
          console.log(`\nRemoved: ${rel(path)}`)
        }
      }
    }
  }

  const now = new Date().toISOString()
  remoteManifest.generatedAt =
    toDownload.length > 0 || !localManifest ? now : (localManifest.generatedAt ?? now)
  remoteManifest.lastCheckedAt = now

  await writeFile(manifestPath, JSON.stringify(remoteManifest, null, 2))
  console.log(`\nSync complete — v${remoteVersion}`)
}

main().catch((err) => {
  console.error('Sync failed:', err.message)
  process.exit(1)
})
