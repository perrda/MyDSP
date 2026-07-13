import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { JobApplication } from '../domain/job-types'
import { formatGBP } from '../utils/format'

interface JobAnalyticsProps {
  applications: JobApplication[]
  privacy: boolean
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function JobAnalytics({ applications, privacy }: JobAnalyticsProps) {
  const analytics = useMemo(() => {
    const withSalary = applications.filter((a) => a.salaryMax || a.salaryMin)
    
    const salaryData = withSalary.map((app) => {
      const salary = app.salaryMax || app.salaryMin || 0
      return {
        company: app.companyName,
        salary,
        min: app.salaryMin || salary,
        max: app.salaryMax || salary,
        status: app.status,
      }
    }).sort((a, b) => b.salary - a.salary)

    const avgSalary = withSalary.length > 0
      ? Math.round(withSalary.reduce((sum, app) => sum + (app.salaryMax || app.salaryMin || 0), 0) / withSalary.length)
      : 0

    const medianSalary = withSalary.length > 0
      ? salaryData[Math.floor(salaryData.length / 2)]?.salary || 0
      : 0

    const statusBreakdown = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
    }))

    const remoteData = [
      { name: 'Remote', value: applications.filter((a) => a.remote === 'remote').length },
      { name: 'Hybrid', value: applications.filter((a) => a.remote === 'hybrid').length },
      { name: 'On-site', value: applications.filter((a) => a.remote === 'onsite').length },
    ].filter((d) => d.value > 0)

    const sourceData = applications.reduce((acc, app) => {
      acc[app.source] = (acc[app.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const sourceChartData = Object.entries(sourceData)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    return {
      salaryData: salaryData.slice(0, 10),
      avgSalary,
      medianSalary,
      statusData,
      remoteData,
      sourceChartData,
    }
  }, [applications])

  if (applications.length === 0) {
    return (
      <div className="surface p-8 text-center rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <p className="text-text-muted">No data to analyze yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Avg Salary</p>
          <p className={`text-2xl font-bold tabular-nums ${privacy ? 'blur-md' : ''}`}>
            {analytics.avgSalary > 0 ? formatGBP(analytics.avgSalary) : 'N/A'}
          </p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Median</p>
          <p className={`text-2xl font-bold tabular-nums ${privacy ? 'blur-md' : ''}`}>
            {analytics.medianSalary > 0 ? formatGBP(analytics.medianSalary) : 'N/A'}
          </p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Total Apps</p>
          <p className="text-2xl font-bold tabular-nums">{applications.length}</p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Remote</p>
          <p className="text-2xl font-bold tabular-nums">
            {Math.round((analytics.remoteData.find((d) => d.name === 'Remote')?.value || 0) / applications.length * 100)}%
          </p>
        </div>
      </div>

      {/* Salary Comparison */}
      {analytics.salaryData.length > 0 && (
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold mb-4">Salary Comparison (Top 10)</h3>
          <div className={privacy ? 'blur-md' : ''}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.salaryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis
                  dataKey="company"
                  type="category"
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
                <Bar dataKey="salary" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold mb-4">Application Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={analytics.statusData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {analytics.statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Remote vs On-site */}
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold mb-4">Work Location</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={analytics.remoteData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {analytics.remoteData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Breakdown */}
      {analytics.sourceChartData.length > 0 && (
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold mb-4">Application Sources</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.sourceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="source" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
