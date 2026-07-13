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
import { ConfirmDialog } from '../components/ui/Modal'
import { InterviewModal } from '../components/InterviewModal'
import { NoteModal } from '../components/NoteModal'
import { ContactModal } from '../components/ContactModal'
import { TaskModal } from '../components/TaskModal'
import { DocumentModal } from '../components/DocumentModal'
import { JobFormModal } from '../components/JobFormModal'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { JobApplication, JobContact, JobInterview, JobNote, JobStatus } from '../domain/job-types'
import { getDaysSinceApplied, STATUS_COLORS, STATUS_LABELS } from '../domain/jobs'
import { formatGBP, privacyClass } from '../utils/format'

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, setData, privacy } = usePortfolio()
  const { success } = useToasts()
  const [editMode, setEditMode] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showJobForm, setShowJobForm] = useState(false)
  const [editingInterview, setEditingInterview] = useState<JobInterview | undefined>()
  const [editingNote, setEditingNote] = useState<JobNote | undefined>()
  const [editingContact, setEditingContact] = useState<JobContact | undefined>()
  const [editingTask, setEditingTask] = useState<
    { id: number; description: string; dueDate?: string; completed: boolean; completedAt?: string } | undefined
  >()
  const [editingDocumentIndex, setEditingDocumentIndex] = useState<number | null>(null)
  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)

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
      jobApplications: (prev.jobApplications ?? []).map((app) =>
        app.id === application.id ? { ...app, ...updates, updatedAt: new Date().toISOString() } : app,
      ),
    }))
  }

  const handleAddInterview = () => {
    setEditingInterview(undefined)
    setShowInterviewModal(true)
  }

  const handleSaveInterview = (interview: JobInterview) => {
    if (editingInterview) {
      updateApplication({
        interviews: application.interviews.map((i) => (i.id === interview.id ? interview : i)),
      })
      success('Interview updated')
    } else {
      updateApplication({ interviews: [...application.interviews, interview] })
      success('Interview added')
    }
    setShowInterviewModal(false)
    setEditingInterview(undefined)
  }

  const handleAddNote = () => {
    setEditingNote(undefined)
    setShowNoteModal(true)
  }

  const handleSaveNote = (note: JobNote) => {
    if (editingNote) {
      updateApplication({
        notes: application.notes.map((n) => (n.id === note.id ? note : n)),
      })
      success('Note updated')
    } else {
      updateApplication({ notes: [...application.notes, note] })
      success('Note added')
    }
    setShowNoteModal(false)
    setEditingNote(undefined)
  }

  const handleAddContact = () => {
    setEditingContact(undefined)
    setShowContactModal(true)
  }

  const handleSaveContact = (contact: JobContact) => {
    if (editingContact) {
      updateApplication({
        contacts: application.contacts.map((c) => (c.id === contact.id ? contact : c)),
      })
      success('Contact updated')
    } else {
      updateApplication({ contacts: [...application.contacts, contact] })
      success('Contact added')
    }
    setShowContactModal(false)
    setEditingContact(undefined)
  }

  const handleAddTask = () => {
    setEditingTask(undefined)
    setShowTaskModal(true)
  }

  const handleSaveTask = (task: {
    id: number
    description: string
    dueDate?: string
    completed: boolean
    completedAt?: string
  }) => {
    if (editingTask) {
      updateApplication({
        tasks: (application.tasks ?? []).map((t) => (t.id === task.id ? { ...t, ...task } : t)),
      })
      success('Task updated')
    } else {
      updateApplication({ tasks: [...(application.tasks ?? []), task] })
      success('Task added')
    }
    setShowTaskModal(false)
    setEditingTask(undefined)
  }

  const handleAddDocument = () => {
    setEditingDocumentIndex(null)
    setShowDocumentModal(true)
  }

  const handleSaveDocument = (doc: { name: string; url?: string; notes?: string }) => {
    if (editingDocumentIndex != null) {
      updateApplication({
        customDocuments: (application.customDocuments ?? []).map((d, i) =>
          i === editingDocumentIndex ? doc : d,
        ),
      })
      success('Document updated')
    } else {
      updateApplication({ customDocuments: [...(application.customDocuments ?? []), doc] })
      success('Document added')
    }
    setShowDocumentModal(false)
    setEditingDocumentIndex(null)
  }

  const handleDeleteInterview = (interviewId: number) => {
    setConfirmState({
      title: 'Delete interview',
      body: 'Delete this interview? This cannot be undone.',
      confirmLabel: 'Delete interview',
      onConfirm: () => {
        updateApplication({ interviews: application.interviews.filter((i) => i.id !== interviewId) })
        success('Interview deleted')
      },
    })
  }

  const handleDeleteNote = (noteId: number) => {
    setConfirmState({
      title: 'Delete note',
      body: 'Delete this note? This cannot be undone.',
      confirmLabel: 'Delete note',
      onConfirm: () => {
        updateApplication({ notes: application.notes.filter((n) => n.id !== noteId) })
        success('Note deleted')
      },
    })
  }

  const handleDeleteContact = (contactId: number) => {
    setConfirmState({
      title: 'Delete contact',
      body: 'Delete this contact? This cannot be undone.',
      confirmLabel: 'Delete contact',
      onConfirm: () => {
        updateApplication({ contacts: application.contacts.filter((c) => c.id !== contactId) })
        success('Contact deleted')
      },
    })
  }

  const handleDeleteTask = (taskId: number) => {
    updateApplication({ tasks: application.tasks.filter((t) => t.id !== taskId) })
    success('Task deleted')
  }

  const handleDeleteDocument = (index: number) => {
    updateApplication({
      customDocuments: application.customDocuments.filter((_, i) => i !== index),
    })
    success('Document deleted')
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
    setConfirmState({
      title: 'Delete application',
      body: 'Delete this job application? This cannot be undone.',
      confirmLabel: 'Delete application',
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          jobApplications: (prev.jobApplications ?? []).filter((app) => app.id !== application.id),
        }))
        success('Application deleted')
        navigate('/jobs')
      },
    })
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
      {showInterviewModal && (
        <InterviewModal
          interview={editingInterview}
          onSave={handleSaveInterview}
          onClose={() => {
            setShowInterviewModal(false)
            setEditingInterview(undefined)
          }}
        />
      )}
      {showNoteModal && (
        <NoteModal
          note={editingNote}
          onSave={handleSaveNote}
          onClose={() => {
            setShowNoteModal(false)
            setEditingNote(undefined)
          }}
        />
      )}
      {showContactModal && (
        <ContactModal
          contact={editingContact}
          onSave={handleSaveContact}
          onClose={() => {
            setShowContactModal(false)
            setEditingContact(undefined)
          }}
        />
      )}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          onSave={handleSaveTask}
          onClose={() => {
            setShowTaskModal(false)
            setEditingTask(undefined)
          }}
        />
      )}
      {showDocumentModal && (
        <DocumentModal
          document={
            editingDocumentIndex != null
              ? application.customDocuments[editingDocumentIndex]
              : undefined
          }
          onSave={handleSaveDocument}
          onClose={() => {
            setShowDocumentModal(false)
            setEditingDocumentIndex(null)
          }}
        />
      )}
      {showJobForm && (
        <JobFormModal
          application={application}
          onSave={(app) => {
            updateApplication(app)
            setShowJobForm(false)
            success('Application updated')
          }}
          onClose={() => setShowJobForm(false)}
        />
      )}
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
            <button type="button" onClick={() => setShowJobForm(true)} className="btn-ghost btn-sm">
              <Edit2 size={14} /> Edit Details
            </button>
            <button type="button" onClick={() => setEditMode(!editMode)} className="btn-ghost btn-sm">
              {editMode ? <X size={14} /> : <Edit2 size={14} />} {editMode ? 'Done' : 'Quick Edit'}
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
                  <div key={task.id} className="flex items-start gap-2 text-sm group">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="mt-0.5"
                    />
                    <button
                      type="button"
                      className={`flex-1 text-left ${task.completed ? 'line-through text-text-subtle' : ''}`}
                      onClick={() => {
                        setEditingTask(task)
                        setShowTaskModal(true)
                      }}
                    >
                      {task.description}
                      {task.dueDate ? (
                        <span className="block text-xs text-text-subtle mt-0.5">Due {task.dueDate}</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 p-0.5"
                      aria-label="Delete task"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
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
                  <div key={interview.id} className="p-2 bg-surface-hover rounded text-xs group">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="text-left flex-1"
                        onClick={() => {
                          setEditingInterview(interview)
                          setShowInterviewModal(true)
                        }}
                      >
                        <p className="font-semibold">{interview.type.replace('-', ' ')}</p>
                        <p className="text-text-muted">{interview.scheduledDate}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInterview(interview.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 p-0.5"
                        aria-label="Delete interview"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
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
                  <div key={contact.id} className="p-2 bg-surface-hover rounded text-xs group">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="text-left flex-1"
                        onClick={() => {
                          setEditingContact(contact)
                          setShowContactModal(true)
                        }}
                      >
                        <p className="font-semibold">{contact.name}</p>
                        <p className="text-text-muted">{contact.role}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 p-0.5"
                        aria-label="Delete contact"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
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
                  <div key={`${doc.name}-${idx}`} className="p-2 bg-surface-hover rounded text-xs group">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => {
                          setEditingDocumentIndex(idx)
                          setShowDocumentModal(true)
                        }}
                      >
                        <p className="font-semibold">{doc.name}</p>
                        {doc.url && (
                          <span className="text-accent text-xs inline-flex items-center gap-1">
                            <ExternalLink size={10} /> Link attached
                          </span>
                        )}
                        {doc.notes && <p className="text-text-muted mt-1">{doc.notes}</p>}
                      </button>
                      <div className="flex gap-1">
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent p-0.5"
                            aria-label="Open document link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(idx)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 p-0.5"
                          aria-label="Delete document"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
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
                {application.notes.map((note) => (
                  <div key={note.id} className="p-2 bg-surface-hover rounded text-xs group">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="text-left flex-1"
                        onClick={() => {
                          setEditingNote(note)
                          setShowNoteModal(true)
                        }}
                      >
                        <p className="text-text-muted mb-1">{note.createdAt.split('T')[0]}</p>
                        <p className="line-clamp-3">{note.content}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 p-0.5"
                        aria-label="Delete note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        body={confirmState?.body ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        onClose={() => setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />
    </div>
  )
}
