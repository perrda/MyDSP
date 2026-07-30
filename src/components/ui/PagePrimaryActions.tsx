import { Plus } from 'lucide-react'
import { OverflowMenu, type OverflowMenuItem } from './OverflowMenu'

type PagePrimaryActionsProps = {
  /** Primary create label shown on the leading button (e.g. New Task). */
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  /** Accessible name for the ⋯ menu. */
  menuLabel: string
  /** Secondary actions (New List, Import, Export, …). */
  items?: OverflowMenuItem[]
  /**
   * Keep secondary actions behind ⋯ at every breakpoint (default true).
   * Prevents page-header action clusters from crushing titles on resize.
   */
  compact?: boolean
  className?: string
}

/**
 * Content-first create chrome: primary Add in the page header + optional ⋯ menu.
 * Replaces fixed bottom `.thumb-cta-bar` create clusters on phone.
 * Secondary items stay compact by default so browser resize never overlaps copy.
 */
export function PagePrimaryActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  menuLabel,
  items = [],
  compact = true,
  className = '',
}: PagePrimaryActionsProps) {
  const leading = (
    <button
      type="button"
      className="btn-primary btn-sm inline-flex items-center gap-1.5"
      data-testid="page-primary-create"
      disabled={primaryDisabled}
      onClick={onPrimary}
    >
      <Plus size={16} strokeWidth={2} aria-hidden />
      {primaryLabel}
    </button>
  )

  if (items.length === 0) {
    return (
      <div className={`page-primary-actions ${className}`.trim()} data-testid="page-primary-actions">
        {leading}
      </div>
    )
  }

  return (
    <div className={`page-primary-actions ${className}`.trim()} data-testid="page-primary-actions">
      <OverflowMenu compact={compact} label={menuLabel} leading={leading} items={items} />
    </div>
  )
}
