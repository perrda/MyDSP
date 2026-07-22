import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { formatGBP } from '../../utils/format'
import { formatChartYTick } from '../../domain/chartAxis'

interface Spending {
  date: string
  amount: number
  category: string
}

interface SpendingTrendsProps {
  spending: Spending[]
  privacy: boolean
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function MonthlySpendingTrend({ spending, privacy }: SpendingTrendsProps) {
  const data = useMemo(() => {
    const byMonth = new Map<string, number>()
    spending.forEach((s) => {
      const month = s.date.slice(0, 7)
      byMonth.set(month, (byMonth.get(month) || 0) + Math.abs(s.amount))
    })
    
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }))
  }, [spending])

  if (data.length === 0) return null

  return (
    <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <h3 className="font-bold mb-4">Monthly Spending Trend</h3>
      <div className={privacy ? 'blur-md' : ''}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis 
              dataKey="month" 
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              tickFormatter={(v: number) => formatChartYTick(v)}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => formatGBP(Number(value))}
            />
            <Line 
              type="monotone" 
              dataKey="amount" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function CategoryBreakdownChart({ spending, privacy }: SpendingTrendsProps) {
  const data = useMemo(() => {
    const byCategory = new Map<string, number>()
    spending.forEach((s) => {
      const cat = s.category.toLowerCase()
      byCategory.set(cat, (byCategory.get(cat) || 0) + Math.abs(s.amount))
    })
    
    return Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount]) => ({ category, amount }))
  }, [spending])

  if (data.length === 0) return null

  return (
    <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <h3 className="font-bold mb-4">Top Spending Categories</h3>
      <div className={privacy ? 'blur-md' : ''}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis 
              type="number"
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              tickFormatter={(v: number) => formatChartYTick(v)}
            />
            <YAxis 
              type="category"
              dataKey="category" 
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => formatGBP(Number(value))}
            />
            <Bar dataKey="amount" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SpendingDistributionPie({ spending, privacy }: SpendingTrendsProps) {
  const data = useMemo(() => {
    const byCategory = new Map<string, number>()
    spending.forEach((s) => {
      const cat = s.category.toLowerCase()
      byCategory.set(cat, (byCategory.get(cat) || 0) + Math.abs(s.amount))
    })
    
    return Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))
  }, [spending])

  if (data.length === 0) return null

  return (
    <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <h3 className="font-bold mb-4">Spending Distribution</h3>
      <div className={privacy ? 'blur-md' : ''}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => formatGBP(Number(value))}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function WeekdaySpendingPattern({ spending, privacy }: SpendingTrendsProps) {
  const data = useMemo(() => {
    const byWeekday = new Map<string, { count: number; total: number }>()
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    spending.forEach((s) => {
      const date = new Date(s.date)
      const day = weekdays[date.getDay()]
      const current = byWeekday.get(day) || { count: 0, total: 0 }
      byWeekday.set(day, { 
        count: current.count + 1, 
        total: current.total + Math.abs(s.amount) 
      })
    })
    
    return weekdays.map((day) => {
      const stats = byWeekday.get(day) || { count: 0, total: 0 }
      return {
        day,
        avg: stats.count > 0 ? stats.total / stats.count : 0,
        total: stats.total,
      }
    })
  }, [spending])

  return (
    <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <h3 className="font-bold mb-4">Spending by Day of Week</h3>
      <div className={privacy ? 'blur-md' : ''}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis 
              dataKey="day"
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              tickFormatter={(v: number) => formatChartYTick(v)}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => formatGBP(Number(value))}
            />
            <Bar dataKey="avg" name="Avg per Transaction" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface FinancialHealthRadarProps {
  data: {
    netWorth: number
    assets: number
    liabilities: number
    monthlyIncome: number
    monthlyExpenses: number
    savingsRate: number
  }
  privacy: boolean
}

export function FinancialHealthRadar({ data, privacy }: FinancialHealthRadarProps) {
  const radarData = [
    { subject: 'Net Worth', value: Math.min(100, (data.netWorth / 50000) * 100), fullMark: 100 },
    { subject: 'Assets', value: Math.min(100, (data.assets / 100000) * 100), fullMark: 100 },
    { subject: 'Income', value: Math.min(100, (data.monthlyIncome / 5000) * 100), fullMark: 100 },
    { subject: 'Savings', value: Math.min(100, data.savingsRate), fullMark: 100 },
    { subject: 'Debt Ratio', value: Math.max(0, 100 - (data.liabilities / data.assets) * 100), fullMark: 100 },
  ]

  return (
    <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <h3 className="font-bold mb-4">Financial Health Score</h3>
      <div className={privacy ? 'blur-md' : ''}>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis 
              dataKey="subject"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <PolarRadiusAxis 
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            />
            <Radar 
              name="Health Score" 
              dataKey="value" 
              stroke="#10b981" 
              fill="#10b981" 
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-text-muted text-center mt-2">
        Score based on net worth, assets, income, savings rate, and debt ratio
      </p>
    </div>
  )
}
