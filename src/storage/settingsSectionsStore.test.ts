import { describe, it, expect, beforeEach } from 'vitest'
import {
  _resetSettingsSectionsForTests,
  isSettingsSectionOpen,
  openSettingsSection,
  setAllSettingsSectionsOpen,
  setSettingsSectionOpen,
} from './settingsSectionsStore'

describe('settingsSectionsStore', () => {
  beforeEach(() => {
    _resetSettingsSectionsForTests()
  })

  it('defaults sections to collapsed', () => {
    expect(isSettingsSectionOpen('sync')).toBe(false)
    expect(isSettingsSectionOpen('security')).toBe(false)
  })

  it('opens and closes a section', () => {
    setSettingsSectionOpen('display', true)
    expect(isSettingsSectionOpen('display')).toBe(true)
    setSettingsSectionOpen('display', false)
    expect(isSettingsSectionOpen('display')).toBe(false)
  })

  it('openSettingsSection forces open', () => {
    openSettingsSection('alerts')
    expect(isSettingsSectionOpen('alerts')).toBe(true)
  })

  it('expand/collapse all', () => {
    const ids = ['sync', 'display', 'security']
    setAllSettingsSectionsOpen(ids, true)
    expect(ids.every(isSettingsSectionOpen)).toBe(true)
    setAllSettingsSectionsOpen(ids, false)
    expect(ids.some(isSettingsSectionOpen)).toBe(false)
  })
})
