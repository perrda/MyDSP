import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Download,
  Briefcase,
  DollarSign,
  MapPin,
  Calendar,
  Star,
  ExternalLink,
  MessageSquare,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/Modal'
import { JobFormModal } from '../components/JobFormModal'
import { JobAnalytics } from '../components/JobAnalytics'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { JobApplication, JobFilterBy, JobSortBy, JobStatus } from '../domain/job-types'
import {
  calculateJobStats,
  exportJobsToCsv,
  filterJobApplications,
  getDaysSinceApplied,
  getNextInterview,
  isDeadlineApproaching,
  sortJobApplications,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../domain/jobs'
import { formatGBP, privacyClass } from '../utils/format'

const KANBAN_COLUMNS: Array<{ status: JobStatus[]; title: string; color: string }> = [
  { status: ['wishlist', 'researching'], title: 'Wishlist', color: 'border-gray-500' },
  { status: ['applying'], title: 'Applying', color: 'border-blue-500' },
  { status: ['applied', 'screening'], title: 'Applied', color: 'border-purple-500' },
  { status: ['interviewing'], title: 'Interviewing', color: 'border-amber-500' },
  { status: ['offer', 'accepted'], title: 'Offers', color: 'border-green-500' },
  { status: ['rejected', 'withdrawn', 'archived'], title: 'Closed', color: 'border-red-500' },
]

export function JobsPage() {
  const { data, setData, privacy } = usePortfolio()
  const { success } = useToasts()
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'analytics'>('kanban')
  const [sortBy, setSortBy] = useState<JobSortBy>('updated-desc')
  const [filterBy, setFilterBy] = useState<JobFilterBy>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingApp, setEditingApp] = useState<JobApplication | undefined>()
  const [deleteAppId, setDeleteAppId] = useState<number | null>(null)

  const applications = data.jobApplications || []

  const filteredApplications = useMemo(() => {
    let apps = filterJobApplications(applications, filterBy)

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      apps = apps.filter(
        (a) =>
          a.companyName.toLowerCase().includes(query) ||
          a.jobTitle.toLowerCase().includes(query) ||
          a.location.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query)),
      )
    }

    return sortJobApplications(apps, sortBy)
  }, [applications, filterBy, searchQuery, sortBy])

  const stats = useMemo(() => calculateJobStats(applications), [applications])

  const kanbanData = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      applications: filteredApplications.filter((app) => col.status.includes(app.status)),
    }))
  }, [filteredApplications])

  const handleCreateApplication = () => {
    setEditingApp(undefined)
    setShowForm(true)
  }

  const handleEditApplication = (app: JobApplication) => {
    setEditingApp(app)
    setShowForm(true)
  }

  const handleSaveApplication = (app: JobApplication) => {
    if (editingApp) {
      setData((prev) => ({
        ...prev,
        jobApplications: (prev.jobApplications ?? []).map((a) => (a.id === app.id ? app : a)),
      }))
      success('Application updated')
    } else {
      setData((prev) => ({
        ...prev,
        jobApplications: [...(prev.jobApplications ?? []), app],
      }))
      success('Application created', `${app.companyName} - ${app.jobTitle}`)
    }
    setShowForm(false)
    setEditingApp(undefined)
  }

  const handleStatusChange = (id: number, status: JobStatus) => {
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((app) =>
        app.id === id ? { ...app, status, updatedAt: new Date().toISOString() } : app,
      ),
    }))
    success('Status updated')
  }

  const handleDeleteApplication = (id: number) => {
    setDeleteAppId(id)
  }

  const confirmDeleteApplication = () => {
    if (deleteAppId == null) return
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).filter((app) => app.id !== deleteAppId),
    }))
    success('Application deleted')
  }

  const handleDuplicateApplication = (app: JobApplication) => {
    const now = new Date().toISOString()
    const copy: JobApplication = {
      ...app,
      id: Date.now() + Math.floor(Math.random() * 1000),
      jobTitle: `${app.jobTitle} (copy)`,
      status: 'wishlist',
      appliedDate: undefined,
      interviews: [],
      notes: [],
      contacts: app.contacts.map((c) => ({ ...c, id: Date.now() + Math.floor(Math.random() * 1000) })),
      tasks: [],
      customDocuments: [...(app.customDocuments ?? [])],
      createdAt: now,
      updatedAt: now,
    }
    setData((prev) => ({
      ...prev,
      jobApplications: [...(prev.jobApplications ?? []), copy],
    }))
    success('Application duplicated', copy.companyName)
  }

  const handleExportCsv = () => {
    const csv = exportJobsToCsv(filteredApplications)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    success('Exported', `${filteredApplications.length} applications`)
  }

  if (applications.length === 0) {
    return (
      <div>
        {showForm && (
          <JobFormModal
            application={editingApp}
            onSave={handleSaveApplication}
            onClose={() => {
              setShowForm(false)
              setEditingApp(undefined)
            }}
          />
        )}
        <PageHeader
          eyebrow="Career"
          title="Job Applications"
          description="Track your job search from application to offer"
        />
        <EmptyState
          icon={<Briefcase size={64} />}
          title="No Applications Yet"
          description="Start tracking your job applications. Save URLs, CVs, track interviews, and manage your entire job search process."
          action={{
            label: 'Add First Application',
            onClick: handleCreateApplication,
          }}
        />
      </div>
    )
  }

  return (
    <div className={privacyClass(privacy)}>
      {showForm && (
        <JobFormModal
          application={editingApp}
          onSave={handleSaveApplication}
          onClose={() => {
            setShowForm(false)
            setEditingApp(undefined)
          }}
        />
      )}
      <PageHeader
        eyebrow="Career"
        title="Job Applications"
        description={`${stats.total} applications · ${stats.interviewing} interviewing · ${stats.offers} offers`}
        action={
          <button type="button" onClick={handleCreateApplication} className="btn-primary btn-sm">
            <Plus size={16} /> Add Application
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Applied</p>
          <p className="text-2xl font-bold tabular-nums">{stats.applied}</p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Interviewing</p>
          <p className="text-2xl font-bold tabular-nums text-amber-500">{stats.interviewing}</p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Offers</p>
          <p className="text-2xl font-bold tabular-nums text-green-500">{stats.offers}</p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Response Time</p>
          <p className="text-2xl font-bold tabular-nums">{stats.avgResponseTime}d</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="surface p-4 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies, roles..."
            className="flex-1 min-w-[200px] bg-transparent border border-border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('analytics')}
              className={`btn-sm ${viewMode === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Analytics
            </button>
          </div>
          <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as JobFilterBy)} className="btn-ghost btn-sm">
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="wishlist">Wishlist</option>
            <option value="interviewing">Interviewing</option>
            <option value="offers">Offers</option>
            <option value="high-priority">High Priority</option>
            <option value="remote">Remote Only</option>
          </select>
          {viewMode === 'list' && (
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as JobSortBy)} className="btn-ghost btn-sm">
              <option value="updated-desc">Recently Updated</option>
              <option value="applied-desc">Recently Applied</option>
              <option value="deadline-asc">Deadline</option>
              <option value="salary-desc">Salary (High)</option>
              <option value="rating-desc">Rating</option>
            </select>
          )}
          <button type="button" onClick={handleExportCsv} className="btn-ghost btn-sm">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {filteredApplications.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={48} />}
          title="No Applications Found"
          description="No applications match your current filters."
        />
      ) : viewMode === 'analytics' ? (
        <JobAnalytics applications={filteredApplications} privacy={privacy} />
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {kanbanData.map((column) => (
            <div key={column.title} className="flex-shrink-0 w-80">
              <div className={`surface p-3 mb-3 border-t-4 ${column.color} rounded-t-xl md:rounded-t-none shadow-sm md:shadow-none`}>
                <h3 className="font-bold uppercase text-xs tracking-wider">
                  {column.title} ({column.applications.length})
                </h3>
              </div>
              <div className="space-y-3">
                {column.applications.map((app) => (
                  <JobCard
                    key={app.id}
                    application={app}
                    onStatusChange={handleStatusChange}
                    onEdit={handleEditApplication}
                    onDelete={handleDeleteApplication}
                    onDuplicate={handleDuplicateApplication}
                    privacy={privacy}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map((app) => (
            <JobCard
              key={app.id}
              application={app}
              onStatusChange={handleStatusChange}
              onEdit={handleEditApplication}
              onDelete={handleDeleteApplication}
              onDuplicate={handleDuplicateApplication}
              privacy={privacy}
              expanded
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteAppId !== null}
        title="Delete application"
        body="Delete this job application? This cannot be undone."
        confirmLabel="Delete application"
        onClose={() => setDeleteAppId(null)}
        onConfirm={confirmDeleteApplication}
      />
    </div>
  )
}

function JobCard({
  application,
  onStatusChange,
  onEdit,
  onDelete,
  onDuplicate,
  privacy,
  expanded = false,
}: {
  application: JobApplication
  onStatusChange: (id: number, status: JobStatus) => void
  onEdit: (app: JobApplication) => void
  onDelete: (id: number) => void
  onDuplicate: (app: JobApplication) => void
  privacy: boolean
  expanded?: boolean
}) {
  const daysSince = getDaysSinceApplied(application)
  const nextInterview = getNextInterview(application)
  const deadlineApproaching = isDeadlineApproaching(application)

  return (
    <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none hover:border-accent transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <Link to={`/jobs/${application.id}`} className="font-bold text-base hover:text-accent transition-colors block truncate">
            {application.jobTitle}
          </Link>
          <p className="text-sm text-text-muted truncate">{application.companyName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={12} className={i < application.rating ? 'fill-accent text-accent' : 'text-text-subtle'} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={application.status}
          onChange={(e) => onStatusChange(application.id, e.target.value as JobStatus)}
          className={`text-xs px-2 py-1 rounded font-semibold uppercase ${STATUS_COLORS[application.status]}`}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {application.priority === 'high' && (
          <span className="text-xs px-2 py-1 bg-red-500/10 text-red-500 rounded font-semibold uppercase">High Priority</span>
        )}
        {deadlineApproaching && (
          <span className="text-xs px-2 py-1 bg-amber-500/10 text-amber-500 rounded font-semibold uppercase flex items-center gap-1">
            <AlertCircle size={12} /> Deadline Soon
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-text-muted mb-3">
        <div className="flex items-center gap-2">
          <MapPin size={12} className="flex-shrink-0" />
          <span>{application.location} · {application.remote}</span>
        </div>
        {(application.salaryMin || application.salaryMax) && (
          <div className={`flex items-center gap-2 ${privacyClass(privacy)}`}>
            <DollarSign size={12} className="flex-shrink-0" />
            <span>
              {application.salaryMin && formatGBP(application.salaryMin)}
              {application.salaryMin && application.salaryMax && ' - '}
              {application.salaryMax && formatGBP(application.salaryMax)}
              {' '}
              {application.salaryCurrency}/{application.salaryPeriod}
            </span>
          </div>
        )}
        {application.appliedDate && (
          <div className="flex items-center gap-2">
            <Calendar size={12} className="flex-shrink-0" />
            <span>Applied {application.appliedDate}{daysSince !== null && ` (${daysSince}d ago)`}</span>
          </div>
        )}
        {nextInterview && (
          <div className="flex items-center gap-2 text-amber-500">
            <Clock size={12} className="flex-shrink-0" />
            <span>Interview: {nextInterview.scheduledDate}</span>
          </div>
        )}
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-2 mb-3">
          {application.jobUrl && (
            <a href={application.jobUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm text-xs">
              <ExternalLink size={12} /> Job Posting
            </a>
          )}
          {application.interviews.length > 0 && (
            <span className="text-xs px-2 py-1 bg-surface-hover rounded flex items-center gap-1">
              <Users size={12} /> {application.interviews.length} interviews
            </span>
          )}
          {application.notes.length > 0 && (
            <span className="text-xs px-2 py-1 bg-surface-hover rounded flex items-center gap-1">
              <MessageSquare size={12} /> {application.notes.length} notes
            </span>
          )}
          {application.tasks.length > 0 && (
            <span className="text-xs px-2 py-1 bg-surface-hover rounded flex items-center gap-1">
              <CheckCircle size={12} /> {application.tasks.filter((t) => t.completed).length}/{application.tasks.length} tasks
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <Link to={`/jobs/${application.id}`} className="btn-primary btn-sm text-xs flex-1">
          View Details
        </Link>
        <button type="button" onClick={() => onEdit(application)} className="btn-ghost btn-sm text-xs">
          Edit
        </button>
        <button type="button" onClick={() => onDuplicate(application)} className="btn-ghost btn-sm text-xs">
          Duplicate
        </button>
        <button type="button" onClick={() => onDelete(application.id)} className="btn-ghost btn-sm text-xs text-red-500">
          Delete
        </button>
      </div>
    </div>
  )
}
