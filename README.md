# Handbook Helper

A cross-platform D&D 5e companion app for Windows and Mac, powered by [5e.tools](https://5e.tools) data with incremental manifest-based syncing.

**Current version: 0.0.1**

## Download

Installers are on **[GitHub Releases](https://github.com/heoxide/handbook-helper/releases/tag/v0.0.1)**.

| Platform | Download | Notes |
|----------|----------|-------|
| **macOS** (Apple Silicon M1/M2/M3) | [Handbook Helper-0.0.1-arm64.dmg](https://github.com/heoxide/handbook-helper/releases/download/v0.0.1/Handbook%20Helper-0.0.1-arm64.dmg) | Open the `.dmg`, drag **Handbook Helper** to Applications. If macOS blocks the app, right-click → **Open**. |
| **Windows** (installer) | [Handbook Helper Setup 0.0.1.exe](https://github.com/heoxide/handbook-helper/releases/download/v0.0.1/Handbook%20Helper%20Setup%200.0.1.exe) | Run the installer. A desktop shortcut is created automatically. |
| **Windows** (portable) | [Handbook Helper 0.0.1.exe](https://github.com/heoxide/handbook-helper/releases/download/v0.0.1/Handbook%20Helper%200.0.1.exe) | No install — run directly. |

If a direct link does not work, open the [v0.0.1 release page](https://github.com/heoxide/handbook-helper/releases/tag/v0.0.1) and download the file for your platform from **Assets**.

> If this repository is **private**, only people with repo access can download from Releases. For other players, share the `.dmg` or `.exe` via Google Drive, Dropbox, or Discord.

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

On first launch, the app automatically downloads 5e.tools data to your user data folder. You can also trigger sync manually from **Settings**.

Your characters and preferences stay on your device — app updates do not overwrite them.

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
