import type {
  JobApplication,
  JobStatus,
  JobSortBy,
  JobFilterBy,
  JobStats,
  JobInterview,
  JobNote,
  JobContact,
} from './job-types'

export function createJobApplication(
  partial: Partial<JobApplication> & Pick<JobApplication, 'companyName' | 'jobTitle'>,
): JobApplication {
  const now = new Date().toISOString()
  return {
    id: partial.id ?? Date.now() + Math.floor(Math.random() * 1000),
    companyName: partial.companyName,
    jobTitle: partial.jobTitle,
    status: partial.status ?? 'wishlist',
    priority: partial.priority ?? 'medium',
    jobUrl: partial.jobUrl,
    companyWebsite: partial.companyWebsite,
    linkedInUrl: partial.linkedInUrl,
    applicationPortalUrl: partial.applicationPortalUrl,
    appliedDate: partial.appliedDate,
    deadline: partial.deadline,
    source: partial.source ?? 'Direct',
    referralContact: partial.referralContact,
    salaryMin: partial.salaryMin,
    salaryMax: partial.salaryMax,
    salaryCurrency: partial.salaryCurrency ?? 'GBP',
    salaryPeriod: partial.salaryPeriod ?? 'annual',
    equity: partial.equity,
    benefits: partial.benefits,
    location: partial.location ?? 'Unknown',
    remote: partial.remote ?? 'onsite',
    jobType: partial.jobType ?? 'full-time',
    description: partial.description,
    requirements: partial.requirements,
    responsibilities: partial.responsibilities,
    cvVersion: partial.cvVersion,
    coverLetterVersion: partial.coverLetterVersion,
    portfolioUrl: partial.portfolioUrl,
    customDocuments: partial.customDocuments ?? [],
    interviews: partial.interviews ?? [],
    notes: partial.notes ?? [],
    contacts: partial.contacts ?? [],
    tasks: partial.tasks ?? [],
    rating: partial.rating ?? 0,
    pros: partial.pros,
    cons: partial.cons,
    rejectionReason: partial.rejectionReason,
    offerDetails: partial.offerDetails,
    createdAt: now,
    updatedAt: now,
    sortOrder: partial.sortOrder,
    tags: partial.tags ?? [],
  }
}

export function createInterview(partial: Partial<JobInterview> & Pick<JobInterview, 'type' | 'scheduledDate'>): JobInterview {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: partial.type,
    scheduledDate: partial.scheduledDate,
    scheduledTime: partial.scheduledTime,
    duration: partial.duration ?? 60,
    location: partial.location,
    meetingUrl: partial.meetingUrl,
    interviewers: partial.interviewers ?? [],
    notes: partial.notes,
    preparation: partial.preparation,
    outcome: partial.outcome ?? 'pending',
    feedback: partial.feedback,
    createdAt: new Date().toISOString(),
    completedAt: partial.completedAt,
  }
}

export function createJobNote(content: string, type: JobNote['type'] = 'general'): JobNote {
  const now = new Date().toISOString()
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    content,
    type,
    createdAt: now,
    updatedAt: now,
  }
}

export function createJobContact(partial: Partial<JobContact> & Pick<JobContact, 'name' | 'role'>): JobContact {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: partial.name,
    role: partial.role,
    email: partial.email,
    phone: partial.phone,
    linkedIn: partial.linkedIn,
    notes: partial.notes,
    lastContact: partial.lastContact,
  }
}

export function getDaysSinceApplied(application: JobApplication): number | null {
  if (!application.appliedDate) return null
  const applied = new Date(application.appliedDate)
  const now = new Date()
  return Math.floor((now.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24))
}

export function getNextInterview(application: JobApplication): JobInterview | null {
  const upcoming = application.interviews
    .filter((i) => i.outcome === 'pending')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
  return upcoming[0] || null
}

export function isDeadlineApproaching(application: JobApplication, daysThreshold = 7): boolean {
  if (!application.deadline) return false
  const deadline = new Date(application.deadline)
  const now = new Date()
  const daysUntil = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntil >= 0 && daysUntil <= daysThreshold
}

