/** Edit / Buy / Sell switcher for holding create/edit sheets. */

export type HoldingActionMode = 'edit' | 'buy' | 'sell'

export function HoldingActionModeBar({
  mode,
  onChange,
}: {
  mode: HoldingActionMode
  onChange: (mode: HoldingActionMode) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Holding action">
      {(['edit', 'buy', 'sell'] as const).map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={mode === item}
          data-testid={`holding-action-${item}`}
          className={`btn-sm min-h-11 flex-1 ${mode === item ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange(item)}
        >
          {item === 'edit' ? 'Edit' : item === 'buy' ? 'Buy' : 'Sell'}
        </button>
      ))}
    </div>
  )
}
