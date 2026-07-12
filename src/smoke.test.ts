import { describe, expect, it } from 'vitest'
import { evaluateAchievements } from '../src/domain/achievements'
import { gain } from '../src/domain/cgt'
import { createEmptyPortfolio, createSamplePortfolio } from '../src/domain/defaults'
import { filterHistory, periodChange, upsertDailySnapshot } from '../src/domain/history'
import { calcBreakdown } from '../src/domain/calc'
import {
  portfolioDebtAfter,
  simulateSingleDebt,
  suggestRag,
} from '../src/domain/liabilityHelpers'
import { normalizePortfolio } from '../src/domain/normalize'
import { convertFromGbp } from '../src/services/fx'
import { parseBankCsv } from '../src/services/csvImport'

describe('history', () => {
  it('upserts today without duplicating', () => {
    const empty = createEmptyPortfolio()
    const once = upsertDailySnapshot(empty)
    const twice = upsertDailySnapshot(once)
    const today = new Date().toISOString().slice(0, 10)
    expect(twice.history.filter((h) => h.date === today)).toHaveLength(1)
  })

  it('filters periods (legacy)', () => {
    const hist = [
      { date: '2020-01-01', netWorth: 100 },
      { date: '2026-07-01', netWorth: 200 },
    ]
    expect(filterHistory(hist, 'ALL')).toHaveLength(2)
    expect(periodChange(hist, 'ALL')?.change).toBe(100)
  })

  it('filters chart ranges 1D…ALL', async () => {
    const { filterByRange, rangeChange, CHART_RANGES, HISTORY_RETENTION } = await import(
      '../src/domain/history'
    )
    expect(CHART_RANGES).toEqual(['1D', '1W', '1M', '12M', 'YTD', '5Y', 'ALL'])
    expect(HISTORY_RETENTION).toBeGreaterThanOrEqual(1825)

    const now = new Date('2026-07-11T12:00:00.000Z')
    const hist = [
      { date: '2020-01-01', netWorth: 50 },
      { date: '2021-07-11', netWorth: 80 },
      { date: '2025-07-11', netWorth: 100 },
      { date: '2026-01-01', netWorth: 150 },
      { date: '2026-06-11', netWorth: 180 },
      { date: '2026-07-10', netWorth: 190 },
      { date: '2026-07-11', netWorth: 200 },
    ]
    expect(filterByRange(hist, '1D', now)).toHaveLength(2)
    expect(filterByRange(hist, '1W', now).length).toBeGreaterThanOrEqual(2)
    expect(filterByRange(hist, 'YTD', now).every((h) => h.date >= '2026-01-01')).toBe(true)
    expect(filterByRange(hist, '5Y', now).some((h) => h.date.startsWith('2020'))).toBe(false)
    expect(filterByRange(hist, 'ALL', now)).toHaveLength(7)
    expect(rangeChange(hist, 'ALL')?.change).toBe(150)
  })

  it('formats chart axis ticks by range', async () => {
    const { formatChartTick, formatChartTooltipLabel } = await import('../src/domain/history')
    const midYear = new Date('2026-07-11T12:00:00')
    const earlyYear = new Date('2026-02-10T12:00:00')

    expect(formatChartTick('2026-07-12', '1D')).toBe('12 Jul')
    expect(formatChartTick('2026-07-12', '1D', '2026-07-12T14:30:00.000Z')).toBe('12 Jul 14:30')
    expect(formatChartTick('2026-06-03', '1W')).toBe('03 Jun')
    expect(formatChartTick('2026-05-12', '1M')).toBe('12 May')
    expect(formatChartTick('2026-03-15', '12M')).toBe('Mar 26')
    expect(formatChartTick('2024-11-01', '5Y')).toBe('Nov 24')
    expect(formatChartTick('2026-05-12', 'ALL')).toBe('May 26')
    expect(formatChartTick('2026-02-14', 'YTD', undefined, earlyYear)).toBe('14 Feb')
    expect(formatChartTick('2026-05-12', 'YTD', undefined, midYear)).toBe('May 26')
    expect(formatChartTooltipLabel('2026-07-12')).toBe('12 Jul 2026')
  })
})

