import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToolbarControls } from '../components/layout/ToolbarControls'

vi.mock('../components/SmartNotifications', () => ({
  NotificationCenter: () => (
    <button type="button" className="toolbar-icon" aria-label="Notifications" title="Notifications">
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

  it('keeps portfolio, currency, Refresh and More on the primary strip', () => {
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
    expect(screen.getByLabelText('Refresh all data')).toBeInTheDocument()
    expect(screen.getByLabelText('More workspace controls')).toBeInTheDocument()
    expect(screen.queryByLabelText('Notifications')).toBeNull()
    expect(screen.queryByLabelText('News and YouTube')).toBeNull()
  })

  it('puts the bell inside the More menu as the first icon (no caption row)', () => {
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
    expect(screen.queryByText(/Refresh · Privacy · Theme · Glass · Search/i)).toBeNull()
    expect(screen.queryByText(/PRIVACY/i)).toBeNull()
    expect(screen.queryByText(/NOTIFICATIONS/i)).toBeNull()

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    expect(screen.getByLabelText('Refresh all data')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Refresh all data'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not offer a bottom-tab editor — nav is fixed five doors', () => {
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

    fireEvent.click(screen.getByLabelText('More workspace controls'))
    expect(screen.queryByRole('menuitem', { name: 'Edit bottom tabs' })).toBeNull()
  })
})
