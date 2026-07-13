// Batch operations for bulk data processing

export interface BatchOperation<T> {
  type: 'create' | 'update' | 'delete'
  item: T
  id?: string | number
}

export interface BatchResult<T> {
  success: boolean
  item?: T
  error?: string
  operation: BatchOperation<T>
}

export interface BatchOperationOptions {
  continueOnError?: boolean
  batchSize?: number
  validateBefore?: boolean
  dryRun?: boolean
}

// === BATCH PROCESSOR ===

export class BatchProcessor<T> {
  private operations: BatchOperation<T>[] = []
  
  create(item: T): this {
    this.operations.push({ type: 'create', item })
    return this
  }
  
  update(id: string | number, item: T): this {
    this.operations.push({ type: 'update', item, id })
    return this
  }
  
  delete(id: string | number, item: T): this {
    this.operations.push({ type: 'delete', item, id })
    return this
  }
  
  clear(): this {
    this.operations = []
    return this
  }
  
  count(): number {
    return this.operations.length
  }
  
  async execute(
    handler: (operation: BatchOperation<T>) => Promise<T | void>,
    options: BatchOperationOptions = {}
  ): Promise<BatchResult<T>[]> {
    const {
      continueOnError = true,
      batchSize = 100,
      dryRun = false
    } = options
    
    const results: BatchResult<T>[] = []
    
    for (let i = 0; i < this.operations.length; i += batchSize) {
      const batch = this.operations.slice(i, i + batchSize)
      
      for (const operation of batch) {
        try {
          if (dryRun) {
            results.push({
              success: true,
              operation,
              item: operation.item
            })
          } else {
            const result = await handler(operation)
            results.push({
              success: true,
              operation,
              item: result as T || operation.item
            })
          }
        } catch (error) {
          results.push({
            success: false,
            operation,
            error: error instanceof Error ? error.message : String(error)
          })
          
          if (!continueOnError) {
            break
          }
        }
      }
    }
    
    return results
  }
  
  getSummary(results: BatchResult<T>[]): {
    total: number
    successful: number
    failed: number
    successRate: number
  } {
    const total = results.length
    const successful = results.filter(r => r.success).length
    const failed = total - successful
    const successRate = total > 0 ? successful / total : 0
    
    return { total, successful, failed, successRate }
  }
}

// === BULK OPERATIONS ===

export async function bulkCreate<T>(
  items: T[],
  createFn: (item: T) => Promise<T>,
  options: BatchOperationOptions = {}
): Promise<BatchResult<T>[]> {
  const processor = new BatchProcessor<T>()
  items.forEach(item => processor.create(item))
  
  return processor.execute(async (op) => {
    return await createFn(op.item)
  }, options)
}

export async function bulkUpdate<T>(
  updates: Array<{ id: string | number; item: T }>,
  updateFn: (id: string | number, item: T) => Promise<T>,
  options: BatchOperationOptions = {}
): Promise<BatchResult<T>[]> {
  const processor = new BatchProcessor<T>()
  updates.forEach(({ id, item }) => processor.update(id, item))
  
  return processor.execute(async (op) => {
    if (op.id === undefined) throw new Error('ID required for update')
    return await updateFn(op.id, op.item)
  }, options)
}

export async function bulkDelete<T>(
  items: Array<{ id: string | number; item: T }>,
  deleteFn: (id: string | number) => Promise<void>,
  options: BatchOperationOptions = {}
): Promise<BatchResult<T>[]> {
  const processor = new BatchProcessor<T>()
  items.forEach(({ id, item }) => processor.delete(id, item))
  
  return processor.execute(async (op) => {
    if (op.id === undefined) throw new Error('ID required for delete')
    await deleteFn(op.id)
  }, options)
}

// === TRANSACTION SUPPORT ===

export interface Transaction<T> {
  operations: BatchOperation<T>[]
  rollback: () => Promise<void>
  commit: () => Promise<void>
}

export class TransactionManager<T> {
  private operations: BatchOperation<T>[] = []
  private completedOperations: Array<{ operation: BatchOperation<T>; previousState?: T }> = []
  
  addOperation(operation: BatchOperation<T>, previousState?: T): void {
    this.operations.push(operation)
    this.completedOperations.push({ operation, previousState })
  }
  
  async execute(
    handler: (operation: BatchOperation<T>) => Promise<T | void>
  ): Promise<void> {
    for (const operation of this.operations) {
      await handler(operation)
    }
  }
  
  async rollback(
    handler: (operation: BatchOperation<T>, previousState?: T) => Promise<void>
  ): Promise<void> {
    // Rollback in reverse order
    for (let i = this.completedOperations.length - 1; i >= 0; i--) {
      const { operation, previousState } = this.completedOperations[i]
      await handler(operation, previousState)
    }
    
    this.clear()
  }
  
  clear(): void {
    this.operations = []
    this.completedOperations = []
  }
}

// === PARALLEL PROCESSING ===

export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []
  const queue = [...items]
  
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) {
        const result = await processor(item)
        results.push(result)
      }
    }
  }
  
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  
  return results
}

export async function processInBatches<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 100
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }
  
  return results
}

// === PROGRESS TRACKING ===

export interface ProgressCallback {
  (progress: {
    current: number
    total: number
    percent: number
    item?: any
  }): void
}

export async function processWithProgress<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  onProgress: ProgressCallback
): Promise<R[]> {
  const results: R[] = []
  const total = items.length
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const result = await processor(item, i)
    results.push(result)
    
    onProgress({
      current: i + 1,
      total,
      percent: ((i + 1) / total) * 100,
      item
    })
  }
  
  return results
}

// === ERROR HANDLING ===

export interface BatchError<T> {
  operation: BatchOperation<T>
  error: Error
  retryable: boolean
}

export async function processWithRetry<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    maxRetries?: number
    retryDelay?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<Array<R | Error>> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    shouldRetry = () => true
  } = options
  
  const results: Array<R | Error> = []
  
  for (const item of items) {
    let lastError: Error | null = null
    let retries = 0
    
    while (retries <= maxRetries) {
      try {
        const result = await processor(item)
        results.push(result)
        lastError = null
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (retries < maxRetries && shouldRetry(lastError)) {
          retries++
          await new Promise(resolve => setTimeout(resolve, retryDelay * retries))
        } else {
          break
        }
      }
    }
    
    if (lastError) {
      results.push(lastError)
    }
  }
  
  return results
}