describe('achievements', () => {
  it('unlocks millionaire on sample portfolio', () => {
    const data = createSamplePortfolio()
    const breakdown = calcBreakdown(data)
    const result = evaluateAchievements({
      data,
      breakdown,
      goalProgress: () => 0,
    })
    expect(result.unlocked.some((a) => a.id === 'net_worth_1m')).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })
})

describe('cgt', () => {
  it('computes gain', () => {
    expect(gain({ proceeds: 100, cost: 40 })).toBe(60)
  })
})

describe('csv import conventions', () => {
  const csv = `Date,Description,Amount
2026-07-01,TESCO,-12.50
2026-07-02,SALARY,3000
`

  it('monzo treats positive as income', () => {
    const rows = parseBankCsv(csv, [], { convention: 'monzo' })
    const salary = rows.find((r) => r.description === 'SALARY')
    expect(salary?.isIncome).toBe(true)
    expect(salary?.selected).toBe(false)
  })

  it('positive_expense treats positive as expense', () => {
    const rows = parseBankCsv(csv, [], { convention: 'positive_expense' })
    const salary = rows.find((r) => r.description === 'SALARY')
    expect(salary?.isIncome).toBe(false)
  })
})

describe('normalize', () => {
  it('backfills staking family documents customCategories', () => {
    const data = normalizePortfolio({ crypto: [], equities: [] })
    expect(data.staking.rewards).toEqual([])
    expect(data.family.members.length).toBeGreaterThan(0)
    expect(data.documents).toEqual([])
    expect(data.customCategories).toEqual([])
  })

  it('keeps liability contact rag commentaries', () => {
    const data = normalizePortfolio({
      creditCards: [
        {
          id: 1,
          name: 'Test',
          balance: 100,
          apr: 20,
          minPay: 10,
          limit: 200,
          ragStatus: 'red',
          contactPhone: '123',
          commentaries: [{ id: 1, text: 'Called', createdAt: '2026-01-01T00:00:00.000Z' }],
        },
      ],
    })
    expect(data.creditCards[0].ragStatus).toBe('red')
    expect(data.creditCards[0].contactPhone).toBe('123')
    expect(data.creditCards[0].commentaries?.[0].text).toBe('Called')
  })

  it('preserves BTC display currency', () => {
    const data = normalizePortfolio({ settings: { currency: 'BTC' } })
    expect(data.settings.currency).toBe('BTC')
  })
})

describe('liability helpers', () => {
  it('simulates payoff and portfolio debt delta', () => {
    const sim = simulateSingleDebt(1000, 12, 200)
    expect(sim.payoffMonth).toBeGreaterThan(0)
    expect(sim.totalInterest).toBeGreaterThan(0)

    const impact = portfolioDebtAfter(
      [{ id: 1, name: 'A', balance: 500, apr: 20, minPay: 50, limit: 1000 }],
      [{ id: 2, name: 'B', balance: 1500, apr: 5, minPay: 100, original: 2000 }],
      'card',
      1,
      0,
    )
    expect(impact.currentTotal).toBe(2000)
    expect(impact.total).toBe(1500)
    expect(impact.delta).toBe(-500)
  })

  it('suggests rag for high util cards', () => {
    expect(
      suggestRag(
        { id: 1, name: 'X', balance: 900, apr: 25, minPay: 50, limit: 1000 },
        'card',
      ),
    ).toBe('red')
  })
})

describe('fx', () => {
  it('converts gbp to btc via rate', () => {
    expect(convertFromGbp(85_000, 'BTC', { GBP: 1, BTC: 1 / 85_000 })).toBeCloseTo(1, 8)
  })
})

