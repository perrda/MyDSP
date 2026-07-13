// IndexedDB Query Builder - SQL-like interface for IndexedDB

export interface QueryBuilderConfig {
  dbName: string
  version?: number
  debug?: boolean
}

export interface IndexDefinition {
  name: string
  keyPath: string | string[]
  unique?: boolean
  multiEntry?: boolean
}

export interface StoreSchema {
  name: string
  keyPath?: string | string[]
  autoIncrement?: boolean
  indexes?: IndexDefinition[]
}

export type WhereOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'between' | 'like' | 'startsWith'
export type SortDirection = 'asc' | 'desc'

export interface WhereClause {
  field: string
  operator: WhereOperator
  value: any
  value2?: any // For 'between'
}

export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  direction?: SortDirection
}

// === QUERY BUILDER CLASS ===

export class QueryBuilder<T = any> {
  private config: Required<QueryBuilderConfig>
  private db: IDBDatabase | null = null
  private storeName: string | null = null
  private whereClauses: WhereClause[] = []
  private queryOptions: QueryOptions = {}

  constructor(config: QueryBuilderConfig) {
    this.config = {
      dbName: config.dbName,
      version: config.version ?? 1,
      debug: config.debug ?? false,
    }
  }

  // Initialize database with schemas
  async init(schemas: StoreSchema[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.log('Database initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        schemas.forEach(schema => {
          // Delete existing store if it exists
          if (db.objectStoreNames.contains(schema.name)) {
            db.deleteObjectStore(schema.name)
          }

          // Create store
          const store = db.createObjectStore(schema.name, {
            keyPath: schema.keyPath,
            autoIncrement: schema.autoIncrement ?? false,
          })

          // Create indexes
          schema.indexes?.forEach(index => {
            store.createIndex(index.name, index.keyPath, {
              unique: index.unique ?? false,
              multiEntry: index.multiEntry ?? false,
            })
          })

          this.log('Created store:', schema.name)
        })
      }
    })
  }

  // === QUERY METHODS ===

  // Select store
  from(storeName: string): this {
    this.storeName = storeName
    this.whereClauses = []
    this.queryOptions = {}
    return this
  }

  // Where clause
  where(field: string, operator: WhereOperator, value: any, value2?: any): this {
    this.whereClauses.push({ field, operator, value, value2 })
    return this
  }

  // Order by
  orderBy(field: string, direction: SortDirection = 'asc'): this {
    this.queryOptions.orderBy = field
    this.queryOptions.direction = direction
    return this
  }

  // Limit results
  limit(count: number): this {
    this.queryOptions.limit = count
    return this
  }

  // Skip results
  offset(count: number): this {
    this.queryOptions.offset = count
    return this
  }

  // Execute query
  async get(): Promise<T[]> {
    if (!this.db || !this.storeName) {
      throw new Error('Database not initialized or store not selected')
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName!, 'readonly')
      const store = tx.objectStore(this.storeName!)
      const results: T[] = []

      // Determine if we can use an index
      const { index, range } = this.getIndexAndRange(store)

      const request = index
        ? index.openCursor(range, this.queryOptions.direction === 'desc' ? 'prev' : 'next')
        : store.openCursor(range, this.queryOptions.direction === 'desc' ? 'prev' : 'next')

      let skipped = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          // Apply where clauses
          if (this.matchesWhere(cursor.value)) {
            // Apply offset
            if (this.queryOptions.offset && skipped < this.queryOptions.offset) {
              skipped++
            } else {
              results.push(cursor.value)
              // Apply limit
              if (this.queryOptions.limit && results.length >= this.queryOptions.limit) {
                resolve(results)
                return
              }
            }
          }
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  // Get first result
  async first(): Promise<T | null> {
    const results = await this.limit(1).get()
    return results[0] || null
  }

  // Count results
  async count(): Promise<number> {
    if (!this.db || !this.storeName) {
      throw new Error('Database not initialized or store not selected')
    }

    const results = await this.get()
    return results.length
  }

  // Check if exists
  async exists(): Promise<boolean> {
    const result = await this.first()
    return result !== null
  }

  // === INSERT/UPDATE/DELETE ===

  // Insert one
  async insert(data: T): Promise<any> {
    if (!this.db || !this.storeName) {
      throw new Error('Database not initialized or store not selected')
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName!, 'readwrite')
      const store = tx.objectStore(this.storeName!)
      const request = store.add(data)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Insert many
  async insertMany(items: T[]): Promise<any[]> {
    if (!this.db || !this.storeName) {
      throw new Error('Database not initialized or store not selected')
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName!, 'readwrite')
      const store = tx.objectStore(this.storeName!)
      const results: any[] = []

      items.forEach(item => {
        const request = store.add(item)
        request.onsuccess = () => results.push(request.result)
      })

      tx.oncomplete = () => resolve(results)
      tx.onerror = () => reject(tx.error)
    })
  }

  // Update
  async update(data: Partial<T>): Promise<number> {
    if (!this.db || !this.storeName) {
      throw new Error('Database not initialized or store not selected')
    }

    const items = await this.get()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName!, 'readwrite')
      const store = tx.objectStore(this.storeName!)
      let updated = 0

      items.forEach(item => {
        const updatedItem = { ...item, ...data }
        const request = store.put(updatedItem)
        request.onsuccess = () => updated++
      })

      tx.oncomplete = () => resolve(updated)
      tx.onerror = () => reject(tx.error)
    })
  }

  // Delete
  async delete(): Promise<number> {
    if (!this.db || !this.storeName) {
      throw new Error('Database not initialized or store not selected')
    }

    const items = await this.get()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName!, 'readwrite')
      const store = tx.objectStore(this.storeName!)
      let deleted = 0

      items.forEach(item => {
        const key = this.getKey(store, item)
        const request = store.delete(key)
        request.onsuccess = () => deleted++
      })

      tx.oncomplete = () => resolve(deleted)
      tx.onerror = () => reject(tx.error)
    })
  }

  // === AGGREGATION ===

  // Sum
  async sum(field: string): Promise<number> {
    const items = await this.get()
    return items.reduce((sum, item) => sum + (Number((item as any)[field]) || 0), 0)
  }

  // Average
  async avg(field: string): Promise<number> {
    const items = await this.get()
    if (items.length === 0) return 0
    const total = await this.sum(field)
    return total / items.length
  }

  // Min
  async min(field: string): Promise<number> {
    const items = await this.get()
    if (items.length === 0) return 0
    return Math.min(...items.map(item => Number((item as any)[field]) || 0))
  }

  // Max
  async max(field: string): Promise<number> {
    const items = await this.get()
    if (items.length === 0) return 0
    return Math.max(...items.map(item => Number((item as any)[field]) || 0))
  }

  // Group by
  async groupBy(field: string): Promise<Record<string, T[]>> {
    const items = await this.get()
    return items.reduce((groups, item) => {
      const key = String((item as any)[field])
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
      return groups
    }, {} as Record<string, T[]>)
  }

  // === HELPER METHODS ===

  private getIndexAndRange(store: IDBObjectStore): { index: IDBIndex | null; range: IDBKeyRange | undefined } {
    // If we have a simple equality where clause, try to use an index
    if (this.whereClauses.length === 1 && this.whereClauses[0].operator === '=') {
      const clause = this.whereClauses[0]
      try {
        const index = store.index(clause.field)
        const range = IDBKeyRange.only(clause.value)
        return { index, range }
      } catch {
        // Index doesn't exist, use cursor
      }
    }

    // For range queries, try to use index if available
    if (this.whereClauses.length === 1 && this.whereClauses[0].operator !== '=') {
      const clause = this.whereClauses[0]
      try {
        const index = store.index(clause.field)
        const range = this.buildKeyRange(clause)
        return { index, range }
      } catch {
        // Index doesn't exist, use cursor
      }
    }

    return { index: null, range: undefined }
  }

  private buildKeyRange(clause: WhereClause): IDBKeyRange | undefined {
    switch (clause.operator) {
      case '>':
        return IDBKeyRange.lowerBound(clause.value, true)
      case '>=':
        return IDBKeyRange.lowerBound(clause.value, false)
      case '<':
        return IDBKeyRange.upperBound(clause.value, true)
      case '<=':
        return IDBKeyRange.upperBound(clause.value, false)
      case 'between':
        return IDBKeyRange.bound(clause.value, clause.value2, false, false)
      default:
        return undefined
    }
  }

  private matchesWhere(item: any): boolean {
    return this.whereClauses.every(clause => {
      const value = item[clause.field]

      switch (clause.operator) {
        case '=':
          return value === clause.value
        case '!=':
          return value !== clause.value
        case '>':
          return value > clause.value
        case '>=':
          return value >= clause.value
        case '<':
          return value < clause.value
        case '<=':
          return value <= clause.value
        case 'in':
          return Array.isArray(clause.value) && clause.value.includes(value)
        case 'between':
          return value >= clause.value && value <= clause.value2
        case 'like':
          return String(value).includes(String(clause.value))
        case 'startsWith':
          return String(value).startsWith(String(clause.value))
        default:
          return true
      }
    })
  }

  private getKey(store: IDBObjectStore, item: any): any {
    const keyPath = store.keyPath
    if (typeof keyPath === 'string') {
      return item[keyPath]
    } else if (Array.isArray(keyPath)) {
      return keyPath.map(k => item[k])
    }
    return item
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[QueryBuilder]', ...args)
    }
  }

  // Close database
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// === HELPER FUNCTIONS ===

