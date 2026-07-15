import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsSection } from './SettingsSection'
import { _resetSettingsSectionsForTests } from '../storage/settingsSectionsStore'

describe('SettingsSection', () => {
  beforeEach(() => {
    _resetSettingsSectionsForTests()
  })

  it('starts collapsed and expands on header click', () => {
    render(
      <SettingsSection id="display" eyebrow="Display" title="Currency & tax residency">
        <p>Body content</p>
      </SettingsSection>,
    )

    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.getByText('Currency & tax residency')).toBeInTheDocument()
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument()
  })
})
