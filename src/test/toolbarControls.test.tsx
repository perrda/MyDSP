import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToolbarControls } from '../components/layout/ToolbarControls'

vi.mock('../components/SmartNotifications', () => ({
  NotificationCenter: () => (
    <button type="button" className="toolbar-icon" aria-label="Notifications">
      Bell
    </button>
  ),
}))

vi.mock('../components/GlobalSearch', () => ({
  GlobalSearch: () => (
    <button type="button" className="toolbar-icon" aria-label="Search">
      Search
    </button>
  ),
}))

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => (
    <button type="button" className="toolbar-icon" aria-label="Toggle theme">
      Theme
    </button>
  ),
}))

vi.mock('../components/GlassToggle', () => ({
  GlassToggle: () => (
    <button type="button" className="toolbar-icon" aria-label="Toggle glass mode">
      Glass
    </button>
  ),
}))

describe('ToolbarControls', () => {
  beforeEach(() => {
    cleanup()
    // jsdom defaults to phone-width unless matchMedia is stubbed
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  const portfolio = (
    <label className="toolbar-field">
      <select aria-label="Active portfolio" className="toolbar-select toolbar-select-portfolio">
        <option>David</option>
      </select>
    </label>
  )
  const currency = (
    <label className="toolbar-field">
      <select aria-label="Display currency" className="toolbar-select toolbar-select-currency">
        <option>GBP</option>
      </select>
    </label>
  )

  it('keeps portfolio, currency, notifications and More on the primary strip', () => {
    render(
      <ToolbarControls
        portfolioSelect={portfolio}
        currencySelect={currency}
        refreshing={false}
        onRefresh={vi.fn()}
        privacy={false}
        onPrivacyToggle={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Active portfolio')).toBeInTheDocument()
    expect(screen.getByLabelText('Display currency')).toBeInTheDocument()
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    expect(screen.getByLabelText('More workspace controls')).toBeInTheDocument()
  })

  it('puts Refresh inside the More menu (not a fifth primary icon)', () => {
    const onRefresh = vi.fn()
    render(
      <ToolbarControls
        portfolioSelect={portfolio}
        currencySelect={currency}
        refreshing={false}
        onRefresh={onRefresh}
        privacy={false}
        onPrivacyToggle={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('More workspace controls'))
    expect(screen.getByRole('menu', { name: 'Workspace actions' })).toBeInTheDocument()
    expect(screen.getByText(/Refresh · Privacy · Theme · Glass · Search/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Refresh all data'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
