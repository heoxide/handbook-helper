import { useEffect, useMemo, useState } from 'react'
import type { CompendiumEntry } from '../../../shared/types'
import {
  ABILITIES,
  ABILITY_NAMES,
  type Ability,
  formatSkillName,
  isSkillInList
} from '../../../shared/character'
import {
  analyzeFeatChoices,
  autoGrantFromFeat,
  displayFeatChoiceSummary,
  formatOriginFeatLabel,
  GENERAL_TOOLS,
  type BackgroundFeatRef,
  type CreatorEdition,
  type FeatChoiceRequirement,
  type OriginFeatChoices,
  type OriginFeatSelection,
  STANDARD_SKILLS
} from '../../../shared/origin-feat'
import { EntryDescription } from './EntryDescription'

function emptyChoices(): OriginFeatChoices {
  return { skills: [], tools: [], languages: [], weapons: [] }
}

function toggleInList(list: string[], value: string, max: number): string[] {
  const has = list.some((x) => x.toLowerCase() === value.toLowerCase())
  if (has) return list.filter((x) => x.toLowerCase() !== value.toLowerCase())
  if (list.length >= max) return list
  return [...list, value]
}

function FeatChoicePanel({
  featRef,
  featDetail,
  selection,
  categoryFeats,
  spellOptions,
  onChange
}: {
  featRef: BackgroundFeatRef
  featDetail: Record<string, unknown> | null
  selection: OriginFeatSelection | undefined
  categoryFeats: CompendiumEntry[]
  spellOptions: { cantrips: CompendiumEntry[]; spells: CompendiumEntry[] }
  onChange: (sel: OriginFeatSelection) => void
}) {
  const choices = selection?.choices ?? emptyChoices()
  const grants = featDetail ? autoGrantFromFeat(featDetail, featRef.variant) : emptyChoices()
  const requirements = featDetail ? analyzeFeatChoices(featDetail, featRef.variant) : [{ kind: 'none' as const }]

  const update = (patch: Partial<OriginFeatChoices>) => {
    onChange({
      refId: featRef.id,
      name: featRef.type === 'category' ? (patch.categoryFeat?.name ?? featRef.name) : featRef.name,
      source: featRef.type === 'category' ? (patch.categoryFeat?.source ?? featRef.source) : featRef.source,
      variant: featRef.variant,
      choices: {
        ...choices,
        ...patch,
        languages: [...(choices.languages ?? []), ...(grants.languages ?? [])].filter(
          (v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i
        ),
        weapons: [...(choices.weapons ?? []), ...(grants.weapons ?? [])].filter(
          (v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i
        )
      }
    })
  }

  if (featRef.type === 'category') {
    const label = featRef.categories?.includes('DG') ? 'Dark Gift' : 'Feat'
    return (
      <div className="origin-feat-block">
        <h3>Choose a {label}</h3>
        <p className="hint-text">Your background grants an additional {label.toLowerCase()} of your choice.</p>
        <div className="option-grid">
          {categoryFeats.map((feat) => {
            const selected = choices.categoryFeat?.name === feat.name && choices.categoryFeat?.source === feat.source
            return (
              <button
                key={feat.id}
                type="button"
                className={`option-card ${selected ? 'selected' : ''}`}
                onClick={() =>
                  update({
                    categoryFeat: { name: feat.name, source: feat.source }
                  })
                }
              >
                <div className="name">{feat.name}</div>
                <div className="source">{feat.sourceName ?? feat.source}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="origin-feat-block">
      <h3>{formatOriginFeatLabel(featRef)}</h3>
      {featDetail && (
        <div className="origin-feat-description">
          <EntryDescription detail={featDetail} />
        </div>
      )}

      {requirements.map((req, idx) => (
        <FeatRequirementPicker
          key={`${featRef.id}-${req.kind}-${idx}`}
          req={req}
          choices={choices}
          spellOptions={spellOptions}
          onUpdate={update}
        />
      ))}

      {displayFeatChoiceSummary(choices).length > 0 && (
        <div className="origin-feat-summary">
          {displayFeatChoiceSummary(choices).map((line) => (
            <p key={line} className="hint-text">{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function FeatRequirementPicker({
  req,
  choices,
  spellOptions,
  onUpdate
}: {
  req: FeatChoiceRequirement
  choices: OriginFeatChoices
  spellOptions: { cantrips: CompendiumEntry[]; spells: CompendiumEntry[] }
  onUpdate: (patch: Partial<OriginFeatChoices>) => void
}) {
  switch (req.kind) {
    case 'skills-or-tools': {
      const picked = (choices.skills?.length ?? 0) + (choices.tools?.length ?? 0)
      const max = req.count ?? 3
      return (
        <div className="feat-choice-section">
          <h4>Choose {max} skills or tools ({picked}/{max})</h4>
          <p className="hint-text">Skills</p>
          <div className="skill-grid">
            {STANDARD_SKILLS.map((skill) => {
              const selected = isSkillInList(skill, choices.skills ?? [])
              const disabled = !selected && picked >= max
              return (
                <button
                  key={skill}
                  type="button"
                  className={`skill-chip ${selected ? 'selected' : ''}`}
                  disabled={disabled}
                  onClick={() =>
                    onUpdate({
                      skills: toggleInList(choices.skills ?? [], skill, max - (choices.tools?.length ?? 0))
                    })
                  }
                >
                  {formatSkillName(skill)}
                </button>
              )
            })}
          </div>
          <p className="hint-text">Tools</p>
          <div className="skill-grid">
            {GENERAL_TOOLS.map((tool) => {
              const selected = (choices.tools ?? []).some((t) => t.toLowerCase() === tool.toLowerCase())
              const disabled = !selected && picked >= max
              return (
                <button
                  key={tool}
                  type="button"
                  className={`skill-chip ${selected ? 'selected' : ''}`}
                  disabled={disabled}
                  onClick={() =>
                    onUpdate({
                      tools: toggleInList(choices.tools ?? [], tool, max - (choices.skills?.length ?? 0))
                    })
                  }
                >
                  {formatSkillName(tool)}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'tools': {
      const options = req.toolOptions ?? []
      const max = req.count ?? 1
      const picked = choices.tools?.length ?? 0
      return (
        <div className="feat-choice-section">
          <h4>Choose {max} tool{max > 1 ? 's' : ''} ({picked}/{max})</h4>
          <div className="skill-grid">
            {options.map((tool) => {
              const selected = (choices.tools ?? []).some((t) => t.toLowerCase() === tool.toLowerCase())
              const disabled = !selected && picked >= max
              return (
                <button
                  key={tool}
                  type="button"
                  className={`skill-chip ${selected ? 'selected' : ''}`}
                  disabled={disabled}
                  onClick={() => onUpdate({ tools: toggleInList(choices.tools ?? [], tool, max) })}
                >
                  {formatSkillName(tool)}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'skill-one': {
      const options = req.skillOptions ?? []
      return (
        <div className="feat-choice-section">
          <h4>Choose a skill</h4>
          <div className="skill-grid">
            {options.map((skill) => {
              const selected = isSkillInList(skill, choices.skills ?? [])
              return (
                <button
                  key={skill}
                  type="button"
                  className={`skill-chip ${selected ? 'selected' : ''}`}
                  onClick={() => onUpdate({ skills: [skill] })}
                >
                  {formatSkillName(skill)}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'spell-ability':
      return (
        <div className="feat-choice-section">
          <h4>Spellcasting ability</h4>
          <div className="boost-pickers">
            {ABILITIES.map((ab) => (
              <button
                key={ab}
                type="button"
                className={`skill-chip ${choices.spellAbility === ab ? 'selected' : ''}`}
                onClick={() => onUpdate({ spellAbility: ab })}
              >
                {ABILITY_NAMES[ab]}
              </button>
            ))}
          </div>
        </div>
      )
    case 'cantrips': {
      const max = req.cantripCount ?? 2
      const picked = choices.cantrips?.length ?? 0
      return (
        <div className="feat-choice-section">
          <h4>Choose {max} cantrip{max > 1 ? 's' : ''} ({picked}/{max})</h4>
          <div className="skill-grid">
            {spellOptions.cantrips.map((spell) => {
              const selected = choices.cantrips?.some(
                (s) => s.name === spell.name && s.source === spell.source
              )
              const disabled = !selected && picked >= max
              return (
                <button
                  key={spell.id}
                  type="button"
                  className={`skill-chip ${selected ? 'selected' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    const current = choices.cantrips ?? []
                    const ref = { name: spell.name, source: spell.source }
                    const has = current.some((s) => s.name === spell.name && s.source === spell.source)
                    onUpdate({
                      cantrips: has
                        ? current.filter((s) => !(s.name === spell.name && s.source === spell.source))
                        : current.length >= max
                          ? current
                          : [...current, ref]
                    })
                  }}
                >
                  {spell.name}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'spells': {
      const max = req.spellCount ?? 1
      const picked = choices.spells?.length ?? 0
      return (
        <div className="feat-choice-section">
          <h4>Choose {max} level-1 spell{max > 1 ? 's' : ''} ({picked}/{max})</h4>
          <div className="skill-grid">
            {spellOptions.spells.map((spell) => {
              const selected = choices.spells?.some(
                (s) => s.name === spell.name && s.source === spell.source
              )
              const disabled = !selected && picked >= max
              return (
                <button
                  key={spell.id}
                  type="button"
                  className={`skill-chip ${selected ? 'selected' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    const current = choices.spells ?? []
                    const ref = { name: spell.name, source: spell.source }
                    const has = current.some((s) => s.name === spell.name && s.source === spell.source)
                    onUpdate({
                      spells: has
                        ? current.filter((s) => !(s.name === spell.name && s.source === spell.source))
                        : current.length >= max
                          ? current
                          : [...current, ref]
                    })
                  }}
                >
                  {spell.name}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'none':
      return null
    default:
      return null
  }
}

export function OriginFeatStep({
  refs,
  selections,
  featDetails,
  categoryFeats,
  sourceCodes,
  creatorEdition,
  step,
  navigateStep,
  canProceed,
  onSelectionsChange,
  embedded = false
}: {
  refs: BackgroundFeatRef[]
  selections: OriginFeatSelection[]
  featDetails: Record<string, Record<string, unknown>>
  categoryFeats: CompendiumEntry[]
  sourceCodes: string[]
  creatorEdition: CreatorEdition
  step: number
  navigateStep: (direction: 1 | -1) => void
  canProceed: boolean
  onSelectionsChange: (selections: OriginFeatSelection[]) => void
  embedded?: boolean
}) {
  const [spellOptions, setSpellOptions] = useState<{
    cantrips: CompendiumEntry[]
    spells: CompendiumEntry[]
  }>({ cantrips: [], spells: [] })

  const spellClass = useMemo(() => {
    for (const ref of refs) {
      if (ref.variant) return ref.variant.charAt(0).toUpperCase() + ref.variant.slice(1)
      const detail = featDetails[ref.id]
      if (!detail) continue
      const reqs = analyzeFeatChoices(detail, ref.variant)
      const spellReq = reqs.find((r) => r.spellClass)
      if (spellReq?.spellClass) return spellReq.spellClass
    }
    return null
  }, [refs, featDetails])

  useEffect(() => {
    if (!spellClass) {
      setSpellOptions({ cantrips: [], spells: [] })
      return
    }
    void window.handbook.data.getClassSpells(spellClass, sourceCodes, creatorEdition).then(async (list) => {
      const cantrips: CompendiumEntry[] = []
      const spells: CompendiumEntry[] = []
      for (const s of list) {
        const detail = (await window.handbook.data.getDetail('spell', s.name, s.source)) as {
          level?: number
        } | null
        const level = detail?.level ?? s.level
        const entry: CompendiumEntry = {
          id: `spell-${s.name}-${s.source}`,
          name: s.name,
          source: s.source,
          type: 'spell',
          level
        }
        if (level === 0) cantrips.push(entry)
        else if (level === 1) spells.push(entry)
      }
      cantrips.sort((a, b) => a.name.localeCompare(b.name))
      spells.sort((a, b) => a.name.localeCompare(b.name))
      setSpellOptions({ cantrips, spells })
    })
  }, [spellClass, sourceCodes, creatorEdition])

  const updateSelection = (sel: OriginFeatSelection) => {
    const next = [...selections]
    const idx = next.findIndex((s) => s.refId === sel.refId)
    if (idx >= 0) next[idx] = sel
    else next.push(sel)
    onSelectionsChange(next)
  }

  const panels = refs.map((ref) => (
    <FeatChoicePanel
      key={ref.id}
      featRef={ref}
      featDetail={ref.type === 'category' ? null : featDetails[ref.id] ?? null}
      selection={selections.find((s) => s.refId === ref.id)}
      categoryFeats={categoryFeats}
      spellOptions={spellOptions}
      onChange={updateSelection}
    />
  ))

  if (embedded) {
    return <div className="origin-feat-scroll">{panels}</div>
  }

  if (!refs.length) {
    return (
      <div className="creator-card">
        <h2>Step 4: Origin Feat</h2>
        <p className="hint-text">Your background does not grant a feat. Continue to species selection.</p>
        <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed} />
      </div>
    )
  }

  return (
    <div className="creator-card creator-card-picker">
      <div className="creator-card-header">
        <h2>Step 4: Origin Feat</h2>
        <p>Configure the feat granted by your background. Some feats require additional choices.</p>
      </div>
      <div className="creator-card-scroll origin-feat-scroll">
        {panels}
      </div>
      <div className="creator-card-footer">
        <NavButtons step={step} navigateStep={navigateStep} canProceed={canProceed} />
      </div>
    </div>
  )
}

function NavButtons({
  step,
  navigateStep,
  canProceed
}: {
  step: number
  navigateStep: (direction: 1 | -1) => void
  canProceed: boolean
}) {
  return (
    <div className="creator-actions">
      <button className="btn-secondary" style={{ width: 'auto' }} disabled={step === 0} onClick={() => navigateStep(-1)}>
        Back
      </button>
      <button className="btn-primary" style={{ width: 'auto' }} disabled={!canProceed} onClick={() => navigateStep(1)}>
        Next
      </button>
    </div>
  )
}
