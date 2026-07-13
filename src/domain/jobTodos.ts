import type { TodoItem } from './todo-types'
import { createTodoItem } from './todos'
import type { JobApplication, JobInterview } from './job-types'

/** Build a prep todo linked to a job (and optional interview). */
export function createJobLinkedTodo(opts: {
  listId: number
  job: JobApplication
  interview?: JobInterview
  title?: string
}): TodoItem {
  const { listId, job, interview } = opts
  const title =
    opts.title ||
    (interview
      ? `Prep: ${interview.type.replace(/-/g, ' ')} — ${job.companyName}`
      : `Follow up: ${job.jobTitle} @ ${job.companyName}`)

  return createTodoItem({
    listId,
    title,
    description: interview
      ? `Interview on ${interview.scheduledDate}${interview.scheduledTime ? ` at ${interview.scheduledTime}` : ''}.\nJob: ${job.jobTitle}`
      : `Linked from job application: ${job.jobTitle} at ${job.companyName}`,
    priority: job.priority === 'high' ? 'high' : 'medium',
    dueDate: interview?.scheduledDate || job.deadline,
    tags: ['job', `job:${job.id}`, job.companyName.toLowerCase().replace(/\s+/g, '-')],
    linkedJobId: job.id,
    isFinanceRelated: false,
  })
}
