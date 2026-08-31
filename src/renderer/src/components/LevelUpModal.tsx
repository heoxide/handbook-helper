import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { SavedCharacter, Ability } from '../../../shared/character'
import { ABILITIES, ABILITY_LABELS } from '../../../shared/character'
import type { ClassBundle, SubclassOption } from '../../../shared/class-mechanics'
import type { CharacterSheetState } from '../../../shared/character-sheet'
import { syncSheetWithLevel } from '../../../shared/character-sheet'
import type { EntityRef } from '../../../shared/class-mechanics'
import {
  getSubclassDetail,
  optionalFeatureMatchesTypes,
  resolveEffectiveClassDetail
} from '../../../shared/class-mechanics'
import {
  analyzeLevelUp,
  applyAsiToScores,
  validateAsiSelection,
  type AsiSelection
} from '../../../shared/level-up'
import { formatEntriesAsNodes } from './EntryDescription'

export interface LevelUpResult {
  character: SavedCharacter
  sheet: CharacterSheetState
}

interface LevelUpModalProps {
  character: SavedCharacter
  sheet: CharacterSheetState
  bundle: ClassBundle
  classDetail: Record<string, unknown>
  subclasses: SubclassOption[]
  optionalPool: Record<string, unknown>[]
  onCancel: () => void
  onConfirm: (result: LevelUpResult) => void
}

type ProgressionChoice = 'asi' | 'feat'

function FeatureBlock({
  feature
}: {
  feature: { name: string; entries: unknown[]; isSubclass?: boolean }
}) {
  return (
    <div className="level-up-feature">
      <div className="level-up-feature-head">
        <strong>{feature.name}</strong>
        {feature.isSubclass ? <span className="level-up-tag">Subclass</span> : null}
      </div>
      {feature.entries.length > 0 ? (
        <div className="level-up-feature-body">{formatEntriesAsNodes(feature.entries)}</div>
      ) : null}
    </div>
  )
}

function spellLimitLabel(kind: 'cantrips' | 'prepared' | 'known'): string {
  if (kind === 'cantrips') return 'Cantrips known'
  if (kind === 'prepared') return 'Prepared spells'
  return 'Spells known'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}

function hitDieFaces(classDetail: Record<string, unknown>): number {
  const hd = classDetail.hd
  if (hd && typeof hd === 'object' && 'faces' in hd) {
    return Number((hd as { faces?: number }).faces) || 8
  }
  return 8
}

