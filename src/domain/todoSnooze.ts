/** Push a todo due date forward by one local calendar day. */

export function snoozeDueDateOneDay(dueDate?: string): string {
  let y: number
  let m: number
  let d: number
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    ;[y, m, d] = dueDate.split('-').map(Number)
  } else {
    const now = new Date()
    y = now.getFullYear()
    m = now.getMonth() + 1
    d = now.getDate()
  }
  const next = new Date(y, m - 1, d + 1)
  const yy = next.getFullYear()
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  const dd = String(next.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
