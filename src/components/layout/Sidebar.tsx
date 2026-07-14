import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Coins,
  TrendingUp,
  Landmark,
  Target,
  ArrowLeftRight,
  Settings,
  Menu,
  X,
  Upload,
  Scale,
  Flame,
  Receipt,
  BarChart3,
  BookOpen,
  Wallet,
  Repeat,
  CalendarRange,
  Plane,
  Tags,
  LineChart,
  Trophy,
  Layers,
  Users,
  History,
  FileText,
  GitCompareArrows,
  ListChecks,
  Briefcase,
  RefreshCw,
  CandlestickChart,
  type LucideIcon,
} from 'lucide-react'
import { BrandMark } from '../BrandMark'
import { ReorderHandle, ReorderList } from '../ui/Reorderable'
import { loadNavOrder, saveNavOrder } from '../../storage/navOrder'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const DEFAULT_LINKS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/crypto', label: 'Crypto', icon: Coins },
  { to: '/equities', label: 'Equities', icon: TrendingUp },
  { to: '/staking', label: 'Staking', icon: Layers },
  { to: '/liabilities', label: 'Liabilities', icon: Landmark },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/spending', label: 'Spending', icon: ArrowLeftRight },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/review', label: 'Monthly review', icon: CalendarRange },
  { to: '/trips', label: 'Trips & splits', icon: Plane },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/history', label: 'History', icon: History },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/todos', label: 'To Do Lists', icon: ListChecks },
  { to: '/jobs', label: 'Job Tracker', icon: Briefcase },
  { to: '/import', label: 'Import CSV', icon: Upload },
  { to: '/rules', label: 'Merchant rules', icon: Tags },
  { to: '/optimizer', label: 'Debt tools', icon: Scale },
  { to: '/fire', label: 'FIRE', icon: Flame },
  { to: '/planning', label: 'Rebalance / MC', icon: LineChart },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/tax', label: 'UK CGT', icon: Receipt },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/insights', label: 'Smart Insights', icon: LineChart },
  { to: '/api', label: 'API & Automation', icon: Layers },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const DEFAULT_PATHS = DEFAULT_LINKS.map((l) => l.to)

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [order, setOrder] = useState(() => loadNavOrder(DEFAULT_PATHS))

  useEffect(() => {
    const sync = () => setOrder(loadNavOrder(DEFAULT_PATHS))
    window.addEventListener('mydsp-nav-order', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('mydsp-nav-order', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const links = useMemo(() => {
    const map = new Map(DEFAULT_LINKS.map((l) => [l.to, l]))
    return order.map((to) => map.get(to)).filter((l): l is NavItem => Boolean(l))
  }, [order])

  const onReorder = (next: NavItem[]) => {
    const paths = next.map((l) => l.to)
    if (!paths.includes('/settings')) paths.push('/settings')
    setOrder(paths)
    saveNavOrder(paths)
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[min(20rem,88%)]
          bg-bg-elevated border-r border-border
          flex flex-col
          transition-transform duration-300 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          lg:static lg:z-auto lg:w-60 xl:w-64 lg:max-w-none lg:translate-x-0 lg:pt-0 lg:pb-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <BrandMark size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <p className="wordmark text-lg leading-none text-text">
                M<span className="text-[0.85em] font-semibold tracking-normal">y</span>DSP
              </p>
              <span className="text-[10px] font-light text-white light:text-black/50 tabular-nums shrink-0">
                v{__APP_VERSION__}
              </span>
            </div>
            <p className="label-uppercase mt-1.5 text-[10px]">Personal finance</p>
          </div>
          <button
            type="button"
            className="lg:hidden w-9 h-9 flex items-center justify-center border border-border-strong text-text-muted hover:text-accent hover:border-accent"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-1 space-y-1 border-b border-border">
          <NavLink
            to="/settings#sync"
            onClick={onClose}
            className={({ isActive }) => `nav-link nav-link-flex ${isActive ? 'active' : ''}`}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
            Cloud Sync
          </NavLink>
          <NavLink
            to="/settings"
            end
            onClick={onClose}
            className={({ isActive }) => `nav-link nav-link-flex ${isActive ? 'active' : ''}`}
          >
            <Settings size={16} strokeWidth={1.5} />
            Settings
          </NavLink>
        </div>

        <p className="px-5 pt-3 text-[10px] font-bold uppercase tracking-widest text-text-subtle">
          Drag ⋮⋮ to reorder
        </p>

        <nav className="flex-1 py-2 overflow-y-auto" aria-label="Primary">
          <ReorderList
            items={links.filter((l) => l.to !== '/settings')}
            getId={(l) => l.to}
            onReorder={onReorder}
            className="flex flex-col"
          >
            {(link) => {
              const Icon = link.icon
              return (
                <div className="nav-reorder-item">
                  <ReorderHandle label={`Reorder ${link.label}`} />
                  <NavLink
                    to={link.to}
                    end={link.end}
                    onClick={onClose}
                    className={({ isActive }) => `nav-link nav-link-flex ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    {link.label}
                  </NavLink>
                </div>
              )
            }}
          </ReorderList>
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-[11px] text-text-subtle font-light">MyDSP · local-first</p>
        </div>
      </aside>
    </>
  )
}

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      className="toolbar-icon lg:hidden"
    >
      <Menu size={18} strokeWidth={1.5} />
    </button>
  )
}
