import { useMemo } from 'react'
import { Sparkles, Calendar, Tag, Target, TrendingUp, AlertCircle } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import {
  detectRecurringPatterns,
  generateSmartSuggestions,
  suggestCategoryCorrections,
  detectMerchantClusters,
} from '../domain/smartData'
import { formatGBP } from '../utils/format'

export function SmartInsightsPage() {
  const { data, setData } = usePortfolio()
  const { success } = useToasts()

  const recurringPatterns = useMemo(() => 
    detectRecurringPatterns(data.spending),
    [data.spending]
  )

  const smartSuggestions = useMemo(() => 
    generateSmartSuggestions(
      data.spending,
      data.recurringTransactions,
      data.goals,
      data.budgetGoals
    ),
    [data.spending, data.recurringTransactions, data.goals, data.budgetGoals]
  )

  const categoryCorrections = useMemo(() => 
    suggestCategoryCorrections(data.spending),
    [data.spending]
  )

  const merchantClusters = useMemo(() => 
    detectMerchantClusters(data.spending),
    [data.spending]
  )

  const handleApplyCategoryCorrection = (transactionId: number, newCategory: string) => {
    setData(prev => ({
      ...prev,
      spending: prev.spending.map(s => 
        s.id === transactionId ? { ...s, category: newCategory } : s
      ),
    }))
    success('Category updated', `Transaction recategorized as "${newCategory}"`)
  }

  const handleCreateMerchantRule = (_cluster: typeof merchantClusters[0]) => {
    success('Feature coming soon', 'Merchant rules will be available in the next update')
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-500/10'
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/10'
      case 'low': return 'border-l-accent/60 bg-accent/5'
      default: return 'border-l-accent bg-accent/10'
    }
  }

  const getPriorityIcon = (type: string) => {
    switch (type) {
      case 'recurring': return <Calendar size={20} className="text-accent" />
      case 'category': return <Tag size={20} className="text-amber-500" />
      case 'budget': return <TrendingUp size={20} className="text-accent" />
      case 'goal': return <Target size={20} className="text-emerald-500" />
      default: return <AlertCircle size={20} className="text-accent" />
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="Smart Insights"
        description="AI-powered pattern recognition and intelligent suggestions"
      />

      {/* Smart Suggestions */}
      <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-accent" />
          Smart Suggestions
        </h3>
        
        {smartSuggestions.length === 0 ? (
          <p className="text-sm text-text-muted">
            No suggestions at the moment. Keep tracking your spending to unlock smart insights!
          </p>
        ) : (
          <div className="space-y-3">
            {smartSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-4 rounded-lg border-l-4 ${getPriorityColor(suggestion.priority)}`}
              >
                <div className="flex items-start gap-3">
                  {getPriorityIcon(suggestion.type)}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium">{suggestion.title}</h4>
                      <span className={`text-xs px-2 py-1 ${
                        suggestion.priority === 'high' ? 'bg-red-500 text-white' :
                        suggestion.priority === 'medium' ? 'bg-amber-500 text-white' :
                        'bg-accent text-white'
                      }`}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mb-2">{suggestion.description}</p>
                    {suggestion.action && (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => success('Feature coming soon', 'This action will be available in the next update')}
                      >
                        {suggestion.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring Patterns Detected */}
      {recurringPatterns.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-accent" />
            Recurring Patterns Detected
          </h3>
          
          <div className="space-y-3">
            {recurringPatterns.slice(0, 5).map((pattern, i) => (
              <div key={i} className="p-4 bg-surface-hover rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium capitalize">{pattern.merchant}</p>
                    <p className="text-sm text-text-muted capitalize">
                      {pattern.category} · {formatGBP(pattern.avgAmount)} avg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{pattern.confidence}% confidence</p>
                    <p className="text-xs text-text-muted">Every {pattern.frequency} days</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-text-muted">
                    <span>Last: {pattern.lastOccurrence}</span>
                    <span className="mx-2">•</span>
                    <span>Next: {pattern.nextPredicted}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-xs"
                    onClick={() => success('Feature coming soon', 'Add to recurring transactions in the next update')}
                  >
                    Add to Recurring
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Suggestions */}
      {categoryCorrections.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Tag size={20} className="text-accent" />
            Category Suggestions
          </h3>
          
          <p className="text-sm text-text-muted mb-4">
            We've found some transactions that might be miscategorized based on your historical patterns.
          </p>
          
          <div className="space-y-3">
            {categoryCorrections.slice(0, 5).map((suggestion, i) => (
              <div key={i} className="p-4 bg-surface-hover rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{suggestion.transaction.description}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {suggestion.transaction.date} · {formatGBP(Math.abs(suggestion.transaction.amount))}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs font-medium">{suggestion.confidence}% confidence</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-3">{suggestion.reason}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs">
                    Current: <span className="font-medium capitalize">{suggestion.transaction.category}</span>
                  </span>
                  <span className="text-text-muted">→</span>
                  <span className="text-xs">
                    Suggested: <span className="font-medium capitalize">{suggestion.suggestedCategory}</span>
                  </span>
                  <button
                    type="button"
                    className="btn-primary btn-sm text-xs ml-auto"
                    onClick={() => handleApplyCategoryCorrection(
                      suggestion.transaction.id,
                      suggestion.suggestedCategory
                    )}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merchant Clustering */}
      {merchantClusters.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4">Merchant Name Variations</h3>
          
          <p className="text-sm text-text-muted mb-4">
            These merchants appear under multiple names. Create rules to standardize them.
          </p>
          
          <div className="space-y-3">
            {merchantClusters.slice(0, 5).map((cluster, i) => (
              <div key={i} className="p-4 bg-surface-hover rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{cluster.merchant}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {cluster.transactions} transactions · {formatGBP(cluster.totalAmount)} total
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-xs"
                    onClick={() => handleCreateMerchantRule(cluster)}
                  >
                    Create Rule
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cluster.variants.map((variant, j) => (
                    <span key={j} className="text-xs px-2 py-1 bg-surface rounded">
                      {variant}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {smartSuggestions.length === 0 && 
       recurringPatterns.length === 0 && 
       categoryCorrections.length === 0 && 
       merchantClusters.length === 0 && (
        <div className="surface p-12 text-center rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <Sparkles size={48} className="text-text-muted mx-auto mb-4" />
          <h3 className="font-bold text-lg mb-2">No Insights Yet</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Start tracking your spending to unlock smart insights! Our AI will analyze your patterns 
            and provide personalized suggestions to optimize your finances.
          </p>
        </div>
      )}
    </div>
  )
}