export function LevelUpModal({
  character,
  sheet,
  bundle,
  classDetail,
  subclasses,
  optionalPool,
  onCancel,
  onConfirm
}: LevelUpModalProps) {
  const toLevel = character.level + 1
  const [subclassSource, setSubclassSource] = useState('')

  const analysisSubclass = useMemo(() => {
    if (subclassSource) {
      const sub = subclasses.find((s) => s.source === subclassSource)
      if (sub) return sub
    }
    if (!character.subclass) return null
    return {
      name: character.subclass.name,
      shortName: character.subclass.name,
      source: character.subclass.source,
      className: character.class.name,
      classSource: character.class.source
    }
  }, [subclassSource, subclasses, character])

  const effectiveClassDetail = useMemo(() => {
    const subclassDetail = analysisSubclass
      ? getSubclassDetail(bundle, analysisSubclass) ?? null
      : null
    return resolveEffectiveClassDetail(classDetail, subclassDetail)
  }, [bundle, classDetail, analysisSubclass])

  const analysis = useMemo(
    () => analyzeLevelUp(bundle, classDetail, character, toLevel, analysisSubclass),
    [bundle, classDetail, character, toLevel, analysisSubclass]
  )

  const needsProgressionChoice =
    analysis.asiFeatures.length > 0 || analysis.epicBoonFeatures.length > 0

  const [progressionChoice, setProgressionChoice] = useState<ProgressionChoice>(
    analysis.epicBoonFeatures.length > 0 ? 'feat' : 'asi'
  )
  const [asiMode, setAsiMode] = useState<'+2' | '+1+1'>('+2')
  const [asiPrimary, setAsiPrimary] = useState<Ability | ''>('')
  const [asiSecondary, setAsiSecondary] = useState<Ability | ''>('')
  const [featQuery, setFeatQuery] = useState('')
  const [featOptions, setFeatOptions] = useState<{ name: string; source: string }[]>([])
  const [selectedFeat, setSelectedFeat] = useState<EntityRef | null>(null)
  const [pickedOptional, setPickedOptional] = useState<EntityRef[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!needsProgressionChoice) return
    void window.handbook.data.getFeats().then((feats) => {
      const enabled = new Set(character.enabledSources ?? [])
      const filtered = feats
        .filter((f) => !enabled.size || enabled.has(f.source))
        .map((f) => ({ name: f.name, source: f.source }))
      setFeatOptions(filtered)
    })
  }, [needsProgressionChoice, character.enabledSources])

  const filteredFeats = useMemo(() => {
    const q = featQuery.trim().toLowerCase()
    let list = featOptions
    if (analysis.epicBoonFeatures.length > 0) {
      list = list.filter((f) => f.name.toLowerCase().includes('boon'))
    }
    if (!q) return list.slice(0, 40)
    return list.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 40)
  }, [featOptions, featQuery, analysis.epicBoonFeatures.length])

  const requiredOptionalPicks = analysis.optionalFeatureGains.reduce(
    (sum, g) => sum + g.pickCount,
    0
  )

  const toggleOptional = (feat: Record<string, unknown>) => {
    const ref = { name: String(feat.name), source: String(feat.source) }
    const exists = pickedOptional.some((p) => p.name === ref.name && p.source === ref.source)
    if (exists) {
      setPickedOptional((prev) =>
        prev.filter((p) => !(p.name === ref.name && p.source === ref.source))
      )
      return
    }
    if (pickedOptional.length >= requiredOptionalPicks) return
    setPickedOptional((prev) => [...prev, ref])
  }

  const buildAsiSelection = (): AsiSelection | null => {
    if (progressionChoice !== 'asi') return null
    if (asiMode === '+2') {
      if (!asiPrimary) return null
      return { mode: '+2', abilities: [asiPrimary] }
    }
    if (!asiPrimary || !asiSecondary || asiPrimary === asiSecondary) return null
    return { mode: '+1+1', abilities: [asiPrimary, asiSecondary] }
  }

  const handleConfirm = () => {
    setError(null)

    if (analysis.requiresSubclass && !subclassSource) {
      setError('Choose a subclass before leveling up.')
      return
    }

    if (needsProgressionChoice) {
      if (progressionChoice === 'feat' && !selectedFeat) {
        setError(
          analysis.epicBoonFeatures.length > 0
            ? 'Choose an Epic Boon feat.'
            : 'Choose a feat, or switch to Ability Score Increase.'
        )
        return
      }
      if (progressionChoice === 'asi') {
        const asi = buildAsiSelection()
        const asiError = validateAsiSelection(asi)
        if (asiError) {
          setError(asiError)
          return
        }
      }
    }

    if (requiredOptionalPicks > 0 && pickedOptional.length < requiredOptionalPicks) {
      setError(`Pick ${requiredOptionalPicks} optional feature${requiredOptionalPicks > 1 ? 's' : ''}.`)
      return
    }

    const chosenSubclass = subclassSource
      ? subclasses.find((s) => s.source === subclassSource)
      : null

    let nextChar: SavedCharacter = {
      ...character,
      level: toLevel,
      subclass: chosenSubclass
        ? { name: chosenSubclass.name, source: chosenSubclass.source }
        : character.subclass
    }

    if (progressionChoice === 'asi') {
      const asi = buildAsiSelection()
      if (asi) {
        nextChar = {
          ...nextChar,
          abilityScores: applyAsiToScores(nextChar.abilityScores, asi)
        }
      }
    } else if (selectedFeat) {
      nextChar = {
        ...nextChar,
        feats: [...(nextChar.feats ?? []), selectedFeat]
      }
    }

    const nextSheet = syncSheetWithLevel(
      {
        ...sheet,
        optionalFeatures:
          requiredOptionalPicks > 0
            ? [...sheet.optionalFeatures, ...pickedOptional]
            : sheet.optionalFeatures
      },
      effectiveClassDetail,
      toLevel,
      nextChar.abilityScores.con,
      nextChar.abilityScores
    )

    nextSheet.hp = {
      max: nextSheet.hp.max,
      current: Math.min(nextSheet.hp.max, sheet.hp.current + analysis.hpGain)
    }

    onConfirm({ character: nextChar, sheet: nextSheet })
  }

  return (
    <div className="sheet-modal-backdrop" onMouseDown={onCancel}>
      <div
        className="sheet-modal level-up-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="level-up-title"
      >
        <div className="level-up-header">
          <div>
            <h3 id="level-up-title">
              Level Up — {character.class.name} {analysis.fromLevel} → {analysis.toLevel}
            </h3>
            <p className="level-up-subtitle muted">
              Review what you gain at this level, then confirm your choices.
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="level-up-body">
          <section className="level-up-section">
            <h4>Core improvements</h4>
            <ul className="level-up-summary">
              <li>
                Hit Points: +{analysis.hpGain} (average on d{hitDieFaces(classDetail)})
              </li>
              {analysis.proficiencyBonusChange ? (
                <li>
                  Proficiency Bonus: +{analysis.proficiencyBonusChange.from} → +
                  {analysis.proficiencyBonusChange.to}
                </li>
              ) : null}
            </ul>
          </section>

          {analysis.requiresSubclass ? (
            <section className="level-up-section">
              <h4>Choose subclass</h4>
              <p className="sheet-hint">Your class gains its subclass at this level.</p>
              <select
                className="sheet-select"
                value={subclassSource}
                onChange={(e) => setSubclassSource(e.target.value)}
              >
                <option value="">Select subclass…</option>
                {subclasses.map((s) => (
                  <option key={s.source} value={s.source}>
                    {s.name}
                  </option>
                ))}
              </select>
            </section>
          ) : null}

          {analysis.normalFeatures.length > 0 ? (
            <section className="level-up-section">
              <h4>New class features</h4>
              {analysis.normalFeatures.map((f) => (
                <FeatureBlock key={f.uid} feature={f} />
              ))}
            </section>
          ) : null}

          {analysis.spellLimitChanges.length > 0 || analysis.spellSlotChanges.length > 0 ? (
            <section className="level-up-section">
              <h4>Spellcasting</h4>
              <ul className="level-up-summary">
                {analysis.spellLimitChanges.map((c) => (
                  <li key={c.kind}>
                    {spellLimitLabel(c.kind)}: {c.from} → {c.to}
                  </li>
                ))}
                {analysis.spellSlotChanges.map((c) => (
                  <li key={c.level}>
                    {c.level}
                    {ordinal(c.level)}-level slots: {c.from} → {c.to}
                  </li>
                ))}
              </ul>
              <p className="sheet-hint">
                After confirming, use <strong>Add spells</strong> on your sheet to pick new cantrips
                or prepared spells.
              </p>
            </section>
          ) : null}

          {analysis.resourceChanges.length > 0 ? (
            <section className="level-up-section">
              <h4>Class resources</h4>
              <ul className="level-up-summary">
                {analysis.resourceChanges.map((c) => (
                  <li key={c.id}>
                    {c.label}: {c.from} → {c.to}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {analysis.optionalFeatureGains.length > 0 ? (
            <section className="level-up-section">
              <h4>Optional features</h4>
              <p className="sheet-hint">
                Pick {requiredOptionalPicks} new option
                {requiredOptionalPicks > 1 ? 's' : ''} ({pickedOptional.length}/
                {requiredOptionalPicks}).
              </p>
              {analysis.optionalFeatureGains.map((gain) => (
                <div key={gain.name} className="level-up-optional-group">
                  <p className="level-up-optional-label">{gain.name}</p>
                  <div className="optional-feature-grid">
                    {optionalPool
                      .filter((f) => optionalFeatureMatchesTypes(f, gain.featureTypes))
                      .slice(0, 48)
                      .map((f) => {
                        const selected = pickedOptional.some(
                          (p) => p.name === f.name && p.source === f.source
                        )
                        const alreadyHas = sheet.optionalFeatures.some(
                          (p) => p.name === f.name && p.source === f.source
                        )
                        return (
                          <button
                            key={`${f.name}|${f.source}`}
                            type="button"
                            disabled={alreadyHas}
                            className={`optional-feature-chip ${selected ? 'selected' : ''}`}
                            onClick={() => toggleOptional(f)}
                          >
                            {String(f.name)}
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {needsProgressionChoice ? (
            <section className="level-up-section">
              <h4>
                {analysis.epicBoonFeatures.length > 0
                  ? 'Epic Boon'
                  : 'Ability Score Improvement or Feat'}
              </h4>
              {analysis.asiFeatures.map((f) => (
                <FeatureBlock key={f.uid} feature={f} />
              ))}
              {analysis.epicBoonFeatures.map((f) => (
                <FeatureBlock key={f.uid} feature={f} />
              ))}

              {analysis.epicBoonFeatures.length === 0 ? (
                <div className="level-up-choice-tabs">
                  <button
                    type="button"
                    className={`btn-chip ${progressionChoice === 'asi' ? 'selected' : ''}`}
                    onClick={() => setProgressionChoice('asi')}
                  >
                    Ability Score Increase
                  </button>
                  <button
                    type="button"
                    className={`btn-chip ${progressionChoice === 'feat' ? 'selected' : ''}`}
                    onClick={() => setProgressionChoice('feat')}
                  >
                    Feat
                  </button>
                </div>
              ) : null}

              {progressionChoice === 'asi' && analysis.epicBoonFeatures.length === 0 ? (
                <div className="level-up-asi">
                  <div className="level-up-choice-tabs">
                    <button
                      type="button"
                      className={`btn-chip ${asiMode === '+2' ? 'selected' : ''}`}
                      onClick={() => setAsiMode('+2')}
                    >
                      +2 to one ability
                    </button>
                    <button
                      type="button"
                      className={`btn-chip ${asiMode === '+1+1' ? 'selected' : ''}`}
                      onClick={() => setAsiMode('+1+1')}
                    >
                      +1 to two abilities
                    </button>
                  </div>
                  <div className="level-up-asi-picks">
                    <label>
                      {asiMode === '+2' ? '+2 ability' : 'First +1'}
                      <select
                        className="sheet-select"
                        value={asiPrimary}
                        onChange={(e) => setAsiPrimary(e.target.value as Ability | '')}
                      >
                        <option value="">Choose…</option>
                        {ABILITIES.map((a) => (
                          <option key={a} value={a}>
                            {ABILITY_LABELS[a]} (
                            {previewScore(
                              character.abilityScores[a],
                              a,
                              asiMode,
                              asiPrimary,
                              asiSecondary,
                              'primary'
                            )}
                            )
                          </option>
                        ))}
                      </select>
                    </label>
                    {asiMode === '+1+1' ? (
                      <label>
                        Second +1
                        <select
                          className="sheet-select"
                          value={asiSecondary}
                          onChange={(e) => setAsiSecondary(e.target.value as Ability | '')}
                        >
                          <option value="">Choose…</option>
                          {ABILITIES.filter((a) => a !== asiPrimary).map((a) => (
                            <option key={a} value={a}>
                              {ABILITY_LABELS[a]} ({character.abilityScores[a]} →{' '}
                              {character.abilityScores[a] + 1})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="level-up-feat-picker">
                  <input
                    type="search"
                    className="sheet-select"
                    placeholder="Search feats…"
                    value={featQuery}
                    onChange={(e) => setFeatQuery(e.target.value)}
                  />
                  <div className="level-up-feat-list">
                    {filteredFeats.map((f) => (
                      <button
                        key={`${f.name}|${f.source}`}
                        type="button"
                        className={`optional-feature-chip ${
                          selectedFeat?.name === f.name && selectedFeat?.source === f.source
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => setSelectedFeat(f)}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {error ? <p className="level-up-error">{error}</p> : null}
        </div>

        <div className="sheet-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            Confirm level {analysis.toLevel}
          </button>
        </div>
      </div>
    </div>
  )
}

function previewScore(
  score: number,
  ability: Ability,
  mode: '+2' | '+1+1',
  primary: Ability | '',
  secondary: Ability | '',
  which: 'primary' | 'secondary'
): string {
  if (mode === '+2' && primary === ability) return `${score} → ${Math.min(20, score + 2)}`
  if (mode === '+1+1') {
    if (which === 'primary' && primary === ability) return `${score} → ${Math.min(20, score + 1)}`
    if (which === 'secondary' && secondary === ability) return `${score} → ${Math.min(20, score + 1)}`
  }
  return String(score)
}
