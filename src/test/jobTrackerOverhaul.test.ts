import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Job Tracker overhaul (v1.2.102)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.123')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.123')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.123',
      '1.2.122',
      '1.2.121',
      '1.2.120',
      '1.2.119',
    ])
  })

  it('Kanban / List cards are company-first with muted URL', () => {
    const page = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(page).toMatch(/data-testid="job-card-company"/)
    expect(page).toMatch(/data-testid="job-card-title"/)
    expect(page).toMatch(/data-testid="job-card-url"/)
    expect(page).toMatch(/data-testid="jobs-list-view"/)
    expect(page).toMatch(/data-testid="jobs-list-row"/)
    expect(page).toMatch(/function JobsListRow/)
    expect(page).toMatch(/formatJobSalary/)
    expect(page).toMatch(/coerceJobTitleAndUrl/)
    expect(page).toMatch(/data-testid="jobs-kanban-quick-scan"/)
    expect(page).not.toMatch(/DollarSign/)
  })

  it('Job detail hero always shows company; salary + contacts hardened', () => {
    const page = readFileSync(resolve(__dirname, '../pages/JobDetailPage.tsx'), 'utf8')
    expect(page).toMatch(/data-testid="job-detail-hero"/)
    expect(page).toMatch(/data-testid="job-detail-company"/)
    expect(page).toMatch(/data-testid="job-detail-title"/)
    expect(page).toMatch(/data-testid="job-detail-url"/)
    expect(page).toMatch(/data-testid="job-detail-salary"/)
    expect(page).toMatch(/formatJobSalary/)
    expect(page).toMatch(/preferredContactLabel/)
    expect(page).not.toMatch(/DollarSign/)
    expect(page).not.toMatch(/title=\{application\.jobTitle\}/)
    expect(page).not.toMatch(/description=\{application\.companyName\}/)
  })

  it('shell sticky title resolves company name for /jobs/:id', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/job\?\.companyName/)
    expect(shell).toMatch(/data\.jobApplications/)
  })

  it('form coerces pasted URL titles; contacts have preferred method', () => {
    const form = readFileSync(resolve(__dirname, '../components/JobFormModal.tsx'), 'utf8')
    expect(form).toMatch(/coerceJobTitleAndUrl/)
    const contact = readFileSync(resolve(__dirname, '../components/ContactModal.tsx'), 'utf8')
    expect(contact).toMatch(/Preferred method of contact/)
    expect(contact).toMatch(/data-testid="job-contact-phone"/)
    expect(contact).toMatch(/data-testid="job-contact-email"/)
    expect(contact).toMatch(/data-testid="job-contact-url"/)
    expect(contact).toMatch(/data-testid="job-contact-preferred"/)
  })

  it('list grid CSS exists', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.jobs-list-view__head/)
    expect(css).toMatch(/\.jobs-list-row__grid/)
    expect(css).toMatch(/\.jobs-quick-scan-row/)
  })
})
