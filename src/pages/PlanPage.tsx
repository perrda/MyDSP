import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { PLAN_DOORS } from '../domain/hubPages'
import {
  loadHubLayout,
  orderHubDoors,
  saveHubLayout,
  subscribeHubLayout,
} from '../storage/hubLayoutStore'

export function PlanPage() {
  const [hubLayout, setHubLayout] = useState(loadHubLayout)
  useEffect(() => subscribeHubLayout(() => setHubLayout(loadHubLayout())), [])
  const doors = useMemo(
    () => orderHubDoors(PLAN_DOORS, hubLayout.planDoors),
    [hubLayout.planDoors],
  )

  return (
    <div>
      <PageHeader eyebrow="Plan" title="Plan" />
      <ReorderList
        items={doors}
        getId={(door) => door.to}
        onReorder={(next) => {
          setHubLayout(saveHubLayout({ planDoors: next.map((d) => d.to) }))
        }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-px"
        itemClassName="min-w-0"
      >
        {(door) => (
          <div className="hub-tile surface surface-interactive p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none min-w-0">
            <ReorderHandle label={`Reorder ${door.label}`} />
            <Link to={door.to} className="hub-tile__link min-w-0 flex-1 block">
              <p className="text-sm font-semibold tracking-tight truncate">{door.label}</p>
              <p className="text-xs text-text-muted font-light mt-1">{door.detail}</p>
            </Link>
          </div>
        )}
      </ReorderList>
    </div>
  )
}