describe('alerts + section104', () => {
  it('builds alerts for high util cards', async () => {
    const { buildAlerts } = await import('../src/domain/alerts')
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    const data = createEmptyPortfolio()
    data.creditCards = [
      {
        id: 1,
        name: 'Hot',
        balance: 900,
        apr: 20,
        minPay: 50,
        limit: 1000,
        ragStatus: 'red',
      },
    ]
    const alerts = buildAlerts(data)
    expect(alerts.some((a) => a.severity === 'red')).toBe(true)
  })

  it('tags section104 matches from journal pools', async () => {
    const { section104Summary, suggestDisposalsFromJournal } = await import(
      '../src/domain/section104'
    )
    const journal = [
      {
        id: 1,
        date: '2026-04-01',
        type: 'buy',
        asset: 'VOD',
        qty: 100,
        price: 1,
        fees: 0,
        total: 100,
      },
      {
        id: 2,
        date: '2026-05-01',
        type: 'sell',
        asset: 'VOD',
        qty: 10,
        price: 1.5,
        fees: 0,
        total: 15,
      },
    ]
    const suggested = suggestDisposalsFromJournal(journal, [])
    expect(suggested.length).toBe(1)
    expect(suggested[0].cost).toBeCloseTo(10, 5)
    const summary = section104Summary(suggested, '2026/27', journal)
    expect(summary.matched).toHaveLength(1)
    expect(summary.byRule.section104 + summary.byRule.unpooled).toBeGreaterThan(0)
  })
})

describe('reorder', () => {
  it('moves and applies sortOrder', async () => {
    const { applySortOrder, moveIndex, sortBySortOrder } = await import('../src/utils/reorder')
    const items = [
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 1 },
      { id: 3, sortOrder: 2 },
    ]
    const moved = moveIndex(items, 2, 0)
    expect(moved.map((i) => i.id)).toEqual([3, 1, 2])
    const applied = applySortOrder(moved)
    expect(applied.map((i) => i.sortOrder)).toEqual([0, 1, 2])
    expect(sortBySortOrder([{ id: 9 }, { id: 1, sortOrder: 0 }])[0].id).toBe(1)
  })
})

describe('holding history + spending + conflicts', () => {
  it('appends holding prices into extras', async () => {
    const { appendHoldingPrices, readHoldingHistory } = await import('../src/domain/holdingHistory')
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    let data = createEmptyPortfolio()
    data = appendHoldingPrices(data, [{ kind: 'crypto', symbol: 'BTC', price: 100 }])
    data = appendHoldingPrices(
      data,
      [{ kind: 'crypto', symbol: 'BTC', price: 110 }],
      new Date(Date.now() + 20 * 60_000).toISOString(),
    )
    const series = readHoldingHistory(data)['crypto:BTC']
    expect(series.length).toBeGreaterThanOrEqual(2)
  })

  it('builds daily spend series', async () => {
    const { buildDailySpendSeries } = await import('../src/domain/spendingChart')
    const { points, totalInRange } = buildDailySpendSeries(
      [
        { id: 1, date: '2026-07-01', amount: 10, description: 'a', category: 'food', method: 'debit' },
        { id: 2, date: '2026-07-02', amount: 20, description: 'b', category: 'food', method: 'debit' },
      ],
      'ALL',
    )
    expect(points.length).toBe(2)
    expect(totalInRange).toBe(30)
  })

  it('detects sync conflicts', async () => {
    const { detectConflicts } = await import('../src/services/sync/conflicts')
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    const local = createEmptyPortfolio()
    const remote = createEmptyPortfolio()
    local.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 1, price: 100, cost: 50 }]
    remote.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 1, price: 200, cost: 50 }]
    const conflicts = detectConflicts('default', local, remote)
    expect(conflicts.some((c) => c.collection === 'crypto' && c.id === 1)).toBe(true)
  })
})

