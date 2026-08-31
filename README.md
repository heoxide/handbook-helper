# Handbook Helper

A cross-platform D&D 5e companion app for Windows and Mac, powered by [5e.tools](https://5e.tools) data with incremental manifest-based syncing.

## Features

- **Home** — Welcome hub with quick access to character creation and compendium
- **Character Creator** — Guided race/class selection with 4d6 ability score rolling
- **Rules Compendium** — Searchable spells, monsters, races, and classes from 5e.tools
- **Incremental sync** — Only downloads new/changed JSON files (never full re-downloads)
- **Theme support** — Light/dark mode with turquoise accent palette

## Getting Started

```bash
npm install
npm run dev
```

On first launch, the app automatically downloads 5e.tools data to your user data folder. You can also trigger sync manually via the Settings gear icon.

## Data Sync

Data is stored in:
- **Windows:** `%APPDATA%/handbook-helper/5etools-data/`
- **macOS:** `~/Library/Application Support/handbook-helper/5etools-data/`

The sync engine:
1. Checks [GitHub Releases](https://github.com/5etools-mirror-3/5etools-src/releases) for the latest version
2. Builds a manifest from the Git tree (file SHA + size for every `data/` file)
3. Compares against your local manifest
4. Downloads **only** missing or changed files

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode |
| `npm run build` | Build for production |
| `npm run dist` | Package for Windows/Mac |
| `npm run sync-data` | Run data sync from CLI |

## Tech Stack

- Electron + electron-vite
- React 18 + TypeScript
- 5e.tools JSON data (via GitHub manifest sync)

## Legal

This app uses community-maintained 5e.tools data for personal reference. Only include sourcebooks you own. Do not redistribute copyrighted content.
