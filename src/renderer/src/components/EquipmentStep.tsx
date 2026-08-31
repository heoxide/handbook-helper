import {
  type EquipmentFilterPicks,
  type EquipmentSelections,
  type StartingEquipmentPlan
} from '../../../shared/starting-equipment'

function OptionCard({
  selected,
  label,
  items,
  onSelect
}: {
  selected: boolean
  label: string
  items: { label: string; quantity: number }[]
  onSelect: () => void
}) {
  return (
    <button type="button" className={`equipment-option-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="equipment-option-title">{label}</div>
      <ul className="equipment-option-items">
        {items.map((item) => (
          <li key={`${label}-${item.label}`}>
            {item.quantity > 1 ? `${item.quantity}× ` : ''}
            {item.label}
          </li>
        ))}
      </ul>
    </button>
  )
}

function PlanBlock({
  plan,
  selections,
  filterPicks,
  onSelectOption,
  onToggleFilterPick
}: {
  plan: StartingEquipmentPlan
  selections: EquipmentSelections
  filterPicks: EquipmentFilterPicks
  onSelectOption: (groupId: string, optionId: string) => void
  onToggleFilterPick: (groupId: string, label: string) => void
}) {
  if (!plan.groups.length && !plan.fixed.length && !plan.narrative.length) {
    return null
  }

  return (
    <div className="equipment-plan-block">
      <h3>{plan.title}</h3>
      {plan.narrative.map((line) => (
        <p key={line} className="hint-text">
          {line}
        </p>
      ))}
      {plan.fixed.length > 0 && (
        <div className="equipment-fixed-list">
          <h4>Included</h4>
          <ul>
            {plan.fixed.map((item) => (
              <li key={item.label}>
                {item.quantity > 1 ? `${item.quantity}× ` : ''}
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.groups.map((group) => {
        if (group.requiresOptionId && !Object.values(selections).includes(group.requiresOptionId)) {
          return null
        }
        if (group.type === 'single' && (group.options?.length ?? 0) <= 1) return null

        if (group.type === 'single') {
          return (
            <div key={group.id} className="equipment-choice-group">
              <h4>{group.prompt}</h4>
              <div className="equipment-option-grid">
                {group.options?.map((option) => (
                  <OptionCard
                    key={option.id}
                    selected={selections[group.id] === option.id}
                    label={option.label}
                    items={option.items}
                    onSelect={() => onSelectOption(group.id, option.id)}
                  />
                ))}
              </div>
            </div>
          )
        }

        const needed = group.pickCount ?? 1
        const picks = filterPicks[group.id] ?? []
        return (
          <div key={group.id} className="equipment-choice-group">
            <h4>
              {group.prompt} ({picks.length}/{needed})
            </h4>
            <div className="skill-grid">
              {(group.filterOptions ?? []).map((label) => {
                const selected = picks.includes(label)
                const disabled = !selected && picks.length >= needed
                return (
                  <button
                    key={label}
                    type="button"
                    className={`skill-chip ${selected ? 'selected' : ''}`}
                    disabled={disabled}
                    onClick={() => onToggleFilterPick(group.id, label)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function EquipmentStep({
  plans,
  selections,
  filterPicks,
  inventoryPreview,
  goldCp,
  step,
  navigateStep,
  canProceed,
  onSelectOption,
  onToggleFilterPick
}: {
  plans: StartingEquipmentPlan[]
  selections: EquipmentSelections
  filterPicks: EquipmentFilterPicks
  inventoryPreview: { label: string; quantity: number }[]
  goldCp: number
  step: number
  navigateStep: (direction: 1 | -1) => void
  canProceed: boolean
  onSelectOption: (groupId: string, optionId: string) => void
  onToggleFilterPick: (groupId: string, label: string) => void
}) {
  const hasContent = plans.some(
    (plan) => plan.groups.length > 0 || plan.fixed.length > 0 || plan.narrative.length > 0
  )

  return (
    <div className="creator-card creator-card-picker">
      <div className="creator-card-header">
        <h2>Step 9: Starting Equipment</h2>
        <p>Choose your class and background starting gear. Fixed items are added automatically.</p>
      </div>
      <div className="creator-card-scroll equipment-step-scroll">
        {!hasContent ? (
          <p className="hint-text">No starting equipment data found for this class and background.</p>
        ) : (
          plans.map((plan) => (
            <PlanBlock
              key={`${plan.source}-${plan.title}`}
              plan={plan}
              selections={selections}
              filterPicks={filterPicks}
              onSelectOption={onSelectOption}
              onToggleFilterPick={onToggleFilterPick}
            />
          ))
        )}

        {(inventoryPreview.length > 0 || goldCp > 0) && (
          <div className="equipment-preview">
            <h4>Inventory Preview</h4>
            {inventoryPreview.length > 0 && (
              <ul>
                {inventoryPreview.map((item) => (
                  <li key={item.label}>
                    {item.quantity > 1 ? `${item.quantity}× ` : ''}
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
            {goldCp > 0 && <p className="hint-text">Starting gold: {goldCp / 100} GP</p>}
          </div>
        )}
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
      <button
        className="btn-secondary"
        style={{ width: 'auto' }}
        disabled={step === 0}
        onClick={() => navigateStep(-1)}
      >
        Back
      </button>
      <button
        className="btn-primary"
        style={{ width: 'auto' }}
        disabled={!canProceed}
        onClick={() => navigateStep(1)}
      >
        Next
      </button>
    </div>
  )
}
