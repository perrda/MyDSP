import { useState } from 'react'
import { X, Calendar, Clock, MapPin, Users, MessageSquare } from 'lucide-react'
import type { InterviewType, JobInterview } from '../domain/job-types'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between rounded-t-xl md:rounded-t-none">
          <h2 className="text-xl font-bold">{interview ? 'Edit Interview' : 'Add Interview'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Interview Type */}
          <div>
            <label className="block text-sm font-semibold mb-2">Interview Type *</label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as InterviewType })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
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
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Calendar size={16} /> Date & Time *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                required
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Duration & Outcome */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock size={16} /> Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Outcome</label>
              <select
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value as 'pending' | 'passed' | 'failed' | 'cancelled' })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Location / Meeting URL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <MapPin size={16} /> Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="Office address or Remote"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Meeting URL</label>
              <input
                type="url"
                value={formData.meetingUrl}
                onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="https://zoom.us/..."
              />
            </div>
          </div>

          {/* Interviewers */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Users size={16} /> Interviewers
            </label>
            <input
              type="text"
              value={formData.interviewers}
              onChange={(e) => setFormData({ ...formData, interviewers: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              placeholder="John Smith, Jane Doe (comma separated)"
            />
          </div>

          {/* Preparation Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2">Preparation Notes</label>
            <textarea
              value={formData.preparation}
              onChange={(e) => setFormData({ ...formData, preparation: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[80px]"
              placeholder="Topics to review, questions to ask..."
            />
          </div>

          {/* Interview Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <MessageSquare size={16} /> Interview Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[100px]"
              placeholder="What happened during the interview..."
            />
          </div>

          {/* Feedback */}
          {formData.outcome !== 'pending' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Feedback Received</label>
              <textarea
                value={formData.feedback}
                onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[100px]"
                placeholder="Feedback from interviewers..."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              {interview ? 'Save Changes' : 'Add Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
