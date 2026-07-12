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
    id: Date.now() + Math.floor(Math.random() * 1000),
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
      const firstInterview = new Date(a.interviews[0].scheduledDate)
      return (firstInterview.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)
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
  wishlist: 'bg-gray-500/10 text-gray-500',
  researching: 'bg-blue-500/10 text-blue-500',
  applying: 'bg-cyan-500/10 text-cyan-500',
  applied: 'bg-purple-500/10 text-purple-500',
  screening: 'bg-indigo-500/10 text-indigo-500',
  interviewing: 'bg-amber-500/10 text-amber-500',
  offer: 'bg-green-500/10 text-green-500',
  accepted: 'bg-green-600/10 text-green-600',
  rejected: 'bg-red-500/10 text-red-500',
  withdrawn: 'bg-gray-600/10 text-gray-600',
  archived: 'bg-gray-700/10 text-gray-700',
}
