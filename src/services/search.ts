// Advanced search using IndexedDB Query Builder

import { createQueryBuilder } from '../utils/queryBuilder'
import { logger } from '../utils/logger'
import type { SpendingEntry, Goal } from '../domain/types'
import type { TodoItem } from '../domain/todo-types'
import type { JobApplication } from '../domain/job-types'

let searchDB: ReturnType<typeof createQueryBuilder> | null = null

// Initialize search database
export async function initializeSearchDB(): Promise<void> {
  try {
    searchDB = createQueryBuilder({
      dbName: 'mydsp-search',
      version: 1,
    })

    logger.info('Search database initialized', undefined, 'search')
  } catch (error) {
    logger.error('Failed to initialize search database', error as Error, 'search')
  }
}

// Index spending data
export async function indexSpending(entries: SpendingEntry[]): Promise<void> {
  if (!searchDB) return

  try {
    const stop = logger.startTimer('index-spending')
    
    for (const entry of entries) {
      await searchDB.from('spending').insert({
        id: entry.id,
        description: entry.description.toLowerCase(),
        category: entry.category.toLowerCase(),
        amount: entry.amount,
        date: entry.date,
        method: entry.method,
        type: 'spending',
        searchText: `${entry.description} ${entry.category}`.toLowerCase(),
      })
    }

    stop()
    logger.info(`Indexed ${entries.length} spending entries`, undefined, 'search')
  } catch (error) {
    logger.error('Failed to index spending', error as Error, 'search')
  }
}

// Index goals
export async function indexGoals(goals: Goal[]): Promise<void> {
  if (!searchDB) return

  try {
    const stop = logger.startTimer('index-goals')
    
    for (const goal of goals) {
      await searchDB.from('goals').insert({
        id: goal.id,
        name: goal.name.toLowerCase(),
        target: goal.target,
        metric: goal.metric,
        type: 'goal',
        searchText: goal.name.toLowerCase(),
      })
    }

    stop()
    logger.info(`Indexed ${goals.length} goals`, undefined, 'search')
  } catch (error) {
    logger.error('Failed to index goals', error as Error, 'search')
  }
}

// Index todos
export async function indexTodos(todos: TodoItem[]): Promise<void> {
  if (!searchDB) return

  try {
    const stop = logger.startTimer('index-todos')
    
    for (const todo of todos) {
      await searchDB.from('todos').insert({
        id: todo.id,
        title: todo.title.toLowerCase(),
        description: (todo.description || '').toLowerCase(),
        priority: todo.priority,
        status: todo.status,
        type: 'todo',
        searchText: `${todo.title} ${todo.description || ''}`.toLowerCase(),
      })
    }

    stop()
    logger.info(`Indexed ${todos.length} todos`, undefined, 'search')
  } catch (error) {
    logger.error('Failed to index todos', error as Error, 'search')
  }
}

// Index job applications
export async function indexJobs(jobs: JobApplication[]): Promise<void> {
  if (!searchDB) return

  try {
    const stop = logger.startTimer('index-jobs')
    
    for (const job of jobs) {
      await searchDB.from('jobs').insert({
        id: job.id,
        companyName: job.companyName.toLowerCase(),
        jobTitle: job.jobTitle.toLowerCase(),
        status: job.status,
        location: (job.location || '').toLowerCase(),
        type: 'job',
        searchText: `${job.companyName} ${job.jobTitle} ${job.location || ''}`.toLowerCase(),
      })
    }

    stop()
    logger.info(`Indexed ${jobs.length} jobs`, undefined, 'search')
  } catch (error) {
    logger.error('Failed to index jobs', error as Error, 'search')
  }
}

// Search across all indexed data
export async function globalSearch(query: string, options?: {
  types?: Array<'spending' | 'goal' | 'todo' | 'job'>
  limit?: number
}): Promise<Array<{ type: string; data: any; score: number }>> {
  if (!searchDB || !query.trim()) return []

  const searchQuery = query.toLowerCase().trim()
  const types = options?.types || ['spending', 'goal', 'todo', 'job']
  const limit = options?.limit || 20
  
  const results: Array<{ type: string; data: any; score: number }> = []

  try {
    const stop = logger.startTimer('global-search')

    // Search spending
    if (types.includes('spending')) {
      const spending = await searchDB
        .from('spending')
        .where('searchText', 'like', searchQuery)
        .limit(limit)
        .get()
      
      results.push(...spending.map((item: any) => ({
        type: 'spending',
        data: item,
        score: calculateRelevance(searchQuery, item.searchText),
      })))
    }

    // Search goals
    if (types.includes('goal')) {
      const goals = await searchDB
        .from('goals')
        .where('searchText', 'like', searchQuery)
        .limit(limit)
        .get()
      
      results.push(...goals.map((item: any) => ({
        type: 'goal',
        data: item,
        score: calculateRelevance(searchQuery, item.searchText),
      })))
    }

    // Search todos
    if (types.includes('todo')) {
      const todos = await searchDB
        .from('todos')
        .where('searchText', 'like', searchQuery)
        .limit(limit)
        .get()
      
      results.push(...todos.map((item: any) => ({
        type: 'todo',
        data: item,
        score: calculateRelevance(searchQuery, item.searchText),
      })))
    }

    // Search jobs
    if (types.includes('job')) {
      const jobs = await searchDB
        .from('jobs')
        .where('searchText', 'like', searchQuery)
        .limit(limit)
        .get()
      
      results.push(...jobs.map((item: any) => ({
        type: 'job',
        data: item,
        score: calculateRelevance(searchQuery, item.searchText),
      })))
    }

    stop()
    logger.info(`Global search: "${query}" found ${results.length} results`, undefined, 'search')

    // Sort by relevance score
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  } catch (error) {
    logger.error('Global search failed', error as Error, 'search')
    return []
  }
}

// Calculate relevance score (0-1)
function calculateRelevance(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  
  // Exact match
  if (textLower === queryLower) return 1.0
  
  // Starts with query
  if (textLower.startsWith(queryLower)) return 0.9
  
  // Contains query as whole word
  if (new RegExp(`\\b${queryLower}\\b`).test(textLower)) return 0.8
  
  // Contains query anywhere
  if (textLower.includes(queryLower)) return 0.7
  
  // Calculate word overlap
  const queryWords = queryLower.split(/\s+/)
  const textWords = textLower.split(/\s+/)
  const overlap = queryWords.filter(word => textWords.some(tw => tw.includes(word))).length
  
  return 0.5 * (overlap / queryWords.length)
}

// Clear all indexed data
export async function clearSearchIndex(): Promise<void> {
  if (!searchDB) return

  try {
    await searchDB.from('spending').delete()
    await searchDB.from('goals').delete()
    await searchDB.from('todos').delete()
    await searchDB.from('jobs').delete()
    
    logger.info('Search index cleared', undefined, 'search')
  } catch (error) {
    logger.error('Failed to clear search index', error as Error, 'search')
  }
}

// Rebuild entire search index
export async function rebuildSearchIndex(data: {
  spending?: SpendingEntry[]
  goals?: Goal[]
  todos?: TodoItem[]
  jobs?: JobApplication[]
}): Promise<void> {
  await clearSearchIndex()
  
  if (data.spending) await indexSpending(data.spending)
  if (data.goals) await indexGoals(data.goals)
  if (data.todos) await indexTodos(data.todos)
  if (data.jobs) await indexJobs(data.jobs)
  
  logger.info('Search index rebuilt', {
    spending: data.spending?.length || 0,
    goals: data.goals?.length || 0,
    todos: data.todos?.length || 0,
    jobs: data.jobs?.length || 0,
  }, 'search')
}
