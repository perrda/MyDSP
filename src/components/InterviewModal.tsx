import { useState } from 'react'
import { Calendar, Clock, MapPin, Users, MessageSquare } from 'lucide-react'
import type { InterviewType, JobInterview } from '../domain/job-types'
import { Modal } from './ui/Modal'

interface InterviewModalProps {
  interview?: JobInterview
  onSave: (interview: JobInterview) => void
  onClose: () => void
}

const INTERVIEW_TYPES: Array<{ value: InterviewType; label: string }> = [
  { value: 'phone-screen', label: 'Phone Screen' },
  { value: 'technical', label: 'Technical Interview' },
  { value: 'behavioral', label: 'Behavioral Interview' },
  { value: 'system-design', label: 'System Design' },
  { value: 'take-home', label: 'Take Home Assignment' },
  { value: 'onsite', label: 'Onsite Interview' },
  { value: 'panel', label: 'Panel Interview' },
  { value: 'final', label: 'Final Round' },
  { value: 'other', label: 'Other' },
]

export function InterviewModal({ interview, onSave, onClose }: InterviewModalProps) {
  const [formData, setFormData] = useState({
    type: interview?.type || 'phone-screen' as InterviewType,
    scheduledDate: interview?.scheduledDate || '',
    scheduledTime: interview?.scheduledTime || '',
    duration: interview?.duration?.toString() || '',
    location: interview?.location || '',
    meetingUrl: interview?.meetingUrl || '',
    interviewers: interview?.interviewers?.join(', ') || '',
    notes: interview?.notes || '',
    preparation: interview?.preparation || '',
    outcome: interview?.outcome || 'pending' as 'pending' | 'passed' | 'failed' | 'cancelled',
    feedback: interview?.feedback || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.scheduledDate) return

    const interviewData: JobInterview = interview
      ? {
          ...interview,
          type: formData.type,
          scheduledDate: formData.scheduledDate,
          scheduledTime: formData.scheduledTime,
          duration: formData.duration ? Number(formData.duration) : undefined,
          location: formData.location,
          meetingUrl: formData.meetingUrl,
          interviewers: formData.interviewers.split(',').map((i) => i.trim()).filter(Boolean),
          notes: formData.notes,
          preparation: formData.preparation,
          outcome: formData.outcome!,
          feedback: formData.feedback,
          completedAt: formData.outcome !== 'pending' && !interview.completedAt
            ? new Date().toISOString()
            : interview.completedAt,
        }
      : {
          id: Date.now(),
          type: formData.type,
          scheduledDate: formData.scheduledDate,
          scheduledTime: formData.scheduledTime,
          duration: formData.duration ? Number(formData.duration) : undefined,
          location: formData.location,
          meetingUrl: formData.meetingUrl,
          interviewers: formData.interviewers.split(',').map((i) => i.trim()).filter(Boolean),
          notes: formData.notes,
          preparation: formData.preparation,
          outcome: formData.outcome!,
          feedback: formData.feedback,
          createdAt: new Date().toISOString(),
        }

    onSave(interviewData)
  }

  return (
    <Modal open title={interview ? 'Edit Interview' : 'Add Interview'} onClose={onClose} size="full">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interview Type */}
          <div>
            <label className="block text-xs text-text-subtle mb-1">Interview Type *</label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as InterviewType })}
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
            >
              {INTERVIEW_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs text-text-subtle mb-1 flex items-center gap-2">
              <Calendar size={14} aria-hidden /> Date & Time *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="date"
                required
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
              />
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
              />
            </div>
          </div>

          {/* Duration & Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-subtle mb-1 flex items-center gap-2">
                <Clock size={14} aria-hidden /> Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-xs text-text-subtle mb-1">Outcome</label>
              <select
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value as 'pending' | 'passed' | 'failed' | 'cancelled' })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
              >
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Location / Meeting URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-subtle mb-1 flex items-center gap-2">
                <MapPin size={14} aria-hidden /> Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                placeholder="Office address or Remote"
              />
            </div>
            <div>
              <label className="block text-xs text-text-subtle mb-1">Meeting URL</label>
              <input
                type="url"
                value={formData.meetingUrl}
                onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                placeholder="https://zoom.us/..."
              />
            </div>
          </div>

          {/* Interviewers */}
          <div>
            <label className="block text-xs text-text-subtle mb-1 flex items-center gap-2">
              <Users size={14} aria-hidden /> Interviewers
            </label>
            <input
              type="text"
              value={formData.interviewers}
              onChange={(e) => setFormData({ ...formData, interviewers: e.target.value })}
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
              placeholder="John Smith, Jane Doe (comma separated)"
            />
          </div>

          {/* Preparation Notes */}
          <div>
            <label className="block text-xs text-text-subtle mb-1">Preparation Notes</label>
            <textarea
              value={formData.preparation}
              onChange={(e) => setFormData({ ...formData, preparation: e.target.value })}
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-[80px]"
              placeholder="Topics to review, questions to ask..."
            />
          </div>

          {/* Interview Notes */}
          <div>
            <label className="block text-xs text-text-subtle mb-1 flex items-center gap-2">
              <MessageSquare size={14} aria-hidden /> Interview Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-[100px]"
              placeholder="What happened during the interview..."
            />
          </div>

          {/* Feedback */}
          {formData.outcome !== 'pending' && (
            <div>
              <label className="block text-xs text-text-subtle mb-1">Feedback Received</label>
              <textarea
                value={formData.feedback}
                onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-[100px]"
                placeholder="Feedback from interviewers..."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 min-h-11">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 min-h-11">
              {interview ? 'Save Changes' : 'Add Interview'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
