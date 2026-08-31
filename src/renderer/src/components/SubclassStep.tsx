import type { SubclassOption } from '../../../shared/class-mechanics'

export function SubclassStep({
  subclasses,
  selectedEntry,
  step,
  canProceed,
  onSelect,
  navigateStep
}: {
  subclasses: SubclassOption[]
  selectedEntry: { name: string; source: string } | null
  step: number
  canProceed: boolean
  onSelect: (subclass: SubclassOption) => void
  navigateStep: (direction: 1 | -1) => void
}) {
  return (
    <div className="creator-card creator-card-picker">
      <div className="creator-card-header">
        <h2>Step 2: Choose Subclass</h2>
        <p>
          Your class chooses its subclass at 1st level. This choice defines your specialized training
          and features.
        </p>
      </div>
      <div className="creator-card-scroll">
        {subclasses.length === 0 ? (
          <p className="hint-text">No subclasses found for this class in your enabled source books.</p>
        ) : (
          <div className="option-grid option-grid-scroll">
            {subclasses.map((sub) => {
              const selected =
                selectedEntry?.name === sub.name && selectedEntry?.source === sub.source
              return (
                <button
                  key={`${sub.name}|${sub.source}`}
                  type="button"
                  className={`option-card ${selected ? 'selected' : ''}`}
                  onClick={() => onSelect(sub)}
                >
                  <div className="name">{sub.name}</div>
                  <div className="source">{sub.source}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="creator-card-footer">
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
      </div>
    </div>
  )
}
