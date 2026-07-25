import { useState } from 'react'
import { X, User, Briefcase, Mail, Phone, Link as LinkIcon, Calendar } from 'lucide-react'
import type { JobContact, JobContactMethod } from '../domain/job-types'

interface ContactModalProps {
  contact?: JobContact
  onSave: (contact: JobContact) => void
  onClose: () => void
}

const PREFERRED_OPTIONS: Array<{ value: '' | JobContactMethod; label: string }> = [
  { value: '', label: 'Not set' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn / URL' },
  { value: 'other', label: 'Other' },
]

export function ContactModal({ contact, onSave, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: contact?.name || '',
    role: contact?.role || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    linkedIn: contact?.linkedIn || '',
    preferredContactMethod: (contact?.preferredContactMethod ?? '') as '' | JobContactMethod,
    preferredContactOther: contact?.preferredContactOther || '',
    notes: contact?.notes || '',
    lastContact: contact?.lastContact || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.role.trim()) return

    const preferredContactMethod = formData.preferredContactMethod || undefined
    const preferredContactOther =
      preferredContactMethod === 'other'
        ? formData.preferredContactOther.trim() || undefined
        : undefined

    const contactData: JobContact = contact
      ? {
          ...contact,
          name: formData.name.trim(),
          role: formData.role.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          linkedIn: formData.linkedIn.trim() || undefined,
          preferredContactMethod,
          preferredContactOther,
          notes: formData.notes.trim() || undefined,
          lastContact: formData.lastContact || undefined,
        }
      : {
          id: Date.now(),
          name: formData.name.trim(),
          role: formData.role.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          linkedIn: formData.linkedIn.trim() || undefined,
          preferredContactMethod,
          preferredContactOther,
          notes: formData.notes.trim() || undefined,
          lastContact: formData.lastContact || undefined,
        }

    onSave(contactData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between rounded-t-xl md:rounded-t-none">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User size={20} />
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <User size={16} /> Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="John Smith"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <Briefcase size={16} /> Role / Title *
              </label>
              <input
                type="text"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="Engineering Manager"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <Mail size={16} /> Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="john@company.com"
                data-testid="job-contact-email"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <Phone size={16} /> Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                placeholder="+44 7123 456789"
                data-testid="job-contact-phone"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <LinkIcon size={16} /> LinkedIn / URL
            </label>
            <input
              type="url"
              value={formData.linkedIn}
              onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              placeholder="https://linkedin.com/in/..."
              data-testid="job-contact-url"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Preferred method of contact</label>
              <select
                value={formData.preferredContactMethod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredContactMethod: e.target.value as '' | JobContactMethod,
                  })
                }
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                data-testid="job-contact-preferred"
              >
                {PREFERRED_OPTIONS.map((opt) => (
                  <option key={opt.value || 'unset'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {formData.preferredContactMethod === 'other' ? (
              <div>
                <label className="block text-sm font-semibold mb-2">Other method</label>
                <input
                  type="text"
                  value={formData.preferredContactOther}
                  onChange={(e) => setFormData({ ...formData, preferredContactOther: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                  placeholder="WhatsApp, Slack, …"
                  data-testid="job-contact-preferred-other"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  <Calendar size={16} /> Last Contact Date
                </label>
                <input
                  type="date"
                  value={formData.lastContact}
                  onChange={(e) => setFormData({ ...formData, lastContact: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                />
              </div>
            )}
          </div>

          {formData.preferredContactMethod === 'other' ? (
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <Calendar size={16} /> Last Contact Date
              </label>
              <input
                type="date"
                value={formData.lastContact}
                onChange={(e) => setFormData({ ...formData, lastContact: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-semibold mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[100px]"
              placeholder="Any additional notes about this contact..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              {contact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