export function hasNoResponse(application: JobApplication, daysThreshold = 14): boolean {
  if (!application.appliedDate || application.status !== 'applied') return false
  const days = getDaysSinceApplied(application)
  return days !== null && days > daysThreshold
}

/** Applied/screening with no reply past threshold, or a pending interview already overdue. */
export function needsFollowUp(application: JobApplication, daysThreshold = 14): boolean {
  // A recent follow-up note clears the pulse until the threshold elapses again.
  const lastFollowUpNote = [...(application.notes ?? [])]
    .filter((n) => n.type === 'follow-up')
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0]
  if (lastFollowUpNote) {
    const contacted = Date.parse(lastFollowUpNote.createdAt || '')
    if (Number.isFinite(contacted)) {
      const daysSince = (Date.now() - contacted) / (1000 * 60 * 60 * 24)
      if (daysSince <= daysThreshold) return false
    }
  }
  if (['applied', 'screening'].includes(application.status) && application.appliedDate) {
    const days = getDaysSinceApplied(application)
    if (days !== null && days > daysThreshold) return true
  }
  const next = getNextInterview(application)
  if (next?.scheduledDate) {
    const due = next.scheduledDate.slice(0, 10)
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (due < today) return true
  }
  return false
}

export function sortJobApplications(applications: JobApplication[], sortBy: JobSortBy): JobApplication[] {
  return [...applications].sort((a, b) => {
    switch (sortBy) {
      case 'applied-desc':
        if (!a.appliedDate && !b.appliedDate) return 0
        if (!a.appliedDate) return 1
        if (!b.appliedDate) return -1
        return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
      case 'applied-asc':
        if (!a.appliedDate && !b.appliedDate) return 0
        if (!a.appliedDate) return 1
        if (!b.appliedDate) return -1
        return new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime()
      case 'deadline-asc':
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      case 'salary-desc': {
        const aSalary = a.salaryMax || a.salaryMin || 0
        const bSalary = b.salaryMax || b.salaryMin || 0
        return bSalary - aSalary
      }
      case 'rating-desc':
        return b.rating - a.rating
      case 'updated-desc':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'company-asc':
        return a.companyName.localeCompare(b.companyName)
      default:
        return 0
    }
  })
}

export function filterJobApplications(applications: JobApplication[], filterBy: JobFilterBy): JobApplication[] {
  switch (filterBy) {
    case 'all':
      return applications.filter((a) => a.status !== 'archived')
    case 'active':
      return applications.filter(
        (a) =>
          !['rejected', 'withdrawn', 'archived', 'accepted'].includes(a.status),
      )
    case 'wishlist':
      return applications.filter((a) => a.status === 'wishlist')
    case 'applied':
      return applications.filter((a) => ['applied', 'screening'].includes(a.status))
    case 'interviewing':
      return applications.filter((a) => a.status === 'interviewing')
    case 'offers':
      return applications.filter((a) => a.status === 'offer')
    case 'rejected':
      return applications.filter((a) => a.status === 'rejected')
    case 'high-priority':
      return applications.filter((a) => a.priority === 'high' && a.status !== 'archived')
    case 'remote':
      return applications.filter((a) => a.remote === 'remote' && a.status !== 'archived')
    case 'no-response':
      return applications.filter((a) => hasNoResponse(a))
    case 'follow-up':
      return applications.filter((a) => needsFollowUp(a))
    default:
      return applications
  }
}

