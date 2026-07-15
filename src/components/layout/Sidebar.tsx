import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  Newspaper,
  Video,
  Star,
  ChevronDown,
  ArrowUpDown,
  type LucideIcon,
} from 'lucide-react'
import { BrandMark } from '../BrandMark'
import { ReorderHandle, ReorderList } from '../ui/Reorderable'
import {
  loadNavLayout,
  saveNavLayout,
  type NavLayout,
} from '../../storage/navOrder'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const DEFAULT_LINKS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/youtube', label: 'YouTube', icon: Video },
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
const LINK_MAP = new Map(DEFAULT_LINKS.map((l) => [l.to, l]))

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function pathsToItems(paths: string[]): NavItem[] {
  return paths.map((to) => LINK_MAP.get(to)).filter((l): l is NavItem => Boolean(l))
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [layout, setLayout] = useState<NavLayout>(() => loadNavLayout(DEFAULT_PATHS))
  const [sorting, setSorting] = useState(false)
  const { pathname, hash } = useLocation()
  const syncActive = pathname === '/settings' && hash === '#sync'
  const settingsActive = pathname === '/settings' && hash !== '#sync'

  useEffect(() => {
    const sync = () => setLayout(loadNavLayout(DEFAULT_PATHS))
    window.addEventListener('mydsp-nav-order', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('mydsp-nav-order', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const favourites = useMemo(() => pathsToItems(layout.favourites), [layout.favourites])
  const others = useMemo(() => pathsToItems(layout.others), [layout.others])

  const persist = (next: NavLayout) => {
    setLayout(next)
    saveNavLayout(next)
  }

  const onReorderFavourites = (next: NavItem[]) => {
    persist({ ...layout, favourites: next.map((l) => l.to) })
  }

  const onReorderOthers = (next: NavItem[]) => {
    persist({ ...layout, others: next.map((l) => l.to) })
  }

  const addToFavourites = (to: string) => {
    if (layout.favourites.includes(to)) return
    persist({
      ...layout,
      favourites: [...layout.favourites, to],
      others: layout.others.filter((p) => p !== to),
    })
  }

  const removeFromFavourites = (to: string) => {
    if (!layout.favourites.includes(to)) return
    persist({
      ...layout,
      favourites: layout.favourites.filter((p) => p !== to),
      others: [...layout.others.filter((p) => p !== to), to],
    })
  }

  const othersOpen = sorting || !layout.othersCollapsed

  const renderRow = (link: NavItem, zone: 'favourites' | 'others') => {
    const Icon = link.icon
    const isFav = zone === 'favourites'
    return (
      <div className={`nav-reorder-item ${sorting ? 'is-sorting' : ''}`}>
        {sorting ? <ReorderHandle label={`Reorder ${link.label}`} /> : null}
        <NavLink
          to={link.to}
          end={link.end}
          onClick={onClose}
          className={({ isActive }) => `nav-link nav-link-flex ${isActive ? 'active' : ''}`}
        >
          <Icon size={16} strokeWidth={1.5} />
          {link.label}
        </NavLink>
        {sorting ? (
          <button
            type="button"
            className={`nav-fav-toggle ${isFav ? 'is-fav' : ''}`}
            aria-label={isFav ? `Remove ${link.label} from Favourites` : `Add ${link.label} to Favourites`}
            title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (isFav) removeFromFavourites(link.to)
              else addToFavourites(link.to)
            }}
          >
            <Star size={15} strokeWidth={1.75} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        ) : null}
      </div>
    )
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
              <span className="text-[11px] font-light text-white light:text-black/50 tabular-nums shrink-0">
                v{__APP_VERSION__}
              </span>
            </div>
            <p className="label-uppercase mt-1.5 text-[11px]">Personal finance</p>
          </div>
          <button
            type="button"
            className="lg:hidden w-11 h-11 flex items-center justify-center border border-border-strong text-text-muted hover:text-accent hover:border-accent"
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
            className={`nav-link nav-link-flex ${syncActive ? 'active' : ''}`}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
            Cloud Sync
          </NavLink>
          <NavLink
            to="/settings"
            end
            onClick={onClose}
            className={`nav-link nav-link-flex ${settingsActive ? 'active' : ''}`}
          >
            <Settings size={16} strokeWidth={1.5} />
            Settings
          </NavLink>
        </div>

        <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle px-2">
            Menu
          </p>
          <button
            type="button"
            className={`nav-sort-toggle ${sorting ? 'is-active' : ''}`}
            aria-pressed={sorting}
            aria-label={sorting ? 'Done sorting menu' : 'Sort menu sections'}
            title={sorting ? 'Done' : 'Sort / Favourites'}
            onClick={() => {
              setSorting((v) => {
                const next = !v
                if (next && layout.othersCollapsed) {
                  persist({ ...layout, othersCollapsed: false })
                }
                return next
              })
            }}
          >
            <ArrowUpDown size={14} strokeWidth={1.75} />
            <span>{sorting ? 'Done' : 'Sort'}</span>
          </button>
        </div>

        {sorting ? (
          <p className="px-5 pb-2 text-[11px] text-text-muted leading-snug">
            Drag ⋮⋮ to reorder. Tap ★ to move between Favourites and Others.
          </p>
        ) : null}

        <nav className="flex-1 py-1 overflow-y-auto" aria-label="Primary">
          <div className="px-3 pb-1">
            <p className="nav-section-label">
              <Star size={11} strokeWidth={2} className="text-accent" aria-hidden />
              Favourites
              <span className="tabular-nums text-text-subtle font-normal normal-case tracking-normal">
                {favourites.length}
              </span>
            </p>
          </div>

          {favourites.length === 0 ? (
            <p className="px-5 py-3 text-xs text-text-muted">
              {sorting
                ? 'Star items below to pin them here.'
                : 'Tap Sort, then ★ to pin sections here.'}
            </p>
          ) : sorting ? (
            <ReorderList
              items={favourites}
              getId={(l) => l.to}
              onReorder={onReorderFavourites}
              className="flex flex-col"
            >
              {(link) => renderRow(link, 'favourites')}
            </ReorderList>
          ) : (
            <ul className="flex flex-col">
              {favourites.map((link) => (
                <li key={link.to}>{renderRow(link, 'favourites')}</li>
              ))}
            </ul>
          )}

          <div className="px-3 pt-3 pb-1">
            <button
              type="button"
              className="nav-section-label nav-section-toggle w-full"
              aria-expanded={othersOpen}
              onClick={() => {
                if (sorting) return
                persist({ ...layout, othersCollapsed: !layout.othersCollapsed })
              }}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                Others
                <span className="tabular-nums text-text-subtle font-normal normal-case tracking-normal">
                  {others.length}
                </span>
              </span>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className={`shrink-0 transition-transform ${othersOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
          </div>

          {othersOpen ? (
            others.length === 0 ? (
              <p className="px-5 py-3 text-xs text-text-muted">All sections are in Favourites.</p>
            ) : sorting ? (
              <ReorderList
                items={others}
                getId={(l) => l.to}
                onReorder={onReorderOthers}
                className="flex flex-col pb-2"
              >
                {(link) => renderRow(link, 'others')}
              </ReorderList>
            ) : (
              <ul className="flex flex-col pb-2">
                {others.map((link) => (
                  <li key={link.to}>{renderRow(link, 'others')}</li>
                ))}
              </ul>
            )
          ) : null}
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
      title="Menu"
      className="toolbar-icon toolbar-menu-btn lg:hidden"
    >
      <Menu size={18} strokeWidth={1.5} />
    </button>
  )
}