describe('trades + static prices + currencies', () => {
  it('applies buy/sell to crypto holding and journal', async () => {
    const { applyTrade } = await import('../src/domain/trades')
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    let data = createEmptyPortfolio()
    data = applyTrade(data, {
      kind: 'crypto',
      side: 'buy',
      symbol: 'BTC',
      date: '2019-01-01',
      qty: 1,
      price: 50,
      fees: 0,
    })
    data = applyTrade(data, {
      kind: 'crypto',
      side: 'buy',
      symbol: 'BTC',
      date: '2020-01-15',
      qty: 0.5,
      price: 80,
      fees: 1,
    })
    expect(data.crypto[0].qty).toBeCloseTo(1.5)
    expect(data.crypto[0].cost).toBeCloseTo(50 + 40 + 1)
    expect(data.journal.filter((j) => j.asset === 'BTC')).toHaveLength(2)
    data = applyTrade(data, {
      kind: 'crypto',
      side: 'sell',
      symbol: 'BTC',
      date: '2021-06-01',
      qty: 0.5,
      price: 200,
      fees: 2,
    })
    expect(data.crypto[0].qty).toBeCloseTo(1)
  })

  it('rebuilds cost when trade deleted or edited', async () => {
    const { applyTradesBatch, deleteJournalTrade, upsertJournalTrade } = await import(
      '../src/domain/trades'
    )
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    let data = createEmptyPortfolio()
    data = applyTradesBatch(data, [
      { kind: 'equity', side: 'buy', symbol: 'TSLA', date: '2020-01-02', qty: 10, price: 100, fees: 0 },
      { kind: 'equity', side: 'buy', symbol: 'TSLA', date: '2020-06-01', qty: 10, price: 200, fees: 0 },
    ])
    expect(data.equities[0].shares).toBe(20)
    expect(data.equities[0].avgCost).toBe(150)
    const firstId = data.journal.find((j) => j.date === '2020-01-02')!.id
    data = deleteJournalTrade(data, firstId, 'equity', 'TSLA')
    expect(data.equities[0].shares).toBe(10)
    expect(data.equities[0].avgCost).toBe(200)
    const remaining = data.journal.find((j) => j.asset === 'TSLA')!
    data = upsertJournalTrade(
      data,
      { ...remaining, qty: 20, price: 50, total: 1000 },
      'equity',
    )
    expect(data.equities[0].shares).toBe(20)
    expect(data.equities[0].avgCost).toBe(50)
  })

  it('parses trade CSV and priceOnDate', async () => {
    const { parseTradeCsv } = await import('../src/services/tradeCsvImport')
    const { priceOnDate } = await import('../src/domain/staticPrices')
    const parsed = parseTradeCsv(
      `date,side,qty,price,fees
2020-01-02,buy,5,100,1
02/06/2020,sell,2,150,0`,
      { kind: 'equity', symbol: 'TSLA' },
    )
    expect(parsed.trades).toHaveLength(2)
    expect(parsed.trades[0].side).toBe('buy')
    expect(parsed.trades[1].date).toBe('2020-06-02')
    const hit = priceOnDate(
      [
        { date: '2020-01-01', price: 10 },
        { date: '2020-01-03', price: 12 },
      ],
      '2020-01-02',
    )
    expect(hit?.price).toBe(10)
  })

  it('applies equity buy/sell', async () => {
    const { applyTrade } = await import('../src/domain/trades')
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    let data = createEmptyPortfolio()
    data = applyTrade(data, {
      kind: 'equity',
      side: 'buy',
      symbol: 'TSLA',
      date: '2019-12-02',
      qty: 10,
      price: 25,
      fees: 0,
    })
    expect(data.equities[0].shares).toBe(10)
    expect(data.equities[0].avgCost).toBe(25)
  })

  it('merges static and live price series', async () => {
    const { mergePriceSeries } = await import('../src/domain/staticPrices')
    const merged = mergePriceSeries(
      [
        { date: '2020-01-01', price: 10, source: 'manual' },
        { date: '2020-01-02', price: 11, source: 'manual' },
      ],
      [{ date: '2020-01-02', price: 12, source: 'auto', at: '2020-01-02T12:00:00.000Z' }],
    )
    expect(merged).toHaveLength(2)
    expect(merged[1].price).toBe(12)
  })

  it('limits display currencies to GBP BTC USD THB', async () => {
    const { DISPLAY_CURRENCIES } = await import('../src/services/fx')
    expect(DISPLAY_CURRENCIES.map((c) => c.code)).toEqual(['GBP', 'BTC', 'USD', 'THB'])
  })

  it('matches same-day CGT acquisitions with cost', async () => {
    const { matchDisposalsSection104 } = await import('../src/domain/section104')
    const journal = [
      {
        id: 1,
        date: '2026-05-10',
        type: 'buy',
        asset: 'VOD',
        qty: 10,
        price: 2,
        fees: 0,
        total: 20,
      },
    ]
    const matched = matchDisposalsSection104(
      [
        {
          id: 1,
          date: '2026-05-10',
          assetType: 'equity',
          symbol: 'VOD',
          qty: 10,
          proceeds: 30,
          cost: 0,
        },
      ],
      '2026/27',
      journal,
    )
    expect(matched[0].matchedRule).toBe('same-day')
    expect(matched[0].allowableCost).toBeCloseTo(20)
    expect(matched[0].gain).toBeCloseTo(10)
  })

  it('opening balance + replace trades', async () => {
    const { applyOpeningBalance, needsOpeningBalance, replaceSymbolTrades } = await import(
      '../src/domain/trades'
    )
    const { createEmptyPortfolio } = await import('../src/domain/defaults')
    let data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 2, price: 100, cost: 40 }]
    expect(needsOpeningBalance(data, 'BTC', 'crypto')).toBe(true)
    data = applyOpeningBalance(data, 'BTC', 'crypto', '2015-01-01')
    expect(needsOpeningBalance(data, 'BTC', 'crypto')).toBe(false)
    expect(data.crypto[0].qty).toBeCloseTo(2)
    data = replaceSymbolTrades(data, 'BTC', 'crypto', [
      { kind: 'crypto', side: 'buy', symbol: 'BTC', date: '2016-01-01', qty: 1, price: 10, fees: 0 },
    ])
    expect(data.crypto[0].qty).toBeCloseTo(1)
    expect(data.journal.filter((j) => j.asset === 'BTC' && j.type === 'buy')).toHaveLength(1)
  })

  it('computes TWR with mid-period contribution', async () => {
    const { timeWeightedReturn, performanceSummary } = await import('../src/domain/performance')
    const history = [
      { date: '2026-01-01', netWorth: 100 },
      { date: '2026-06-01', netWorth: 150 },
      { date: '2026-12-31', netWorth: 200 },
    ]
    const journal = [
      {
        id: 1,
        date: '2026-06-01',
        type: 'buy',
        asset: 'BTC',
        qty: 1,
        price: 50,
        fees: 0,
        total: 50,
      },
    ]
    const twr = timeWeightedReturn(history, journal, 'ALL')
    expect(twr).not.toBeNull()
    expect(twr!.subPeriods).toBeGreaterThanOrEqual(1)
    const summary = performanceSummary(history, journal, 'ALL')
    expect(summary?.twrPct).toBeDefined()
  })

  it('month utils + SA108 export', async () => {
    const { shiftMonth, parseMonthParam } = await import('../src/domain/monthUtils')
    expect(shiftMonth('2026-07', -1)).toBe('2026-06')
    expect(parseMonthParam('bad')).toMatch(/^\d{4}-\d{2}$/)
    const { exportSa108Csv } = await import('../src/domain/section104')
    const csv = exportSa108Csv(
      [
        {
          id: 1,
          date: '2026-05-10',
          assetType: 'equity',
          symbol: 'VOD',
          qty: 1,
          proceeds: 10,
          cost: 5,
        },
      ],
      '2026/27',
      [],
    )
    expect(csv).toContain('tax_year')
    expect(csv.split('\n').length).toBeGreaterThan(1)
  })
})