export function calculateJobStats(applications: JobApplication[]): JobStats {
  const total = applications.filter((a) => a.status !== 'archived').length
  const applied = applications.filter((a) =>
    ['applied', 'screening', 'interviewing', 'offer', 'accepted'].includes(a.status),
  ).length
  const interviewing = applications.filter((a) => a.status === 'interviewing').length
  const offers = applications.filter((a) => a.status === 'offer').length
  const rejected = applications.filter((a) => a.status === 'rejected').length

  // Calculate average response time
  const responseTimes = applications
    .filter((a) => a.appliedDate && a.interviews.length > 0)
    .map((a) => {
      const applied = new Date(a.appliedDate!)
      const firstInterview = [...a.interviews]
        .map((i) => new Date(i.scheduledDate).getTime())
        .sort((x, y) => x - y)[0]
      return (firstInterview - applied.getTime()) / (1000 * 60 * 60 * 24)
    })
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((sum, days) => sum + days, 0) / responseTimes.length)
    : 0

  // Calculate rates
  const interviewRate = applied > 0 ? Math.round((interviewing / applied) * 100) : 0
  const offerRate = applied > 0 ? Math.round((offers / applied) * 100) : 0

  return { total, applied, interviewing, offers, rejected, avgResponseTime, interviewRate, offerRate }
}

export function exportJobsToCsv(applications: JobApplication[]): string {
  const headers = [
    'Company',
    'Job Title',
    'Status',
    'Priority',
    'Applied Date',
    'Location',
    'Remote',
    'Salary Min',
    'Salary Max',
    'Currency',
    'Job URL',
    'Rating',
    'Source',
  ]

  const rows = applications.map((app) => [
    app.companyName,
    app.jobTitle,
    app.status,
    app.priority,
    app.appliedDate || '',
    app.location,
    app.remote,
    app.salaryMin?.toString() || '',
    app.salaryMax?.toString() || '',
    app.salaryCurrency,
    app.jobUrl || '',
    app.rating.toString(),
    app.source,
  ])

  return [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

const VALID_STATUSES: JobStatus[] = [
  'wishlist',
  'researching',
  'applying',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'archived',
]

/** Primary status when dropping a card onto a kanban column. */
export const KANBAN_DROP_STATUS: Record<string, JobStatus> = {
  Wishlist: 'wishlist',
  Applying: 'applying',
  Applied: 'applied',
  Interview: 'interviewing',
  Offer: 'offer',
  Rejected: 'rejected',
}

export function parseCsvToJobApplications(csv: string): JobApplication[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const apps: JobApplication[] = []
  const base = Date.now()

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i])
    if (!values.length || values.every((v) => !v)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })

    const companyName = row.company || row.companyname || row['company name'] || ''
    const jobTitle = row['job title'] || row.jobtitle || row.title || row.role || ''
    if (!companyName.trim() || !jobTitle.trim()) continue

    const statusRaw = (row.status || 'wishlist').toLowerCase().replace(/\s+/g, '-') as JobStatus
    const priorityRaw = (row.priority || 'medium').toLowerCase()
    const remoteRaw = (row.remote || 'onsite').toLowerCase()

    apps.push(
      createJobApplication({
        id: base + i,
        companyName: companyName.trim(),
        jobTitle: jobTitle.trim(),
        status: VALID_STATUSES.includes(statusRaw) ? statusRaw : 'wishlist',
        priority: (['high', 'medium', 'low'].includes(priorityRaw)
          ? priorityRaw
          : 'medium') as JobApplication['priority'],
        appliedDate: row['applied date'] || row.applieddate || row.applied || undefined,
        location: row.location || 'Unknown',
        remote: (['onsite', 'hybrid', 'remote'].includes(remoteRaw)
          ? remoteRaw
          : 'onsite') as JobApplication['remote'],
        salaryMin: (() => {
          const n = Number(row['salary min'] || row.salarymin)
          return Number.isFinite(n) ? n : undefined
        })(),
        salaryMax: (() => {
          const n = Number(row['salary max'] || row.salarymax)
          return Number.isFinite(n) ? n : undefined
        })(),
        salaryCurrency: row.currency || row.salarycurrency || 'GBP',
        jobUrl: row['job url'] || row.joburl || row.url || undefined,
        rating: row.rating ? Number(row.rating) || 0 : 0,
        source: row.source || 'Import',
        tags: ['imported'],
      }),
    )
  }

  return apps
}

