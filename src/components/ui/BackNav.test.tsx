import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BackNav } from './BackNav'

describe('BackNav', () => {
  it('renders a link back to the parent route', () => {
    render(
      <MemoryRouter>
        <BackNav to="/todos" label="Back to all lists" />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /back to all lists/i })
    expect(link).toHaveAttribute('href', '/todos')
  })

  it('renders a button that clears in-page selection', () => {
    const onClick = vi.fn()
    render(<BackNav label="Back to all lists" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /back to all lists/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
