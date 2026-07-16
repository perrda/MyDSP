# MyDSP Developer Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Domain Logic](#domain-logic)
3. [Data Validation](#data-validation)
4. [Search & Filtering](#search--filtering)
5. [Caching Strategy](#caching-strategy)
6. [API Integration](#api-integration)
7. [Testing Guide](#testing-guide)
8. [Performance](#performance)

---

## Architecture Overview

MyDSP follows a **local-first** architecture with these core principles:

- **TypeScript-first**: 100% type-safe codebase
- **React + Context**: Centralized state management
- **IndexedDB**: Local persistence layer
- **Web Workers**: Background calculations (ready)
- **Progressive Enhancement**: Works offline, syncs when online

### Directory Structure

```
src/
├── components/        # UI components
│   ├── layout/       # Navigation, shells
│   ├── ui/           # Reusable UI components
│   └── charts/       # Data visualization
├── context/          # React context providers
├── domain/           # Business logic (pure functions)
├── hooks/            # Custom React hooks
├── pages/            # Route components
├── services/         # External services (API, sync)
├── storage/          # Local storage utilities
└── utils/            # Pure utility functions
```

---

## Domain Logic

All business logic lives in `src/domain/` as **pure functions**.

### Key Principles

1. **Pure Functions**: No side effects, deterministic
2. **Immutable Data**: Never mutate inputs
3. **Type-Safe**: Full TypeScript coverage
4. **Testable**: Easy to unit test

### Example: Portfolio Calculations

```typescript
// src/domain/portfolio.ts
import type { CryptoHolding, EquityHolding } from './types'

export function calculatePortfolioValue(
  crypto: CryptoHolding[],
  equities: EquityHolding[]
): number {
  const cryptoValue = crypto.reduce((sum, c) => sum + c.qty * c.cost, 0)
  const equityValue = equities.reduce((sum, e) => sum + e.shares * e.avgCost, 0)
  return cryptoValue + equityValue
}
```

### Available Domain Modules

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `types.ts` | Type definitions | Core interfaces |
| `defaults.ts` | Default values | Sample data, normalization |
| `section104.ts` | CGT calculations | UK tax logic |
| `advancedAnalytics.ts` | Forecasting | ML-style predictions |
| `smartData.ts` | Pattern recognition | Recurring detection |
| `todos.ts` | Todo management | CRUD operations |
| `jobs.ts` | Job tracking | Application management |

---

## Data Validation

Comprehensive validation utilities in `src/utils/validators.ts`.

### Basic Usage

```typescript
import { validateNumber, validateDate, validateString } from '@/utils/validators'

// Number validation
const result = validateNumber(42, { min: 0, max: 100 })
if (result.valid) {
  console.log('Sanitized:', result.sanitized) // 42
}

// Date validation
const dateResult = validateDate('2026-07-13', {
  allowFuture: false,
  allowPast: true
})

// String validation
const strResult = validateString('John Doe', {
  minLength: 2,
  maxLength: 50,
  trim: true,
  required: true
})
```

### Composite Validators

```typescript
import { validateTransaction } from '@/utils/validators'

const transaction = {
  date: '2026-07-13',
  description: 'Groceries',
  amount: 45.50,
  category: 'food'
}

const result = validateTransaction(transaction)
if (!result.valid) {
  console.error('Validation failed:', result.error)
}
```

### Custom Validators

```typescript
import { createValidator } from '@/utils/validators'

const ageValidator = createValidator([
  { validator: (v) => v >= 18, message: 'Must be 18 or older' },
  { validator: (v) => v <= 120, message: 'Invalid age' }
])

const result = ageValidator(25)
```

---

## Search & Filtering

Advanced search with fuzzy matching in `src/utils/search.ts`.

### Quick Start

```typescript
import { globalSearch } from '@/utils/search'

const results = globalSearch('tesla', {
  spending: data.spending,
  crypto: data.crypto,
  equities: data.equities,
  goals: data.goals,
  jobs: data.jobs,
  todos: data.todos
})

// Results are ranked by score
results.forEach(r => {
  console.log(`${r.title} (${r.score.toFixed(2)})`)
})
```

### Search Index

```typescript
import { SearchIndex } from '@/utils/search'

// Create index
const index = new SearchIndex(['description', 'category'])
index.add(transactions)

// Search with fuzzy matching
const results = index.search('groc', {
  fuzzy: true,
  maxResults: 10
})
```

### Advanced Filtering

```typescript
import { filterItems } from '@/utils/search'

const filtered = filterItems(spending, {
  search: 'amazon',
  filters: {
    category: ['shopping', 'tech']
  },
  dateRange: {
    from: '2026-01-01',
    to: '2026-12-31'
  },
  amountRange: {
    min: 10,
    max: 500
  },
  sort: {
    field: 'date',
    direction: 'desc'
  }
})
```

---

## Caching Strategy

Intelligent caching system in `src/utils/cache.ts`.

### Cache Types

1. **Memory Cache**: Fast, short-lived (2-10 min)
2. **IndexedDB Cache**: Persistent, long-lived (1 hour+)

### Usage

```typescript
import { calculationCache, dataCache } from '@/utils/cache'

// Cache a calculation
calculationCache.set('portfolio-value', totalValue, 5 * 60 * 1000) // 5 min

// Retrieve from cache
const cached = calculationCache.get('portfolio-value')
if (cached !== null) {
  return cached
}

// Invalidate by pattern
calculationCache.invalidatePattern(/^portfolio-/)
```

### Memoization

```typescript
import { memoize } from '@/utils/cache'

const expensiveCalculation = memoize(
  (a: number, b: number) => {
    // Heavy computation
    return a * b
  },
  {
    keyFn: (a, b) => `${a}-${b}`,
    ttl: 10 * 60 * 1000 // 10 min
  }
)

const result = expensiveCalculation(5, 10) // Computed
const cached = expensiveCalculation(5, 10) // From cache
```

### Background Calculations

```typescript
import { calculator } from '@/utils/cache'

const result = await calculator.calculate('net-worth', async () => {
  // Long-running calculation
  return computeNetWorth(data)
})
```

---

## API Integration

Export utilities in `src/domain/apiExport.ts`.

### Export Portfolio Data

```typescript
import { exportPortfolioSummary } from '@/domain/apiExport'

const response = exportPortfolioSummary(data)
// {
//   success: true,
//   data: { netWorth, assets, liabilities, counts },
//   meta: { timestamp, version }
// }
```

### Export to CSV

```typescript
import { exportSpendingCSV } from '@/domain/apiExport'

const csv = exportSpendingCSV(data, {
  format: 'csv',
  dateRange: { from: '2026-01-01', to: '2026-12-31' }
})

// Download CSV
const blob = new Blob([csv], { type: 'text/csv' })
const url = URL.createObjectURL(blob)
```

### Webhook Events

```typescript
import { createWebhookPayload, triggerWebhook } from '@/domain/apiExport'

const payload = createWebhookPayload('goal.completed', {
  goalId: 123,
  name: 'Emergency Fund',
  target: 10000,
  achieved: new Date().toISOString()
})

await triggerWebhook('https://your-webhook.com/events', payload)
```

---

## Testing Guide

### Unit Testing Domain Logic

```typescript
import { describe, it, expect } from 'vitest'
import { validateNumber } from '@/utils/validators'

describe('validateNumber', () => {
  it('validates positive numbers', () => {
    const result = validateNumber(42, { min: 0 })
    expect(result.valid).toBe(true)
    expect(result.sanitized).toBe(42)
  })

  it('rejects negative when not allowed', () => {
    const result = validateNumber(-5, { allowNegative: false })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('negative')
  })
})
```

### Testing with Mock Data

```typescript
import { SAMPLE_PORTFOLIO } from '@/domain/defaults'

describe('Portfolio calculations', () => {
  it('calculates net worth correctly', () => {
    const data = SAMPLE_PORTFOLIO
    const netWorth = calculateNetWorth(data)
    expect(netWorth).toBeGreaterThan(0)
  })
})
```

---

## Performance

### Optimization Checklist

- ✅ **Memoization**: Heavy calculations cached
- ✅ **Debouncing**: User input delayed
- ✅ **Throttling**: Frequent events limited
- ✅ **Code Splitting**: Dynamic imports ready
- ✅ **Lazy Loading**: Components on-demand (`SettingsPage` lazy in `App.tsx`)
- ✅ **IndexedDB**: Large data persisted
- ✅ **Windowed lists**: Equities/Crypto use `useWindowedList` (40 + sentinel) for long portfolios

### Performance Monitoring

```typescript
import { idbCache } from '@/utils/cache'

// Monitor cache performance
console.log('Cache size:', calculationCache.size())

// Clear if needed
calculationCache.clear()
```

### Recommended TTLs

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Portfolio metrics | 2 min | Changes frequently |
| Calculations | 10 min | Expensive to compute |
| Search results | 5 min | User-driven |
| Analytics | 1 hour | Stable over time |

---

## Best Practices

### DO ✅

- Use TypeScript types everywhere
- Validate all user input
- Cache expensive calculations
- Use pure functions in domain logic
- Handle errors gracefully
- Write tests for business logic

### DON'T ❌

- Mutate props or state directly
- Skip validation on critical paths
- Make API calls without error handling
- Store sensitive data unencrypted
- Block the UI thread with heavy calculations
- Mix business logic with UI components

---

## Common Patterns

### Adding a New Feature

1. **Define types** in `src/domain/types.ts`
2. **Write business logic** in `src/domain/[feature].ts`
3. **Add validation** using validators
4. **Create UI components** in `src/components/`
5. **Add page route** in `src/App.tsx`
6. **Write tests** for domain logic

### Data Flow

```
User Input → Validation → Business Logic → State Update → UI Re-render
                                    ↓
                              Cache/Persist
```

---

## FAQ

**Q: Why local-first?**  
A: Privacy, speed, offline support, no server costs.

**Q: How is data stored?**  
A: LocalStorage for settings, IndexedDB for portfolio data.

**Q: Is data encrypted?**  
A: Yes, with AES-256 when encryption is enabled.

**Q: Can I export my data?**  
A: Yes, JSON/CSV/PDF formats available.

**Q: Does it work offline?**  
A: Yes, 100% offline-capable with service worker.

---

## Getting Help

- **Issues**: Check existing GitHub issues
- **Docs**: This file + inline JSDoc comments
- **Code**: All code is documented with types

---

**Last Updated**: 2026-07-13  
**Version**: 0.7.0
