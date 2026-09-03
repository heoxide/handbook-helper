# Handbook Helper

A cross-platform D&D 5e companion app for Windows and Mac, powered by [5e.tools](https://5e.tools) data with incremental manifest-based syncing.

**Latest release:** [github.com/heoxide/handbook-helper/releases/latest](https://github.com/heoxide/handbook-helper/releases/latest)

## Download

These links always point at the **newest** [GitHub Release](https://github.com/heoxide/handbook-helper/releases/latest). When you publish a new version (new git tag), the same links download the latest build — no README edit needed.

| Platform | Download | Notes |
|----------|----------|-------|
| **macOS** (Apple Silicon M1/M2/M3) | [Handbook-Helper-mac-arm64.dmg](https://github.com/heoxide/handbook-helper/releases/latest/download/Handbook-Helper-mac-arm64.dmg) | Open the `.dmg`, drag **Handbook Helper** to Applications. If macOS blocks the app, right-click → **Open**. |
| **Windows** (installer) | [Handbook-Helper-Setup.exe](https://github.com/heoxide/handbook-helper/releases/latest/download/Handbook-Helper-Setup.exe) | Run the installer. A desktop shortcut is created automatically. |
| **Windows** (portable) | [Handbook-Helper-Portable.exe](https://github.com/heoxide/handbook-helper/releases/latest/download/Handbook-Helper-Portable.exe) | No install — run directly. |

If a direct link fails, open the [latest release page](https://github.com/heoxide/handbook-helper/releases/latest) and pick the file from **Assets**.

### Publishing a new version (for maintainers)

1. Bump `version` in `package.json`
2. Commit and push to `main`
3. Create and push a tag (example for `0.0.2`):
   ```bash
   git tag v0.0.2
   git push origin v0.0.2
   ```
4. Wait for the **Build Release** workflow to finish — it uploads installers with the fixed names above

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
