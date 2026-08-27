import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { MONEY_DOORS } from '../domain/hubPages'

export function MoneyPage() {
  return (
    <div>
      <PageHeader eyebrow="Money" title="Money" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-px">
        {MONEY_DOORS.map((door) => (
          <Link
            key={door.to}
            to={door.to}
            className="surface surface-interactive p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none block min-w-0"
          >
            <p className="text-sm font-semibold tracking-tight truncate">{door.label}</p>
            <p className="text-xs text-text-muted font-light mt-1">{door.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
