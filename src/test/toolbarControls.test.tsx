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
    expect(screen.getAllByLabelText('Notifications').length).toBeGreaterThanOrEqual(1)
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

    // Primary strip should not expose Refresh until More is opened (mobile path
    // still mounts the desktop refresh in a display:none container in jsdom —
    // assert via the menu instead).
    fireEvent.click(screen.getByLabelText('More workspace controls'))
    expect(screen.getByRole('menu', { name: 'Workspace actions' })).toBeInTheDocument()
    expect(screen.getByText(/Refresh · Privacy · Theme · Search/i)).toBeInTheDocument()

    const refreshButtons = screen.getAllByLabelText('Refresh all data')
    expect(refreshButtons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(refreshButtons[refreshButtons.length - 1])
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