export function parseJsonToJobApplications(jsonText: string): JobApplication[] {
  const parsed = JSON.parse(jsonText) as unknown
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { applications?: unknown }).applications)
      ? ((parsed as { applications: unknown[] }).applications)
      : null
  if (!arr) throw new Error('JSON must be an array of applications or { applications: [...] }')

  const base = Date.now()
  return arr
    .map((raw, idx) => {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as Record<string, unknown>
      const companyName = String(r.companyName ?? r.company ?? '').trim()
      const jobTitle = String(r.jobTitle ?? r.title ?? '').trim()
      if (!companyName || !jobTitle) return null
      const statusRaw = String(r.status ?? 'wishlist').toLowerCase().replace(/\s+/g, '-') as JobStatus
      const priorityRaw = String(r.priority ?? 'medium').toLowerCase()
      const remoteRaw = String(r.remote ?? 'onsite').toLowerCase()
      return createJobApplication({
        id: typeof r.id === 'number' ? r.id : base + idx,
        companyName,
        jobTitle,
        status: VALID_STATUSES.includes(statusRaw) ? statusRaw : 'wishlist',
        priority: (['high', 'medium', 'low'].includes(priorityRaw)
          ? priorityRaw
          : 'medium') as JobApplication['priority'],
        appliedDate: typeof r.appliedDate === 'string' ? r.appliedDate : undefined,
        deadline: typeof r.deadline === 'string' ? r.deadline : undefined,
        location: typeof r.location === 'string' ? r.location : 'Unknown',
        remote: (['onsite', 'hybrid', 'remote'].includes(remoteRaw)
          ? remoteRaw
          : 'onsite') as JobApplication['remote'],
        salaryMin: typeof r.salaryMin === 'number' && Number.isFinite(r.salaryMin) ? r.salaryMin : undefined,
        salaryMax: typeof r.salaryMax === 'number' && Number.isFinite(r.salaryMax) ? r.salaryMax : undefined,
        salaryCurrency: typeof r.salaryCurrency === 'string' ? r.salaryCurrency : 'GBP',
        jobUrl: typeof r.jobUrl === 'string' ? r.jobUrl : undefined,
        rating: typeof r.rating === 'number' ? r.rating : 0,
        source: typeof r.source === 'string' ? r.source : 'Import',
        description: typeof r.description === 'string' ? r.description : undefined,
        tags: Array.isArray(r.tags) ? r.tags.map(String) : ['imported'],
        interviews: Array.isArray(r.interviews) ? (r.interviews as JobApplication['interviews']) : [],
        notes: Array.isArray(r.notes) ? (r.notes as JobApplication['notes']) : [],
        contacts: Array.isArray(r.contacts) ? (r.contacts as JobApplication['contacts']) : [],
        tasks: Array.isArray(r.tasks) ? (r.tasks as JobApplication['tasks']) : [],
        customDocuments: Array.isArray(r.customDocuments)
          ? (r.customDocuments as JobApplication['customDocuments'])
          : [],
      })
    })
    .filter((x): x is JobApplication => x != null)
}

export function exportJobsToJson(applications: JobApplication[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), applications }, null, 2)
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  wishlist: 'Wishlist',
  researching: 'Researching',
  applying: 'Applying',
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  wishlist: 'bg-border/40 text-text-muted',
  researching: 'bg-accent/10 text-accent',
  applying: 'bg-amber-500/10 text-amber-500',
  applied: 'bg-amber-500/15 text-amber-600',
  screening: 'bg-accent/15 text-accent',
  interviewing: 'bg-emerald-500/10 text-emerald-500',
  offer: 'bg-emerald-500/15 text-emerald-600',
  accepted: 'bg-emerald-600/10 text-emerald-600',
  rejected: 'bg-red-500/10 text-red-500',
  withdrawn: 'bg-border/40 text-text-subtle',
  archived: 'bg-border/30 text-text-subtle',
}
