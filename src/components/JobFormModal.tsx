import { useState } from 'react'
import { X } from 'lucide-react'
import type { JobApplication, JobStatus, SalaryPeriod } from '../domain/job-types'
import { createJobApplication } from '../domain/jobs'

interface JobFormModalProps {
  application?: JobApplication
  onSave: (app: JobApplication) => void
  onClose: () => void
}

export function JobFormModal({ application, onSave, onClose }: JobFormModalProps) {
  const [formData, setFormData] = useState({
    companyName: application?.companyName || '',
    jobTitle: application?.jobTitle || '',
    status: application?.status || ('wishlist' as JobStatus),
    priority: application?.priority || 'medium',
    jobUrl: application?.jobUrl || '',
    companyWebsite: application?.companyWebsite || '',
    linkedInUrl: application?.linkedInUrl || '',
    applicationPortalUrl: application?.applicationPortalUrl || '',
    appliedDate: application?.appliedDate || '',
    deadline: application?.deadline || '',
    source: application?.source || 'Direct',
    referralContact: application?.referralContact || '',
    salaryMin: application?.salaryMin?.toString() || '',
    salaryMax: application?.salaryMax?.toString() || '',
    salaryCurrency: application?.salaryCurrency || 'GBP',
    salaryPeriod: application?.salaryPeriod || ('annual' as SalaryPeriod),
    equity: application?.equity || '',
    benefits: application?.benefits || '',
    location: application?.location || '',
    remote: application?.remote || 'onsite',
    jobType: application?.jobType || 'full-time',
    description: application?.description || '',
    requirements: application?.requirements || '',
    responsibilities: application?.responsibilities || '',
    cvVersion: application?.cvVersion || '',
    coverLetterVersion: application?.coverLetterVersion || '',
    portfolioUrl: application?.portfolioUrl || '',
    rating: application?.rating || 0,
    pros: application?.pros || '',
    cons: application?.cons || '',
    tags: application?.tags?.join(', ') || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.companyName || !formData.jobTitle) return

    const emptyToUndef = (v: string) => (v.trim() ? v.trim() : undefined)
    const salaryMin = formData.salaryMin.trim() ? Number(formData.salaryMin) : undefined
    const salaryMax = formData.salaryMax.trim() ? Number(formData.salaryMax) : undefined
    const tags = formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const cleaned = {
      companyName: formData.companyName.trim(),
      jobTitle: formData.jobTitle.trim(),
      status: formData.status,
      priority: formData.priority as JobApplication['priority'],
      jobUrl: emptyToUndef(formData.jobUrl),
      companyWebsite: emptyToUndef(formData.companyWebsite),
      linkedInUrl: emptyToUndef(formData.linkedInUrl),
      applicationPortalUrl: emptyToUndef(formData.applicationPortalUrl),
      appliedDate: emptyToUndef(formData.appliedDate),
      deadline: emptyToUndef(formData.deadline),
      source: formData.source.trim() || 'Direct',
      referralContact: emptyToUndef(formData.referralContact),
      salaryMin: Number.isFinite(salaryMin) ? salaryMin : undefined,
      salaryMax: Number.isFinite(salaryMax) ? salaryMax : undefined,
      salaryCurrency: formData.salaryCurrency || 'GBP',
      salaryPeriod: formData.salaryPeriod,
      equity: emptyToUndef(formData.equity),
      benefits: emptyToUndef(formData.benefits),
      location: formData.location.trim() || 'Unknown',
      remote: formData.remote as JobApplication['remote'],
      jobType: formData.jobType as JobApplication['jobType'],
      description: emptyToUndef(formData.description),
      requirements: emptyToUndef(formData.requirements),
      responsibilities: emptyToUndef(formData.responsibilities),
      cvVersion: emptyToUndef(formData.cvVersion),
      coverLetterVersion: emptyToUndef(formData.coverLetterVersion),
      portfolioUrl: emptyToUndef(formData.portfolioUrl),
      rating: formData.rating || 0,
      pros: emptyToUndef(formData.pros),
      cons: emptyToUndef(formData.cons),
      tags,
    }

    const app = application
      ? {
          ...application,
          ...cleaned,
          updatedAt: new Date().toISOString(),
        }
      : createJobApplication(cleaned)

    onSave(app as JobApplication)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="surface rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{application ? 'Edit Application' : 'New Application'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="font-bold mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as JobStatus })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="wishlist">Wishlist</option>
                  <option value="researching">Researching</option>
                  <option value="applying">Applying</option>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'high' | 'medium' | 'low' })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Applied Date</label>
                <input
                  type="date"
                  value={formData.appliedDate}
                  onChange={(e) => setFormData({ ...formData, appliedDate: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
            </div>
          </section>

          {/* URLs */}
          <section>
            <h3 className="font-bold mb-3">Links & URLs</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Job Posting URL</label>
                <input
                  type="url"
                  value={formData.jobUrl}
                  onChange={(e) => setFormData({ ...formData, jobUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Company Website</label>
                <input
                  type="url"
                  value={formData.companyWebsite}
                  onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={formData.linkedInUrl}
                  onChange={(e) => setFormData({ ...formData, linkedInUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="https://linkedin.com/jobs/..."
                />
              </div>
            </div>
          </section>

          {/* Compensation */}
          <section>
            <h3 className="font-bold mb-3">Compensation</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Min Salary</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={formData.salaryMin}
                  onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Max Salary</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={formData.salaryMax}
                  onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Currency</label>
                <select
                  value={formData.salaryCurrency}
                  onChange={(e) => setFormData({ ...formData, salaryCurrency: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Period</label>
                <select
                  value={formData.salaryPeriod}
                  onChange={(e) => setFormData({ ...formData, salaryPeriod: e.target.value as SalaryPeriod })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Equity</label>
                <input
                  type="text"
                  value={formData.equity}
                  onChange={(e) => setFormData({ ...formData, equity: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="e.g. 0.5% stock options"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Benefits</label>
                <input
                  type="text"
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="Health, dental, pension..."
                />
              </div>
            </div>
          </section>

          {/* Job Details */}
          <section>
            <h3 className="font-bold mb-3">Job Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="City, Country"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Work Mode</label>
                <select
                  value={formData.remote}
                  onChange={(e) => setFormData({ ...formData, remote: e.target.value as 'onsite' | 'hybrid' | 'remote' })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Job Type</label>
                <select
                  value={formData.jobType}
                  onChange={(e) => setFormData({ ...formData, jobType: e.target.value as 'full-time' | 'part-time' | 'contract' | 'internship' })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Source</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="LinkedIn, Indeed, Referral..."
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Referral Contact</label>
                <input
                  type="text"
                  value={formData.referralContact}
                  onChange={(e) => setFormData({ ...formData, referralContact: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs text-text-subtle mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                rows={4}
              />
            </div>
          </section>

          {/* Application Materials */}
          <section>
            <h3 className="font-bold mb-3">Application Materials</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">CV Version</label>
                <input
                  type="text"
                  value={formData.cvVersion}
                  onChange={(e) => setFormData({ ...formData, cvVersion: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="e.g. CV_2026_Tech"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Cover Letter</label>
                <input
                  type="text"
                  value={formData.coverLetterVersion}
                  onChange={(e) => setFormData({ ...formData, coverLetterVersion: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Portfolio URL</label>
                <input
                  type="url"
                  value={formData.portfolioUrl}
                  onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  placeholder="https://"
                />
              </div>
            </div>
          </section>

          {/* Notes & Rating */}
          <section>
            <h3 className="font-bold mb-3">Notes & Rating</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Pros</label>
                <textarea
                  value={formData.pros}
                  onChange={(e) => setFormData({ ...formData, pros: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Cons</label>
                <textarea
                  value={formData.cons}
                  onChange={(e) => setFormData({ ...formData, cons: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs text-text-subtle mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                placeholder="fintech, startup, remote"
              />
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="submit" className="btn-primary flex-1">
              {application ? 'Save Changes' : 'Create Application'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
