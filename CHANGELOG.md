# Changelog

All notable changes to Handbook Helper are documented here.

## [0.0.4] — 2026-09-03

### Character creation

- **Background & species skills** — Parses `choose` proficiency blocks; you can no longer pick the same skill twice. Background and species skill choices appear on the Skills step.
- **2024 ability scores** — Background ability options support more 5etools JSON shapes (`choose.from`, `choose.weighted`). Species ASI applies in 2024 when the species grants bonuses.
- **Draft persistence** — Creator progress is saved to session storage when you navigate away or change source books. Edition/source toggles no longer wipe your draft.
- **Species effects** — Species feat picks, skill choices, and flexible ASI steps work for 2024 and 2014 species.
- **Subclass list** — Subclasses are filtered by enabled source books (fewer null/broken entries).
- **Feat filtering** — Origin and level-up feats respect 2014 vs 2024 edition; duplicate PHB/XPHB feats are deduplicated.

### Character sheet

- **Spell picking** — “Add spells” and “Add cantrips” open searchable modals (same UX as Prepare Spells), with loading and empty states.
- **Spell slots** — Fixed phantom 0/0 slots after level-up; long rest clears temp HP correctly.
- **Combat tracking** — HP −/+ controls and temp HP field.
- **Gold** — Spend or add gold from the inventory panel.
- **Portrait** — Upload a character image from the sheet header.
- **Level down** — New Level Down button (syncs HP, slots, and spell limits).
- **Level up** — Step-by-step wizard tabs; feat list is edition-filtered without an arbitrary cap.

### UI fixes

- Equipment plan titles visible on macOS (dark mode heading color).
- Level-up feat/section titles use themed accent color (fixed undefined `--accent` CSS variable).
- Compendium feat list scroll layout fixed (entries past “B” are reachable).

---

## [0.0.3] — 2026-09-03

- Stable release asset names for `/releases/latest/download/` links.
- Version bump to 0.0.2 in package metadata.

## [0.0.2] — 2026-09-03

- Stable installer filenames (`Handbook-Helper-Setup.exe`, `Handbook-Helper-mac-arm64.dmg`, etc.).

## [0.0.1] — Initial release

- Electron desktop app with character creator, compendium, and 5etools incremental sync.
- GitHub Actions builds for macOS (Apple Silicon) and Windows.