describe('portfolios + full backup', () => {
  it('caps at 6 and creates empty family portfolios', async () => {
    const mem = new Map<string, string>()
    const ls = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, String(v))
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
      get length() {
        return mem.size
      },
      key: (i: number) => [...mem.keys()][i] ?? null,
    }
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })

    const store = await import('../src/storage/portfolioStore')
    mem.clear()
    store.ensurePortfolioRegistry()
    const boot = store.bootstrapFamilyPortfolios()
    expect(boot.created.length).toBe(5)
    const list = store.listPortfolios()
    expect(list.some((p) => p.name === 'David')).toBe(true)
    expect(list.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Mum', 'Andrew', 'Thomas', 'Rebecca', 'James King']),
    )
    expect(list.length).toBe(6)
    expect(new Set(list.map((p) => p.id)).size).toBe(6)
    expect(store.canCreatePortfolio()).toBe(false)
    const mum = list.find((p) => p.name === 'Mum')!
    const andrew = list.find((p) => p.name === 'Andrew')!
    expect(mum.id).not.toBe(andrew.id)
    const data = store.loadPortfolio(mum.id)
    expect(data.crypto).toHaveLength(0)
    expect(data.equities).toHaveLength(0)
    expect(data.loans).toHaveLength(0)
  })

  it('repairs duplicate portfolio ids from same-millisecond create', async () => {
    const mem = new Map<string, string>()
    const ls = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
    }
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })

    const store = await import('../src/storage/portfolioStore')
    mem.clear()
    const shared = 'p_dup_shared'
    mem.set(
      'fcc_portfolios',
      JSON.stringify([
        { id: 'default', name: 'David', createdAt: '2026-01-01' },
        { id: shared, name: 'Mum', createdAt: '2026-01-01' },
        { id: shared, name: 'Andrew', createdAt: '2026-01-01' },
        { id: shared, name: 'Thomas', createdAt: '2026-01-01' },
      ]),
    )
    expect(store.repairDuplicatePortfolioIds()).toBe(true)
    const list = store.listPortfolios()
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length)
    expect(list.find((p) => p.name === 'Mum')!.id).toBe(shared)
    expect(list.find((p) => p.name === 'Andrew')!.id).not.toBe(shared)
  })

  it('parses full backup file envelope', async () => {
    const { parseFullBackupFile } = await import('../src/storage/backupStore')
    const parsed = parseFullBackupFile({
      kind: 'mydsp-full-backup',
      appVersion: '0.5.31',
      exportDate: '2026-07-12T00:00:00.000Z',
      activePortfolioId: 'default',
      portfolios: [{ id: 'default', name: 'David Portfolio', createdAt: '2026-01-01' }],
      blobs: { default: { version: 1, crypto: [], equities: [] } },
    })
    expect(parsed?.portfolios[0].name).toBe('David Portfolio')
    expect(parseFullBackupFile({ kind: 'nope' })).toBeNull()
  })
})

