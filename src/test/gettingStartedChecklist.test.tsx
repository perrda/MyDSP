import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const portfolioState = {
  data: {
    settings: { taxResidency: '' as string },
    journal: [] as { id: number }[],
    disposals: [] as { id: number }[],
    todoItems: [] as { id: number }[],
  },
}

vi.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => portfolioState,
}))

vi.mock('../services/sync/syncService', () => ({
  loadSyncConfig: () => ({
    enabled: false,
    remoteUrl: '',
    rememberPassphrase: false,
  }),
}))

vi.mock('../services/sync/sessionPassphrase', () => ({
  getSessionSyncPassphrase: () => null,
  hasRememberedSyncPassphrase: () => false,
}))

describe('GettingStartedChecklist', () => {
  beforeEach(async () => {
    localStorage.clear()
    portfolioState.data = {
      settings: { taxResidency: '' },
      journal: [],
      disposals: [],
      todoItems: [],
    }
    cleanup()
    vi.resetModules()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders incomplete checklist and dismisses without hooks crash', async () => {
    const { GettingStartedChecklist } = await import('../components/GettingStartedChecklist')
    render(
      <MemoryRouter>
        <GettingStartedChecklist />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /Make MyDSP yours/i })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss getting started'))
    expect(screen.queryByRole('heading', { name: /Make MyDSP yours/i })).toBeNull()
    expect(localStorage.getItem('mydsp_getting_started_dismissed')).toBe('1')
  })

  it('auto-hides when all steps complete without hooks crash', async () => {
    portfolioState.data = {
      settings: { taxResidency: 'GB' },
      journal: [{ id: 1 }],
      disposals: [],
      todoItems: [{ id: 1 }],
    }
    // Override sync mocks for this case via dynamic import after redefining — use vi.doMock
    vi.doMock('../services/sync/syncService', () => ({
      loadSyncConfig: () => ({
        enabled: true,
        remoteUrl: 'https://mydsp-sync.example.workers.dev',
        rememberPassphrase: true,
      }),
    }))
    vi.doMock('../services/sync/sessionPassphrase', () => ({
      getSessionSyncPassphrase: () => 'long-enough-pass',
      hasRememberedSyncPassphrase: () => true,
    }))

    const { GettingStartedChecklist } = await import('../components/GettingStartedChecklist')
    const { container, rerender } = render(
      <MemoryRouter>
        <GettingStartedChecklist />
      </MemoryRouter>,
    )
    // Force a re-render after auto-dismiss effect
    rerender(
      <MemoryRouter>
        <GettingStartedChecklist />
      </MemoryRouter>,
    )
    expect(container.querySelector('#getting-started-heading')).toBeNull()
  })
})
