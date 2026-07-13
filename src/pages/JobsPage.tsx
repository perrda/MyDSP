import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Download,
  Upload,
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
  Archive,
  GripVertical,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { JobFormModal } from '../components/JobFormModal'
import { JobAnalytics } from '../components/JobAnalytics'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { JobApplication, JobFilterBy, JobSortBy, JobStatus } from '../domain/job-types'
import {
  calculateJobStats,
  exportJobsToCsv,
  exportJobsToJson,
  filterJobApplications,
  getDaysSinceApplied,
  getNextInterview,
  isDeadlineApproaching,
  KANBAN_DROP_STATUS,
  parseCsvToJobApplications,
  parseJsonToJobApplications,
  sortJobApplications,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../domain/jobs'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
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
  const { success, error: showError } = useToasts()
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'analytics'>('kanban')
  const [sortBy, setSortBy] = useState<JobSortBy>('updated-desc')
  const [filterBy, setFilterBy] = useState<JobFilterBy>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingApp, setEditingApp] = useState<JobApplication | undefined>()
  const [deleteAppId, setDeleteAppId] = useState<number | null>(null)
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<JobStatus | ''>('')
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const [closedDrop, setClosedDrop] = useState<{
    appId: number
    jobTitle: string
    companyName: string
  } | null>(null)

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
      applications: sortBySortOrder(
        filteredApplications.filter((app) => col.status.includes(app.status)),
      ),
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

  const handleExportJson = () => {
    const json = exportJobsToJson(filteredApplications)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-applications-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    success('Exported JSON', `${filteredApplications.length} applications`)
  }

  const handleImportFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.json,text/csv,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const apps = file.name.toLowerCase().endsWith('.json')
          ? parseJsonToJobApplications(text)
          : parseCsvToJobApplications(text)
        if (apps.length === 0) {
          success('Nothing imported', 'No valid rows found')
          return
        }
        setData((prev) => ({
          ...prev,
          jobApplications: [...(prev.jobApplications ?? []), ...apps],
        }))
        success('Imported applications', `${apps.length} added`)
      } catch (err) {
        showError('Import failed', err instanceof Error ? err.message : 'Could not parse file')
      }
    }
    input.click()
  }

  const handleKanbanDrop = (columnTitle: string, appId: number) => {
    const status = KANBAN_DROP_STATUS[columnTitle]
    if (!status) return
    const app = applications.find((a) => a.id === appId)
    if (!app) return

    // Already in Closed — within-column reorder handles order; ignore status DnD
    if (
      columnTitle === 'Closed' &&
      (app.status === 'rejected' || app.status === 'withdrawn' || app.status === 'archived')
    ) {
      setDragOverColumn(null)
      return
    }

    if (columnTitle === 'Closed') {
      setDragOverColumn(null)
      setClosedDrop({
        appId,
        jobTitle: app.jobTitle,
        companyName: app.companyName,
      })
      return
    }

    handleStatusChange(appId, status)
    setDragOverColumn(null)
  }

  const handleClosedStatus = (status: 'rejected' | 'withdrawn' | 'archived') => {
    if (!closedDrop) return
    handleStatusChange(closedDrop.appId, status)
    setClosedDrop(null)
  }

  const handleReorderInColumn = (columnStatuses: JobStatus[], reordered: JobApplication[]) => {
    const withOrder = applySortOrder(reordered)
    const idToOrder = new Map(withOrder.map((a) => [a.id, a.sortOrder!]))
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((app) =>
        columnStatuses.includes(app.status) && idToOrder.has(app.id)
          ? { ...app, sortOrder: idToOrder.get(app.id), updatedAt: now }
          : app,
      ),
    }))
  }

  const toggleJobSelect = (id: number) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkStatus = () => {
    if (!bulkStatus || selectedJobs.size === 0) return
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((app) =>
        selectedJobs.has(app.id) ? { ...app, status: bulkStatus, updatedAt: now } : app,
      ),
    }))
    success('Status updated', `${selectedJobs.size} applications → ${STATUS_LABELS[bulkStatus]}`)
    setSelectedJobs(new Set())
    setBulkStatus('')
  }

  const handleBulkArchive = () => {
    if (selectedJobs.size === 0) return
    setConfirmState({
      title: 'Archive applications',
      body: `Archive ${selectedJobs.size} selected application${selectedJobs.size === 1 ? '' : 's'}?`,
      confirmLabel: 'Archive',
      onConfirm: () => {
        const now = new Date().toISOString()
        setData((prev) => ({
          ...prev,
          jobApplications: (prev.jobApplications ?? []).map((app) =>
            selectedJobs.has(app.id) ? { ...app, status: 'archived' as const, updatedAt: now } : app,
          ),
        }))
        success('Archived', `${selectedJobs.size} applications`)
        setSelectedJobs(new Set())
      },
    })
  }

  const handleBulkDelete = () => {
    if (selectedJobs.size === 0) return
    setConfirmState({
      title: 'Delete applications',
      body: `Delete ${selectedJobs.size} selected application${selectedJobs.size === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          jobApplications: (prev.jobApplications ?? []).filter((app) => !selectedJobs.has(app.id)),
        }))
        success('Deleted', `${selectedJobs.size} applications`)
        setSelectedJobs(new Set())
      },
    })
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
        <div className="text-center mt-4">
          <button type="button" onClick={handleImportFile} className="btn-secondary btn-sm">
            <Upload size={14} /> Import CSV / JSON
          </button>
        </div>
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
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleImportFile} className="btn-secondary btn-sm">
              <Upload size={16} /> Import
            </button>
            <button type="button" onClick={handleCreateApplication} className="btn-primary btn-sm">
              <Plus size={16} /> Add Application
            </button>
          </div>
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
          <button type="button" onClick={handleImportFile} className="btn-ghost btn-sm">
            <Upload size={14} /> Import
          </button>
          <button type="button" onClick={handleExportCsv} className="btn-ghost btn-sm">
            <Download size={14} /> CSV
          </button>
          <button type="button" onClick={handleExportJson} className="btn-ghost btn-sm">
            <Download size={14} /> JSON
          </button>
        </div>

        {selectedJobs.size > 0 && (
          <div className="flex flex-wrap gap-2 items-center p-3 mt-3 bg-accent/10 rounded-lg border border-accent/20">
            <span className="text-sm font-semibold">{selectedJobs.size} selected</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as JobStatus | '')}
              className="px-2 py-1.5 bg-surface-hover border border-border rounded text-sm"
            >
              <option value="">Set status…</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleBulkStatus} disabled={!bulkStatus} className="btn-sm btn-primary">
              Apply
            </button>
            <button
              type="button"
              onClick={handleBulkArchive}
              className="btn-sm bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
            >
              <Archive size={14} /> Archive
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn-sm bg-red-500/20 text-red-500 hover:bg-red-500/30"
            >
              Delete
            </button>
            <button type="button" onClick={() => setSelectedJobs(new Set())} className="btn-ghost btn-sm ml-auto">
              Clear
            </button>
          </div>
        )}
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
            <div
              key={column.title}
              className={`flex-shrink-0 w-80 rounded-lg transition-colors ${
                dragOverColumn === column.title ? 'bg-accent/10 ring-2 ring-accent' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverColumn(column.title)
              }}
              onDragLeave={() => setDragOverColumn((c) => (c === column.title ? null : c))}
              onDrop={(e) => {
                e.preventDefault()
                const id = Number(e.dataTransfer.getData('text/job-id'))
                if (Number.isFinite(id)) handleKanbanDrop(column.title, id)
              }}
            >
              <div className={`surface p-3 mb-3 border-t-4 ${column.color} rounded-t-xl md:rounded-t-none shadow-sm md:shadow-none`}>
                <h3 className="font-bold uppercase text-xs tracking-wider">
                  {column.title} ({column.applications.length})
                </h3>
                <p className="text-[10px] text-text-subtle mt-1">
                  Drag grip to move columns · reorder handle to sort
                </p>
              </div>
              <ReorderList
                items={column.applications}
                getId={(app) => String(app.id)}
                onReorder={(next) => handleReorderInColumn(column.status, next)}
                className="space-y-3 min-h-[80px]"
              >
                {(app) => (
                  <JobCard
                    application={app}
                    onStatusChange={handleStatusChange}
                    onEdit={handleEditApplication}
                    onDelete={handleDeleteApplication}
                    onDuplicate={handleDuplicateApplication}
                    selected={selectedJobs.has(app.id)}
                    onToggleSelect={toggleJobSelect}
                    privacy={privacy}
                    draggable
                    showReorderHandle
                  />
                )}
              </ReorderList>
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
              selected={selectedJobs.has(app.id)}
              onToggleSelect={toggleJobSelect}
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
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        body={confirmState?.body ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        onClose={() => setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />
      <Modal
        open={closedDrop !== null}
        title="Close application"
        onClose={() => setClosedDrop(null)}
      >
        <p className="text-sm text-text-muted mb-4">
          How should “{closedDrop?.jobTitle}” at {closedDrop?.companyName} be closed?
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-secondary" onClick={() => handleClosedStatus('rejected')}>
            Rejected
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleClosedStatus('withdrawn')}>
            Withdrawn
          </button>
          <button type="button" className="btn-primary" onClick={() => handleClosedStatus('archived')}>
            Archived
          </button>
        </div>
      </Modal>
    </div>
  )
}

function JobCard({
  application,
  onStatusChange,
  onEdit,
  onDelete,
  onDuplicate,
  selected,
  onToggleSelect,
  privacy,
  expanded = false,
  draggable = false,
  showReorderHandle = false,
}: {
  application: JobApplication
  onStatusChange: (id: number, status: JobStatus) => void
  onEdit: (app: JobApplication) => void
  onDelete: (id: number) => void
  onDuplicate: (app: JobApplication) => void
  selected?: boolean
  onToggleSelect?: (id: number) => void
  privacy: boolean
  expanded?: boolean
  draggable?: boolean
  showReorderHandle?: boolean
}) {
  const daysSince = getDaysSinceApplied(application)
  const nextInterview = getNextInterview(application)
  const deadlineApproaching = isDeadlineApproaching(application)

  return (
    <div
      className={`surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none hover:border-accent transition-colors ${
        selected ? 'ring-2 ring-accent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {showReorderHandle && <ReorderHandle label="Reorder within column" />}
          {draggable && (
            <button
              type="button"
              className="mt-1 p-1 text-text-subtle hover:text-accent cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/job-id', String(application.id))
                e.dataTransfer.effectAllowed = 'move'
              }}
              aria-label="Drag to change status"
              title="Drag to another column"
            >
              <GripVertical size={14} />
            </button>
          )}
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect(application.id)}
              className="mt-1"
              aria-label={`Select ${application.jobTitle}`}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="flex-1 min-w-0">
            <Link to={`/jobs/${application.id}`} className="font-bold text-base hover:text-accent transition-colors block truncate">
              {application.jobTitle}
            </Link>
            <p className="text-sm text-text-muted truncate">{application.companyName}</p>
          </div>
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
