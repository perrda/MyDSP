import { useState } from 'react'
import { X, User, Briefcase, Mail, Phone, Link as LinkIcon, Calendar } from 'lucide-react'
import type { JobContact } from '../domain/job-types'

interface ContactModalProps {
  contact?: JobContact
  onSave: (contact: JobContact) => void
  onClose: () => void
}

export function ContactModal({ contact, onSave, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: contact?.name || '',
    role: contact?.role || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    linkedIn: contact?.linkedIn || '',
    notes: contact?.notes || '',
    lastContact: contact?.lastContact || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.role.trim()) return

    const contactData: JobContact = contact
      ? {
          ...contact,
          ...formData,
        }
      : {
          id: Date.now(),
          ...formData,
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
          {/* Name & Role */}
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

          {/* Email & Phone */}
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
              />
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <LinkIcon size={16} /> LinkedIn Profile
            </label>
            <input
              type="url"
              value={formData.linkedIn}
              onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          {/* Last Contact Date */}
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[100px]"
              placeholder="Any additional notes about this contact..."
            />
          </div>

          {/* Actions */}
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
