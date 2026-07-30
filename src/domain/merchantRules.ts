/** User merchant → category rules + fallback heuristics. */

import type { MerchantRule, SpendingCategory, SpendingEntry } from './types'

export interface MerchantRuleSuggestion {
  pattern: string
  category: SpendingCategory
  count: number
  latestDate: string
}

export function matchMerchantRule(
  description: string,
  rules: MerchantRule[],
): SpendingCategory | null {
  const desc = description.trim()
  if (!desc) return null
  const ranked = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  for (const rule of ranked) {
    const pattern = rule.pattern.trim()
    if (!pattern) continue
    try {
      if (rule.matchType === 'startsWith') {
        if (desc.toLowerCase().startsWith(pattern.toLowerCase())) return rule.category
      } else if (rule.matchType === 'regex') {
        const re = new RegExp(pattern, 'i')
        if (re.test(desc)) return rule.category
      } else if (desc.toLowerCase().includes(pattern.toLowerCase())) {
        return rule.category
      }
    } catch {
      /* invalid regex — skip */
    }
  }
  return null
}

/**
 * Rank transaction descriptions that are not covered by a user rule.
 * Case and repeated whitespace are ignored; the most common existing category
 * is used to prefill the rule editor.
 */
export function suggestMerchantRules(
  spending: SpendingEntry[],
  rules: MerchantRule[],
): MerchantRuleSuggestion[] {
  const groups = new Map<
    string,
    {
      patterns: Map<string, number>
      categories: Map<SpendingCategory, number>
      count: number
      latestDate: string
    }
  >()

  for (const transaction of spending) {
    const pattern = transaction.description.trim().replace(/\s+/g, ' ')
    if (!pattern || matchMerchantRule(pattern, rules)) continue
    const key = pattern.toLocaleLowerCase()
    const group = groups.get(key) ?? {
      patterns: new Map<string, number>(),
      categories: new Map<SpendingCategory, number>(),
      count: 0,
      latestDate: '',
    }
    group.patterns.set(pattern, (group.patterns.get(pattern) ?? 0) + 1)
    group.categories.set(
      transaction.category,
      (group.categories.get(transaction.category) ?? 0) + 1,
    )
    group.count++
    if (transaction.date > group.latestDate) group.latestDate = transaction.date
    groups.set(key, group)
  }

  return [...groups.values()]
    .map((group) => {
      const pattern =
        [...group.patterns.entries()].sort(
          ([, aCount], [, bCount]) => bCount - aCount,
        )[0]?.[0] ?? 'merchant'
      const category =
        [...group.categories.entries()].sort(
          ([, aCount], [, bCount]) => bCount - aCount,
        )[0]?.[0] ?? 'other'
      return {
        pattern,
        category,
        count: group.count,
        latestDate: group.latestDate,
      }
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.latestDate.localeCompare(a.latestDate) ||
        a.pattern.localeCompare(b.pattern),
    )
}

export function guessCategory(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes('uber') || d.includes('train') || d.includes('tfl') || d.includes('fuel') || d.includes('petrol'))
    return 'transport'
  if (
    d.includes('tesco') ||
    d.includes('sainsbury') ||
    d.includes('waitrose') ||
    d.includes('deliveroo') ||
    d.includes('restaurant') ||
    d.includes('pret')
  )
    return 'food'
  if (d.includes('amazon') || d.includes('ebay') || d.includes('apple')) return 'shopping'
  if (d.includes('netflix') || d.includes('spotify') || d.includes('cinema') || d.includes('disney'))
    return 'entertainment'
  if (d.includes('octopus') || d.includes('virgin') || d.includes('ee ') || d.includes('vodafone'))
    return 'bills'
  if (d.includes('pharmacy') || d.includes('boots') || d.includes('dentist') || d.includes('gp '))
    return 'health'
  if (d.includes('hotel') || d.includes('airbnb') || d.includes('booking.com') || d.includes('flight'))
    return 'travel'
  if (d.includes('salary') || d.includes('payroll') || d.includes('income') || d.includes('interest'))
    return 'income'
  if (d.includes('transfer') || d.includes('monzo') || d.includes('sent') || d.includes('received'))
    return 'other'
  return 'other'
}

export function resolveCategory(description: string, rules: MerchantRule[]): string {
  return matchMerchantRule(description, rules) ?? guessCategory(description)
}
