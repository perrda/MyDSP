export type JobCalendarStripEvent = {
  key: string
  appId: number
  company: string
  title: string
  date: string
  type: 'Interview' | 'Deadline'
  sortAt: number
  dayLabel: string
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function icsUtcStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function parseEventDateTime(date: string): { date: string; time?: string } {
  const trimmed = date.trim()
  const space = trimmed.indexOf(' ')
  if (space === -1) return { date: trimmed.slice(0, 10) }
  return { date: trimmed.slice(0, 10), time: trimmed.slice(space + 1) }
}

function formatIcsLocal(date: string, time?: string): string {
  const ymd = date.slice(0, 10).replace(/-/g, '')
  if (!time) return ymd
  const [h = '00', m = '00'] = time.split(':')
  return `${ymd}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`
}

/** Prefer the next interview; otherwise the first upcoming strip event. */
export function pickNextCalendarEvent(events: JobCalendarStripEvent[]): JobCalendarStripEvent | null {
  if (events.length === 0) return null
  return events.find((e) => e.type === 'Interview') ?? events[0]
}

export function buildJobEventIcs(event: JobCalendarStripEvent, origin = ''): string {
  const { date, time } = parseEventDateTime(event.date)
  const hasTime = Boolean(time)
  const dtStart = formatIcsLocal(date, time)
  const summary = escapeIcs(`${event.type}: ${event.company} — ${event.title}`)
  const description = escapeIcs(`MyDSP job tracker — ${event.title} at ${event.company}`)
  const url = origin ? `${origin}/jobs/${event.appId}` : `/jobs/${event.appId}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyDSP//Job Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.key}@mydsp`,
    `DTSTAMP:${icsUtcStamp()}`,
  ]

  if (hasTime) {
    const endDate = new Date(`${date}T${time}`)
    endDate.setHours(endDate.getHours() + 1)
    const endYmd = endDate.toISOString().slice(0, 10).replace(/-/g, '')
    const endHm = `${String(endDate.getHours()).padStart(2, '0')}${String(endDate.getMinutes()).padStart(2, '0')}00`
    lines.push(`DTSTART:${dtStart}`, `DTEND:${endYmd}T${endHm}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`)
  }

  lines.push(
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return lines.join('\r\n')
}

export function downloadJobEventIcs(event: JobCalendarStripEvent): void {
  const ics = buildJobEventIcs(event, typeof window !== 'undefined' ? window.location.origin : '')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mydsp-${event.type.toLowerCase()}-${event.company.replace(/\s+/g, '-').toLowerCase()}.ics`
  anchor.click()
  URL.revokeObjectURL(url)
}
