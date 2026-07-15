/** This-week vs last-week spending totals (Mon–Sun local). */

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
  s.setHours(0, 0, 0, 0)
  return s
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekRange(now = new Date()): { thisStart: string; thisEnd: string; lastStart: string; lastEnd: string } {
  const thisStart = startOfWeekMonday(now)
  const thisEnd = new Date(thisStart)
  thisEnd.setDate(thisEnd.getDate() + 6)
  const lastStart = new Date(thisStart)
  lastStart.setDate(lastStart.getDate() - 7)
  const lastEnd = new Date(thisStart)
  lastEnd.setDate(lastEnd.getDate() - 1)
  return {
    thisStart: ymd(thisStart),
    thisEnd: ymd(thisEnd),
    lastStart: ymd(lastStart),
    lastEnd: ymd(lastEnd),
  }
}

export function sumSpendInRange(
  spending: { date?: string; amount: number }[],
  start: string,
  end: string,
): number {
  let total = 0
  for (const s of spending) {
    const d = (s.date ?? '').slice(0, 10)
    if (d >= start && d <= end) total += Math.abs(s.amount)
  }
  return total
}

export function weekSpendDelta(
  spending: { date?: string; amount: number }[],
  now = new Date(),
): { thisWeek: number; lastWeek: number; delta: number } {
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRange(now)
  const thisWeek = sumSpendInRange(spending, thisStart, thisEnd)
  const lastWeek = sumSpendInRange(spending, lastStart, lastEnd)
  return { thisWeek, lastWeek, delta: thisWeek - lastWeek }
}

/** One-line copy for the Spending page. */
export function formatWeekDeltaLine(
  thisWeek: number,
  lastWeek: number,
  formatMoney: (n: number) => string,
): string {
  const delta = thisWeek - lastWeek
  if (lastWeek === 0 && thisWeek === 0) return 'This week vs last: no spend yet'
  const vs =
    lastWeek === 0
      ? 'no spend last week'
      : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatMoney(Math.abs(delta))} vs last week`
  return `This week ${formatMoney(thisWeek)} · ${vs}`
}
