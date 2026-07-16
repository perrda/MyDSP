import type { JobApplication, JobStatus } from './job-types'

/** Pipeline stages aligned with Jobs kanban columns. */
export type JobPipelineStage = {
  id: string
  label: string
  statuses: JobStatus[]
  count: number
}

const PIPELINE_STAGES: Array<{ id: string; label: string; statuses: JobStatus[] }> = [
  { id: 'wishlist', label: 'Wishlist', statuses: ['wishlist', 'researching'] },
  { id: 'applying', label: 'Applying', statuses: ['applying'] },
  { id: 'applied', label: 'Applied', statuses: ['applied', 'screening'] },
  { id: 'interview', label: 'Interview', statuses: ['interviewing'] },
  { id: 'offer', label: 'Offer', statuses: ['offer', 'accepted'] },
  { id: 'closed', label: 'Closed', statuses: ['rejected', 'withdrawn', 'archived'] },
]

/** Count applications per pipeline stage from existing status fields. */
export function calculateJobPipelineCounts(
  applications: JobApplication[],
): JobPipelineStage[] {
  return PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: applications.filter((a) => stage.statuses.includes(a.status)).length,
  }))
}
