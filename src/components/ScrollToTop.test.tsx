import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { ScrollToTop } from './ScrollToTop'

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <nav>
        <Link to="/">Home</Link>
        <Link to="/goals">Goals</Link>
        <Link to="/settings#sync">Sync</Link>
      </nav>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/goals" element={<div>Goals</div>} />
        <Route path="/settings" element={<div>Settings</div>} />
      </Routes>
    </>
  )
}

describe('ScrollToTop', () => {
  const scrollTo = vi.fn()

  beforeEach(() => {
    scrollTo.mockReset()
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollTo,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls to top on initial load and when navigating to another section', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    scrollTo.mockClear()

    act(() => {
      screen.getByRole('link', { name: 'Goals' }).click()
    })

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('does not force scroll-to-top for hash deep-links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    scrollTo.mockClear()

    act(() => {
      screen.getByRole('link', { name: 'Sync' }).click()
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