export function createQueryBuilder<T = any>(config: QueryBuilderConfig): QueryBuilder<T> {
  return new QueryBuilder<T>(config)
}

// === MIGRATION HELPERS ===

export interface Migration {
  version: number
  up: (db: IDBDatabase) => void
  down?: (db: IDBDatabase) => void
}

export async function runMigrations(dbName: string, migrations: Migration[]): Promise<void> {
  const sortedMigrations = migrations.sort((a, b) => a.version - b.version)
  const latestVersion = sortedMigrations[sortedMigrations.length - 1]?.version || 1

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, latestVersion)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      sortedMigrations.forEach(migration => {
        if (migration.version > oldVersion) {
          migration.up(db)
        }
      })
    }
  })
}

// === EXAMPLE USAGE ===

/*
// Define schemas
const schemas: StoreSchema[] = [
  {
    name: 'users',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'email', keyPath: 'email', unique: true },
      { name: 'age', keyPath: 'age' },
      { name: 'name', keyPath: 'name' },
    ],
  },
  {
    name: 'posts',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'createdAt', keyPath: 'createdAt' },
    ],
  },
]

// Create query builder
const db = createQueryBuilder({ dbName: 'myapp', version: 1, debug: true })
await db.init(schemas)

// Insert data
await db.from('users').insert({ name: 'John', email: 'john@example.com', age: 30 })
await db.from('users').insertMany([
  { name: 'Jane', email: 'jane@example.com', age: 25 },
  { name: 'Bob', email: 'bob@example.com', age: 35 },
])

// Query data
const users = await db.from('users').where('age', '>', 25).orderBy('name', 'asc').get()
const john = await db.from('users').where('email', '=', 'john@example.com').first()
const count = await db.from('users').where('age', '>=', 30).count()

// Update
await db.from('users').where('name', '=', 'John').update({ age: 31 })

// Delete
await db.from('users').where('age', '<', 20).delete()

// Aggregation
const avgAge = await db.from('users').avg('age')
const maxAge = await db.from('users').max('age')
const grouped = await db.from('users').groupBy('age')

// Pagination
const page1 = await db.from('users').limit(10).offset(0).get()
const page2 = await db.from('users').limit(10).offset(10).get()

// Complex queries
const results = await db
  .from('users')
  .where('age', 'between', 25, 35)
  .where('name', 'startsWith', 'J')
  .orderBy('age', 'desc')
  .limit(5)
  .get()

// Close
db.close()
*/
