/** Corporate-action due helpers shared by Equities + Notification Center. */

export function todayIsoDate(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** True when an effective date is today or earlier (YYYY-MM-DD). */
export function isCorporateActionDue(date?: string, now = new Date()): boolean {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayIsoDate(now))
}