describe('next-10 helpers', () => {
  it('parses trade CSV ignoring # comments', async () => {
    const { parseTradeCsv } = await import('../src/services/tradeCsvImport')
    const csv = `date,side,qty,price,fees,notes,platform
# ignore me
2020-03-18,buy,10,100,1,note,IBKR
`
    const r = parseTradeCsv(csv, { kind: 'equity', symbol: 'TSLA' })
    expect(r.errors).toEqual([])
    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].qty).toBe(10)
  })

  it('normalizes tax residency per portfolio settings', async () => {
    const { normalizePortfolio } = await import('../src/domain/normalize')
    const data = normalizePortfolio({
      settings: { currency: 'USD', taxResidency: 'th', privacy: false, theme: 'dark' },
    })
    expect(data.settings.taxResidency).toBe('TH')
    expect(data.settings.currency).toBe('USD')
  })

  it('session passphrase stays in memory only', async () => {
    const sp = await import('../src/services/sync/sessionPassphrase')
    sp.clearSessionSyncPassphrase()
    expect(sp.hasSessionSyncPassphrase()).toBe(false)
    sp.setSessionSyncPassphrase('short')
    expect(sp.hasSessionSyncPassphrase()).toBe(false)
    sp.setSessionSyncPassphrase('long-enough-pass')
    expect(sp.getSessionSyncPassphrase()).toBe('long-enough-pass')
    sp.clearSessionSyncPassphrase()
  })

  it('builds portfolio comparison rows', async () => {
    const mem = new Map<string, string>()
    const ls = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, String(v))
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
      get length() {
        return mem.size
      },
      key: (i: number) => [...mem.keys()][i] ?? null,
    }
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
    const store = await import('../src/storage/portfolioStore')
    mem.clear()
    store.bootstrapFamilyPortfolios()
    const { buildPortfolioComparison, comparisonTotals } = await import(
      '../src/domain/portfolioCompare'
    )
    const rows = buildPortfolioComparison()
    expect(rows.length).toBe(6)
    expect(rows.some((r) => r.name === 'David')).toBe(true)
    const totals = comparisonTotals(rows)
    expect(typeof totals.netWorth).toBe('number')
  })
})
