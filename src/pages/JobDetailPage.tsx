import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit2,
  ExternalLink,
  Globe,
  MapPin,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { InterviewType, JobApplication, JobInterview, JobNote, JobStatus } from '../domain/job-types'
import { createInterview, createJobContact, createJobNote, getDaysSinceApplied, STATUS_COLORS, STATUS_LABELS } from '../domain/jobs'
import { formatGBP, privacyClass } from '../utils/format'

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, setData, privacy } = usePortfolio()
  const { success } = useToasts()
  const [editMode, setEditMode] = useState(false)

  const application = useMemo(
    () => data.jobApplications?.find((app) => app.id === Number(id)),
    [data.jobApplications, id],
  )

  if (!application) {
    return (
      <div>
        <PageHeader eyebrow="Career" title="Job Not Found" />
        <div className="surface p-8 text-center rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-text-muted mb-4">This job application could not be found.</p>
          <Link to="/jobs" className="btn-primary">
            Back to Applications
          </Link>
        </div>
      </div>
    )
  }

  const updateApplication = (updates: Partial<JobApplication>) => {
    setData((prev) => ({
      ...prev,
      jobApplications: prev.jobApplications.map((app) =>
        app.id === application.id ? { ...app, ...updates, updatedAt: new Date().toISOString() } : app,
      ),
    }))
  }

  const handleAddInterview = () => {
    const date = prompt('Interview date (YYYY-MM-DD):')
    if (!date) return
    const typeInput = prompt('Type (phone-screen, technical, behavioral, onsite):')
    const type = (typeInput as InterviewType) || 'other'

    const interview = createInterview({ type, scheduledDate: date })
    updateApplication({ interviews: [...application.interviews, interview] })
    success('Interview added')
  }

  const handleAddNote = () => {
    const content = prompt('Note:')
    if (!content) return
    const note = createJobNote(content)
    updateApplication({ notes: [...application.notes, note] })
    success('Note added')
  }

  const handleAddContact = () => {
    const name = prompt('Contact name:')
    if (!name) return
    const role = prompt('Role/title:')
    if (!role) return
    const contact = createJobContact({ name, role })
    updateApplication({ contacts: [...application.contacts, contact] })
    success('Contact added')
  }

  const handleAddTask = () => {
    const description = prompt('Task description:')
    if (!description) return
    const task = { id: Date.now(), description, completed: false }
    updateApplication({ tasks: [...application.tasks, task] })
    success('Task added')
  }

  const handleAddDocument = () => {
    const name = prompt('Document name:')
    if (!name) return
    const url = prompt('Document URL (optional):')
    const notes = prompt('Notes (optional):')
    const doc = { name, url: url || undefined, notes: notes || undefined }
    updateApplication({ customDocuments: [...application.customDocuments, doc] })
    success('Document added')
  }

  const handleToggleTask = (taskId: number) => {
    updateApplication({
      tasks: application.tasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : undefined }
          : task,
      ),
    })
  }

  const handleDeleteApplication = () => {
    if (!confirm('Delete this job application? This cannot be undone.')) return
    setData((prev) => ({
      ...prev,
      jobApplications: prev.jobApplications.filter((app) => app.id !== application.id),
    }))
    success('Application deleted')
    navigate('/jobs')
  }

  const daysSince = getDaysSinceApplied(application)
  const allEvents = [
    ...application.interviews.map((i) => ({
      type: 'interview' as const,
      date: i.scheduledDate,
      data: i,
    })),
    ...application.notes.map((n) => ({
      type: 'note' as const,
      date: n.createdAt.split('T')[0],
      data: n,
    })),
    { type: 'created' as const, date: application.createdAt.split('T')[0], data: null },
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className={privacyClass(privacy)}>
      <div className="mb-6">
        <Link to="/jobs" className="text-accent hover:text-accent-bright text-sm mb-2 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Applications
        </Link>
      </div>

      <PageHeader
        eyebrow="Career"
        title={application.jobTitle}
        description={application.companyName}
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditMode(!editMode)} className="btn-ghost btn-sm">
              {editMode ? <X size={14} /> : <Edit2 size={14} />} {editMode ? 'Cancel' : 'Edit'}
            </button>
            <button type="button" onClick={handleDeleteApplication} className="btn-ghost btn-sm text-red-500">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Priority */}
          <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <h3 className="font-bold mb-4">Status & Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Status</label>
                <select
                  value={application.status}
                  onChange={(e) => updateApplication({ status: e.target.value as JobStatus })}
                  className={`w-full text-sm px-3 py-2 rounded font-semibold ${STATUS_COLORS[application.status]}`}
                  disabled={!editMode}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Priority</label>
                <select
                  value={application.priority}
                  onChange={(e) => updateApplication({ priority: e.target.value as 'high' | 'medium' | 'low' })}
                  className="w-full text-sm px-3 py-2 rounded bg-surface-hover"
                  disabled={!editMode}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Applied Date</label>
                <input
                  type="date"
                  value={application.appliedDate || ''}
                  onChange={(e) => updateApplication({ appliedDate: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded bg-surface-hover"
                  disabled={!editMode}
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Deadline</label>
                <input
                  type="date"
                  value={application.deadline || ''}
                  onChange={(e) => updateApplication({ deadline: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded bg-surface-hover"
                  disabled={!editMode}
                />
              </div>
            </div>
            {daysSince !== null && (
              <p className="text-sm text-text-muted mt-4">Applied {daysSince} days ago</p>
            )}
          </div>

          {/* Job Details */}
          <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <h3 className="font-bold mb-4">Job Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-text-subtle mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">
                    {application.location} · {application.remote} · {application.jobType}
                  </p>
                </div>
              </div>
              {(application.salaryMin || application.salaryMax) && (
                <div className="flex items-start gap-3">
                  <DollarSign size={16} className="text-text-subtle mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">
                      {application.salaryMin && formatGBP(application.salaryMin)}
                      {application.salaryMin && application.salaryMax && ' - '}
                      {application.salaryMax && formatGBP(application.salaryMax)}
                      {' '}
                      {application.salaryCurrency}/{application.salaryPeriod}
                    </p>
                    {application.equity && <p className="text-xs text-text-muted mt-1">Equity: {application.equity}</p>}
                  </div>
                </div>
              )}
              {application.source && (
                <div className="flex items-start gap-3">
                  <Globe size={16} className="text-text-subtle mt-0.5 flex-shrink-0" />
                  <p className="text-sm">Source: {application.source}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {application.jobUrl && (
                  <a href={application.jobUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm text-xs">
                    <ExternalLink size={12} /> Job Posting
                  </a>
                )}
                {application.companyWebsite && (
                  <a href={application.companyWebsite} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm text-xs">
                    <Globe size={12} /> Company Site
                  </a>
                )}
                {application.linkedInUrl && (
                  <a href={application.linkedInUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm text-xs">
                    <ExternalLink size={12} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {application.description && (
            <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <h3 className="font-bold mb-3">Description</h3>
              <p className="text-sm text-text-muted whitespace-pre-wrap">{application.description}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <h3 className="font-bold mb-4">Timeline</h3>
            <div className="space-y-4">
              {allEvents.map((event, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    {event.type === 'interview' && <Users size={14} className="text-accent" />}
                    {event.type === 'note' && <MessageSquare size={14} className="text-accent" />}
                    {event.type === 'created' && <Calendar size={14} className="text-accent" />}
                  </div>
                  <div className="flex-1 pb-4 border-b border-border last:border-0">
                    <p className="text-xs text-text-muted mb-1">{event.date}</p>
                    {event.type === 'interview' && (
                      <div>
                        <p className="text-sm font-semibold">
                          {(event.data as JobInterview).type.replace('-', ' ')} Interview
                        </p>
                        <p className="text-xs text-text-muted">
                          {(event.data as JobInterview).interviewers.join(', ') || 'No interviewers listed'}
                        </p>
                      </div>
                    )}
                    {event.type === 'note' && (
                      <p className="text-sm">{(event.data as JobNote).content}</p>
                    )}
                    {event.type === 'created' && <p className="text-sm font-semibold">Application Created</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Rating */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <h3 className="font-bold mb-3 text-sm">Rating</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => updateApplication({ rating: star })}
                  disabled={!editMode}
                  className="hover:scale-110 transition-transform disabled:cursor-not-allowed"
                >
                  <Star size={20} className={star <= application.rating ? 'fill-accent text-accent' : 'text-text-subtle'} />
                </button>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Tasks</h3>
              <button type="button" onClick={handleAddTask} className="btn-ghost btn-sm">
                <Plus size={12} />
              </button>
            </div>
            {application.tasks.length === 0 ? (
              <p className="text-xs text-text-muted">No tasks yet</p>
            ) : (
              <div className="space-y-2">
                {application.tasks.map((task) => (
                  <label key={task.id} className="flex items-start gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="mt-0.5"
                    />
                    <span className={task.completed ? 'line-through text-text-subtle' : ''}>{task.description}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Interviews */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Interviews ({application.interviews.length})</h3>
              <button type="button" onClick={handleAddInterview} className="btn-ghost btn-sm">
                <Plus size={12} />
              </button>
            </div>
            {application.interviews.length === 0 ? (
              <p className="text-xs text-text-muted">No interviews scheduled</p>
            ) : (
              <div className="space-y-2">
                {application.interviews.map((interview) => (
                  <div key={interview.id} className="p-2 bg-surface-hover rounded text-xs">
                    <p className="font-semibold">{interview.type.replace('-', ' ')}</p>
                    <p className="text-text-muted">{interview.scheduledDate}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Contacts ({application.contacts.length})</h3>
              <button type="button" onClick={handleAddContact} className="btn-ghost btn-sm">
                <Plus size={12} />
              </button>
            </div>
            {application.contacts.length === 0 ? (
              <p className="text-xs text-text-muted">No contacts yet</p>
            ) : (
              <div className="space-y-2">
                {application.contacts.map((contact) => (
                  <div key={contact.id} className="p-2 bg-surface-hover rounded text-xs">
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-text-muted">{contact.role}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Documents ({application.customDocuments.length})</h3>
              <button type="button" onClick={handleAddDocument} className="btn-ghost btn-sm">
                <Plus size={12} />
              </button>
            </div>
            {application.customDocuments.length === 0 ? (
              <p className="text-xs text-text-muted">No documents yet</p>
            ) : (
              <div className="space-y-2">
                {application.customDocuments.map((doc, idx) => (
                  <div key={idx} className="p-2 bg-surface-hover rounded text-xs">
                    <p className="font-semibold">{doc.name}</p>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright text-xs flex items-center gap-1">
                        <ExternalLink size={10} /> View
                      </a>
                    )}
                    {doc.notes && <p className="text-text-muted mt-1">{doc.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Notes ({application.notes.length})</h3>
              <button type="button" onClick={handleAddNote} className="btn-ghost btn-sm">
                <Plus size={12} />
              </button>
            </div>
            {application.notes.length === 0 ? (
              <p className="text-xs text-text-muted">No notes yet</p>
            ) : (
              <div className="space-y-2">
                {application.notes.slice(0, 3).map((note) => (
                  <div key={note.id} className="p-2 bg-surface-hover rounded text-xs">
                    <p className="text-text-muted mb-1">{note.createdAt.split('T')[0]}</p>
                    <p className="line-clamp-2">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
