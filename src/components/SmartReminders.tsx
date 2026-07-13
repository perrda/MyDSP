import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Bell, Calendar, Target, TrendingDown } from 'lucide-react'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { monthKey } from '../domain/monthUtils'
import { formatGBP } from '../utils/format'

interface Reminder {
  id: string
  type: 'budget' | 'goal' | 'todo' | 'job' | 'debt'
  priority: 'high' | 'medium' | 'low'
  title: string
  message: string
  action?: {
    label: string
    path: string
  }
}

export function useSmartReminders() {
  const { data } = usePortfolio()
  const { warning, info } = useToasts()

  useEffect(() => {
    const reminders = calculateReminders(data)
    
    // Only show reminders once per session
    const shownKey = 'mydsp-reminders-shown-' + new Date().toISOString().split('T')[0]
    if (localStorage.getItem(shownKey)) return
    localStorage.setItem(shownKey, 'true')

    // Show high priority reminders immediately
    const highPriority = reminders.filter((r) => r.priority === 'high')
    highPriority.slice(0, 2).forEach((reminder, index) => {
      setTimeout(() => {
        if (reminder.priority === 'high') {
          warning(reminder.title, reminder.message)
        } else {
          info(reminder.title, reminder.message)
        }
      }, index * 2000)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { reminders: calculateReminders(data) }
}

function calculateReminders(data: any): Reminder[] {
  const reminders: Reminder[] = []
  const now = new Date()
  const ym = monthKey()

  // Budget overages
  const spentByCategory = new Map<string, number>()
  for (const s of data.spending) {
    if (!s.date.startsWith(ym)) continue
    const cat = s.category.toLowerCase()
    spentByCategory.set(cat, (spentByCategory.get(cat) ?? 0) + Math.abs(s.amount))
  }

  Object.entries(data.budgetGoals || {}).forEach(([category, limit]) => {
    const spent = spentByCategory.get(category.toLowerCase()) ?? 0
    const limitNum = Number(limit)
    if (spent > limitNum) {
      reminders.push({
        id: `budget-over-${category}`,
        type: 'budget',
        priority: 'high',
        title: `Over budget: ${category}`,
        message: `You've spent ${formatGBP(spent)} of ${formatGBP(limitNum)} this month`,
        action: { label: 'View Budget', path: '/budgets' },
      })
    } else if (spent / limitNum >= 0.9) {
      reminders.push({
        id: `budget-near-${category}`,
        type: 'budget',
        priority: 'medium',
        title: `Budget warning: ${category}`,
        message: `${Math.round((spent / limitNum) * 100)}% of budget used`,
        action: { label: 'View Budget', path: '/budgets' },
      })
    }
  })

  // Goal deadlines
  ;(data.goals || []).forEach((goal: any) => {
    if (!goal.deadline || goal.achieved) return
    const deadline = new Date(goal.deadline)
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil < 0) {
      reminders.push({
        id: `goal-overdue-${goal.name}`,
        type: 'goal',
        priority: 'high',
        title: 'Goal overdue',
        message: `"${goal.name}" deadline passed ${Math.abs(daysUntil)} days ago`,
        action: { label: 'View Goals', path: '/goals' },
      })
    } else if (daysUntil <= 7) {
      reminders.push({
        id: `goal-soon-${goal.name}`,
        type: 'goal',
        priority: 'medium',
        title: 'Goal deadline approaching',
        message: `"${goal.name}" is due in ${daysUntil} days`,
        action: { label: 'View Goals', path: '/goals' },
      })
    }

    // Check if goal is behind schedule
    if (goal.type === 'investment' || goal.type === 'networth') {
      const target = goal.target || 0
      const current = goal.current || 0
      if (current < target * 0.5 && daysUntil < 30) {
        reminders.push({
          id: `goal-behind-${goal.name}`,
          type: 'goal',
          priority: 'medium',
          title: 'Goal behind schedule',
          message: `"${goal.name}" is at ${Math.round((current / target) * 100)}% with ${daysUntil} days left`,
          action: { label: 'View Goals', path: '/goals' },
        })
      }
    }
  })

  // High priority todos due soon
  ;(data.todoItems || []).forEach((todo: any) => {
    if (todo.status === 'done' || todo.status === 'archived') return
    if (!todo.dueDate) return

    const dueDate = new Date(todo.dueDate)
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (todo.priority === 'high') {
      if (daysUntil < 0) {
        reminders.push({
          id: `todo-overdue-${todo.id}`,
          type: 'todo',
          priority: 'high',
          title: 'Task overdue',
          message: `"${todo.title}" was due ${Math.abs(daysUntil)} days ago`,
          action: { label: 'View Todos', path: '/todos' },
        })
      } else if (daysUntil === 0) {
        reminders.push({
          id: `todo-today-${todo.id}`,
          type: 'todo',
          priority: 'high',
          title: 'Task due today',
          message: `"${todo.title}" is due today`,
          action: { label: 'View Todos', path: '/todos' },
        })
      } else if (daysUntil <= 2) {
        reminders.push({
          id: `todo-soon-${todo.id}`,
          type: 'todo',
          priority: 'medium',
          title: 'Task due soon',
          message: `"${todo.title}" is due in ${daysUntil} days`,
          action: { label: 'View Todos', path: '/todos' },
        })
      }
    }
  })

  // Job application deadlines
  ;(data.jobApplications || []).forEach((job: any) => {
    if (!job.deadline) return
    if (['rejected', 'withdrawn', 'archived', 'accepted'].includes(job.status)) return

    const deadline = new Date(job.deadline)
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil <= 2 && daysUntil >= 0) {
      reminders.push({
        id: `job-deadline-${job.id}`,
        type: 'job',
        priority: job.priority === 'high' ? 'high' : 'medium',
        title: 'Job application deadline',
        message: `${job.companyName} - ${job.jobTitle} deadline ${daysUntil === 0 ? 'today' : `in ${daysUntil} days`}`,
        action: { label: 'View Jobs', path: '/jobs' },
      })
    }

    // Interview reminders
    ;(job.interviews || []).forEach((interview: any) => {
      const interviewDate = new Date(interview.scheduledDate)
      const daysTil = Math.ceil((interviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysTil === 1) {
        reminders.push({
          id: `interview-tomorrow-${interview.id}`,
          type: 'job',
          priority: 'high',
          title: 'Interview tomorrow',
          message: `${job.companyName} - ${interview.type} interview`,
          action: { label: 'View Details', path: `/jobs/${job.id}` },
        })
      } else if (daysTil === 0) {
        reminders.push({
          id: `interview-today-${interview.id}`,
          type: 'job',
          priority: 'high',
          title: 'Interview today!',
          message: `${job.companyName} - ${interview.type} at ${interview.scheduledTime || 'TBD'}`,
          action: { label: 'View Details', path: `/jobs/${job.id}` },
        })
      }
    })

    // No response for 14+ days
    if (job.appliedDate && job.status === 'applied') {
      const appliedDate = new Date(job.appliedDate)
      const daysSince = Math.floor((now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince >= 14) {
        reminders.push({
          id: `job-no-response-${job.id}`,
          type: 'job',
          priority: 'low',
          title: 'No response',
          message: `${job.companyName} - ${daysSince} days since application`,
          action: { label: 'Follow up', path: `/jobs/${job.id}` },
        })
      }
    }
  })

  // High interest debt warnings
  ;(data.liabilities || []).forEach((liability: any) => {
    const rate = liability.interestRate || 0
    if (rate > 15 && liability.balance > 1000) {
      reminders.push({
        id: `debt-high-interest-${liability.id}`,
        type: 'debt',
        priority: 'medium',
        title: 'High interest debt',
        message: `${liability.name}: ${formatGBP(liability.balance)} at ${rate}% APR`,
        action: { label: 'View Debt', path: '/liabilities' },
      })
    }
  })

  return reminders.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

// Component to display reminders in Dashboard or dedicated page
export function RemindersPanel() {
  const { reminders } = useSmartReminders()
  const navigate = useNavigate()

  if (reminders.length === 0) {
    return (
      <div className="surface p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none text-center">
        <Bell className="mx-auto mb-2 text-green-500" size={32} />
        <p className="font-semibold text-sm">All clear!</p>
        <p className="text-xs text-text-muted mt-1">No urgent reminders</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reminders.slice(0, 5).map((reminder) => {
        const Icon = 
          reminder.type === 'budget' ? TrendingDown :
          reminder.type === 'goal' ? Target :
          reminder.type === 'todo' ? Calendar :
          reminder.type === 'job' ? Bell :
          AlertCircle

        const colorClass = 
          reminder.priority === 'high' ? 'border-l-red-500 bg-red-500/5' :
          reminder.priority === 'medium' ? 'border-l-amber-500 bg-amber-500/5' :
          'border-l-blue-500 bg-blue-500/5'

        return (
          <div
            key={reminder.id}
            className={`surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none border-l-4 ${colorClass} cursor-pointer hover:bg-surface-hover transition-colors`}
            onClick={() => reminder.action && navigate(reminder.action.path)}
          >
            <div className="flex items-start gap-3">
              <Icon size={20} className={`flex-shrink-0 mt-0.5 ${
                reminder.priority === 'high' ? 'text-red-500' :
                reminder.priority === 'medium' ? 'text-amber-500' :
                'text-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{reminder.title}</p>
                <p className="text-xs text-text-muted mt-0.5">{reminder.message}</p>
                {reminder.action && (
                  <button
                    type="button"
                    className="text-xs text-accent hover:text-accent-bright font-semibold mt-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(reminder.action!.path)
                    }}
                  >
                    {reminder.action.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {reminders.length > 5 && (
        <p className="text-xs text-text-muted text-center">
          + {reminders.length - 5} more reminders
        </p>
      )}
    </div>
  )
}
