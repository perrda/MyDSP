import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
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
import { BackNav } from '../components/ui/BackNav'
import { ConfirmDialog } from '../components/ui/Modal'
import { InterviewModal } from '../components/InterviewModal'
import { NoteModal } from '../components/NoteModal'
import { ContactModal } from '../components/ContactModal'
import { TaskModal } from '../components/TaskModal'
import { DocumentModal } from '../components/DocumentModal'
import { JobFormModal } from '../components/JobFormModal'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { useCssVarFromElementSize } from '../hooks/useCssVarFromElementSize'
import type { JobApplication, JobContact, JobInterview, JobNote, JobStatus } from '../domain/job-types'
import { getDaysSinceApplied, STATUS_COLORS, STATUS_LABELS } from '../domain/jobs'
import { createJobLinkedTodo } from '../domain/jobTodos'
import { createTodoList } from '../domain/todos'
import { downloadBlob, deleteDocumentBlob, getDocumentBlob } from '../storage/documentBlobStore'
import { formatNativeCurrency, privacyClass } from '../utils/format'

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, setData, privacy } = usePortfolio()
  const { success, error: showError } = useToasts()
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
  const actionBarRef = useRef<HTMLDivElement | null>(null)
  useCssVarFromElementSize(actionBarRef, '--job-detail-action-height')

  const application = useMemo(
    () => data.jobApplications?.find((app) => app.id === Number(id)),
    [data.jobApplications, id],
  )

  const linkedTodos = useMemo(
    () =>
      application
        ? (data.todoItems ?? []).filter((t) => t.linkedJobId === application.id)
        : [],
    [data.todoItems, application],
  )

  /** blobDocId → true if bytes exist on this device */
  const [blobPresent, setBlobPresent] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let cancelled = false
    const docs = application?.customDocuments ?? []
    void (async () => {
      const next: Record<number, boolean> = {}
      for (const doc of docs) {
        if (!doc.hasBlob || typeof doc.blobDocId !== 'number') continue
        const blob = await getDocumentBlob(doc.blobDocId)
        next[doc.blobDocId] = Boolean(blob)
      }
      if (!cancelled) setBlobPresent(next)
    })()
    return () => {
      cancelled = true
    }
  }, [application?.customDocuments])

  if (!application) {
    return (
      <div>
        <PageHeader eyebrow="Career" title="Job Not Found" />
        <div className="surface p-8 text-center rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-text-muted mb-4">This job application could not be found.</p>
          <BackNav to="/jobs" label="Back to applications" />
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
    const doc = application.customDocuments[index]
    setConfirmState({
      title: 'Delete document',
      body: `Remove “${doc?.name ?? 'document'}” from this application?`,
      confirmLabel: 'Delete document',
      onConfirm: () => {
        void (async () => {
          if (doc?.blobDocId) {
            try {
              await deleteDocumentBlob(doc.blobDocId)
            } catch {
              /* best-effort */
            }
          }
          updateApplication({
            customDocuments: application.customDocuments.filter((_, i) => i !== index),
          })
          success('Document deleted')
        })()
      },
    })
  }

  const handleDownloadDoc = async (doc: {
    blobDocId?: number
    fileName?: string
    name: string
    hasBlob?: boolean
  }) => {
    if (!doc.blobDocId) return
    const blob = await getDocumentBlob(doc.blobDocId)
    if (!blob) {
      showError(
        'This device only',
        'File bytes are not on this device. Re-upload here, or restore a backup / sync that includes attachments.',
      )
      setBlobPresent((prev) => ({ ...prev, [doc.blobDocId!]: false }))
      return
    }
    downloadBlob(blob, doc.fileName || doc.name)
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

  const handleCreateLinkedTodo = (interview?: JobInterview) => {
    setData((prev) => {
      let lists = prev.todoLists ?? []
      let listId = lists[0]?.id
      if (!listId) {
        const list = createTodoList({ name: 'Career', icon: 'career', color: '#F7931A' })
        lists = [...lists, list]
        listId = list.id
      }
      const todo = createJobLinkedTodo({ listId, job: application, interview })
      return {
        ...prev,
        todoLists: lists,
        todoItems: [...(prev.todoItems ?? []), todo],
      }
    })
    success('To Do created', interview ? 'Interview prep task' : 'Follow-up task')
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
    <div className={`${privacyClass(privacy)} pb-20 sm:pb-0`}>
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
      <div className="mb-4">
        <BackNav to="/jobs" label="Back to applications" />
      </div>

      <PageHeader
        eyebrow="Career"
        title={application.jobTitle}
        description={application.companyName}
        action={
          <div className="hidden sm:flex gap-2">
            <button type="button" onClick={() => setShowJobForm(true)} className="btn-ghost btn-sm btn-icon-edit">
              <Edit2 size={16} strokeWidth={1.75} className="icon-edit" aria-hidden /> Edit Details
            </button>
            <button type="button" onClick={() => handleCreateLinkedTodo()} className="btn-secondary btn-sm">
              <Plus size={14} /> Add Todo
            </button>
            <button type="button" onClick={() => setEditMode(!editMode)} className="btn-ghost btn-sm btn-icon-edit">
              {editMode ? <X size={14} /> : <Edit2 size={16} strokeWidth={1.75} className="icon-edit" aria-hidden />}{' '}
              {editMode ? 'Done' : 'Quick Edit'}
            </button>
            <button type="button" onClick={handleDeleteApplication} className="btn-ghost btn-sm text-red-500">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        }
      />

      {/* Sticky Save / action bar — above bottom nav, safe-area aware */}
      <div
        ref={actionBarRef}
        className="job-detail-action-bar"
        role="toolbar"
        aria-label="Job actions"
      >
        <button type="button" onClick={() => setShowJobForm(true)} className="btn-ghost btn-sm btn-icon-edit min-h-11">
          <Edit2 size={16} strokeWidth={1.75} className="icon-edit" aria-hidden /> Edit
        </button>
        <button type="button" onClick={() => handleCreateLinkedTodo()} className="btn-secondary btn-sm min-h-11">
          <Plus size={14} /> Todo
        </button>
        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          className={`btn-sm btn-icon-edit min-h-11 ${editMode ? 'btn-primary' : 'btn-ghost'}`}
        >
          {editMode ? <X size={14} /> : <Edit2 size={16} strokeWidth={1.75} className="icon-edit" aria-hidden />}{' '}
          {editMode ? 'Save' : 'Quick Edit'}
        </button>
      </div>

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
                      {application.salaryMin != null &&
                        formatNativeCurrency(application.salaryMin, application.salaryCurrency || 'GBP')}
                      {application.salaryMin != null && application.salaryMax != null && ' - '}
                      {application.salaryMax != null &&
                        formatNativeCurrency(application.salaryMax, application.salaryCurrency || 'GBP')}
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
                          {((event.data as JobInterview).type ?? 'other').replace(/-/g, ' ')} Interview
                        </p>
                        <p className="text-xs text-text-muted">
                          {((event.data as JobInterview).interviewers ?? []).join(', ') ||
                            'No interviewers listed'}
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
                  aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                  className="hover:scale-110 transition-transform disabled:cursor-not-allowed min-h-11 min-w-11 flex items-center justify-center"
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
                      <button
                        type="button"
                        onClick={() => handleCreateLinkedTodo(interview)}
                        className="opacity-0 group-hover:opacity-100 text-accent p-0.5"
                        aria-label="Create prep To Do"
                        title="Create prep To Do"
                      >
                        <Plus size={12} />
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

          {/* Linked To Do's */}
          <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Linked To Do's ({linkedTodos.length})</h3>
              <button type="button" onClick={() => handleCreateLinkedTodo()} className="btn-ghost btn-sm">
                <Plus size={12} />
              </button>
            </div>
            {linkedTodos.length === 0 ? (
              <p className="text-xs text-text-muted">No linked To Do's yet</p>
            ) : (
              <div className="space-y-2">
                {linkedTodos.map((t) => (
                  <Link
                    key={t.id}
                    to={`/todos?focus=${t.id}`}
                    className="block p-2 bg-surface-hover rounded text-xs hover:border-accent"
                  >
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-text-subtle uppercase mt-0.5">{t.status}</p>
                  </Link>
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
                  <div
                    key={doc.blobDocId ?? `${doc.name}-${idx}`}
                    className="p-2 bg-surface-hover rounded text-xs group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 text-left min-w-0">
                        <button
                          type="button"
                          className="font-semibold text-left hover:text-accent"
                          onClick={() => {
                            setEditingDocumentIndex(idx)
                            setShowDocumentModal(true)
                          }}
                        >
                          {doc.name}
                        </button>
                        {doc.hasBlob &&
                          typeof doc.blobDocId === 'number' &&
                          blobPresent[doc.blobDocId] === false && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                              This device only — file not stored here. Re-upload or restore/sync attachments.
                            </p>
                          )}
                        {doc.hasBlob && blobPresent[doc.blobDocId!] !== false && (
                          <button
                            type="button"
                            className="block text-accent text-xs underline mt-0.5"
                            onClick={() => void handleDownloadDoc(doc)}
                          >
                            Download file
                          </button>
                        )}
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent text-xs inline-flex items-center gap-1 mt-0.5"
                          >
                            <ExternalLink size={10} /> Open link
                          </a>
                        )}
                        {doc.notes && <p className="text-text-muted mt-1">{doc.notes}</p>}
                      </div>
                      <div className="flex gap-1">
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

      <div className="thumb-cta-bar job-detail-nav-cta" role="toolbar" aria-label="Primary job detail actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/jobs" className="btn-secondary btn-sm">
          Jobs
        </Link>
      </div>
      <div className="thumb-cta-bar-spacer job-detail-nav-cta-spacer" aria-hidden />
    </div>
  )
}
