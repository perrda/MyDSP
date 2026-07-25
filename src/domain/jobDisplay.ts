/** Display helpers for Job Tracker cards and detail — company-first hierarchy. */

import type { JobApplication, SalaryPeriod } from './job-types'
import { formatNativeCurrency } from '../utils/format'

const URL_RE = /^https?:\/\/\S+/i

export function looksLikeUrl(value: string | undefined | null): boolean {
  const s = (value ?? '').trim()
  if (!s) return false
  if (URL_RE.test(s)) return true
  // Bare host paste (linkedin.com/jobs/…)
  return /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s) && s.includes('/')
}

/** Hostname for muted secondary link under company / role. */
export function jobPostingHost(url: string | undefined | null): string | null {
  const raw = (url ?? '').trim()
  if (!raw) return null
  try {
    const href = raw.startsWith('http') ? raw : `https://${raw}`
    const host = new URL(href).hostname.replace(/^www\./i, '')
    return host || null
  } catch {
    return raw.length > 40 ? `${raw.slice(0, 37)}…` : raw
  }
}

export function ensureHttpUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

/**
 * If the user pasted a posting URL into Job Title, move it to jobUrl and
 * fall back to a readable title.
 */
export function coerceJobTitleAndUrl(input: {
  companyName: string
  jobTitle: string
  jobUrl?: string
}): { jobTitle: string; jobUrl?: string } {
  const company = input.companyName.trim() || 'Company'
  let title = input.jobTitle.trim()
  let url = (input.jobUrl ?? '').trim() || undefined

  if (looksLikeUrl(title)) {
    if (!url) url = ensureHttpUrl(title)
    title = `Role at ${company}`
  }
  return { jobTitle: title, jobUrl: url }
}

const PERIOD_LABEL: Record<SalaryPeriod, string> = {
  annual: 'year',
  monthly: 'month',
  hourly: 'hour',
  daily: 'day',
}

/** Single clean salary line — no DollarSign icon + no duplicated currency code. */
export function formatJobSalary(app: Pick<
  JobApplication,
  'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'
>): string | null {
  const min = app.salaryMin
  const max = app.salaryMax
  const hasMin = min != null && Number.isFinite(min)
  const hasMax = max != null && Number.isFinite(max)
  if (!hasMin && !hasMax) return null

  const currency = app.salaryCurrency || 'GBP'
  const period = PERIOD_LABEL[app.salaryPeriod] ?? app.salaryPeriod
  // Whole pounds/dollars for typical salaries; keep decimals only when needed
  const digits = (n: number) => (Number.isInteger(n) || Math.abs(n) >= 100 ? 0 : 2)

  let range = ''
  if (hasMin && hasMax) {
    if (min === max) {
      range = formatNativeCurrency(min!, currency, { digits: digits(min!) })
    } else {
      range = `${formatNativeCurrency(min!, currency, { digits: digits(min!) })} – ${formatNativeCurrency(max!, currency, { digits: digits(max!) })}`
    }
  } else if (hasMin) {
    range = `from ${formatNativeCurrency(min!, currency, { digits: digits(min!) })}`
  } else {
    range = `up to ${formatNativeCurrency(max!, currency, { digits: digits(max!) })}`
  }

  return `${range} / ${period}`
}
