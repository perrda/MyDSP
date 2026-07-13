// Enhanced CSV import with intelligent column mapping and bank presets

export interface BankPreset {
  id: string
  name: string
  columns: {
    date: string[]
    description: string[]
    amount: string[]
    category?: string[]
    balance?: string[]
  }
  dateFormat?: string
  amountConvention: 'positive_income' | 'positive_expense' | 'separate_columns'
  skipRows?: number
  encoding?: string
}

export const BANK_PRESETS: BankPreset[] = [
  {
    id: 'monzo',
    name: 'Monzo',
    columns: {
      date: ['Date', 'Transaction Date', 'date'],
      description: ['Description', 'Name', 'description', 'name'],
      amount: ['Amount', 'amount'],
      category: ['Category', 'category'],
      balance: ['Balance', 'balance'],
    },
    dateFormat: 'DD/MM/YYYY',
    amountConvention: 'positive_income',
  },
  {
    id: 'revolut',
    name: 'Revolut',
    columns: {
      date: ['Started Date', 'Completed Date', 'Date'],
      description: ['Description', 'Title'],
      amount: ['Amount'],
      category: ['Category'],
      balance: ['Balance'],
    },
    dateFormat: 'YYYY-MM-DD',
    amountConvention: 'positive_income',
  },
  {
    id: 'hsbc',
    name: 'HSBC',
    columns: {
      date: ['Date'],
      description: ['Description', 'Payee'],
      amount: ['Amount', 'Value'],
    },
    dateFormat: 'DD/MM/YYYY',
    amountConvention: 'positive_expense',
    skipRows: 1,
  },
  {
    id: 'barclays',
    name: 'Barclays',
    columns: {
      date: ['Date'],
      description: ['Memo', 'Description'],
      amount: ['Amount'],
      balance: ['Balance'],
    },
    dateFormat: 'DD/MM/YYYY',
    amountConvention: 'positive_expense',
  },
  {
    id: 'lloyds',
    name: 'Lloyds',
    columns: {
      date: ['Transaction Date', 'Date'],
      description: ['Transaction Description', 'Description'],
      amount: ['Debit Amount', 'Credit Amount'],
    },
    dateFormat: 'DD/MM/YYYY',
    amountConvention: 'separate_columns',
  },
  {
    id: 'nationwide',
    name: 'Nationwide',
    columns: {
      date: ['Date'],
      description: ['Description', 'Transactions'],
      amount: ['Paid out', 'Paid in'],
    },
    dateFormat: 'DD MMM YYYY',
    amountConvention: 'separate_columns',
  },
  {
    id: 'starling',
    name: 'Starling Bank',
    columns: {
      date: ['Date'],
      description: ['Description', 'Reference'],
      amount: ['Amount (GBP)'],
      category: ['Spending Category'],
      balance: ['Balance (GBP)'],
    },
    dateFormat: 'DD/MM/YYYY',
    amountConvention: 'positive_income',
  },
  {
    id: 'chase',
    name: 'Chase UK',
    columns: {
      date: ['Transaction date'],
      description: ['Description', 'Merchant'],
      amount: ['Amount'],
      category: ['Type'],
    },
    dateFormat: 'DD/MM/YYYY',
    amountConvention: 'positive_income',
  },
  {
    id: 'generic',
    name: 'Generic CSV',
    columns: {
      date: ['date', 'Date', 'transaction_date', 'Transaction Date'],
      description: ['description', 'Description', 'memo', 'Memo', 'payee', 'Payee'],
      amount: ['amount', 'Amount', 'value', 'Value'],
      category: ['category', 'Category', 'type', 'Type'],
    },
    dateFormat: 'YYYY-MM-DD',
    amountConvention: 'positive_expense',
  },
]

interface ColumnMapping {
  date: string | null
  description: string | null
  amount: string | null
  amountCredit?: string | null
  amountDebit?: string | null
  category: string | null
  balance: string | null
}

export function detectBankPreset(headers: string[]): BankPreset | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())
  
  for (const preset of BANK_PRESETS) {
    let matches = 0
    let totalChecks = 0
    
    // Check date column
    totalChecks++
    if (preset.columns.date.some(col => lowerHeaders.includes(col.toLowerCase()))) {
      matches++
    }
    
    // Check description column
    totalChecks++
    if (preset.columns.description.some(col => lowerHeaders.includes(col.toLowerCase()))) {
      matches++
    }
    
    // Check amount column(s)
    totalChecks++
    if (preset.columns.amount.some(col => lowerHeaders.includes(col.toLowerCase()))) {
      matches++
    }
    
    // If we match all critical columns, return this preset
    if (matches === totalChecks) {
      return preset
    }
  }
  
  return BANK_PRESETS.find(p => p.id === 'generic') || null
}

export function autoMapColumns(headers: string[], preset?: BankPreset): ColumnMapping {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())
  const mapping: ColumnMapping = {
    date: null,
    description: null,
    amount: null,
    category: null,
    balance: null,
  }
  
  const findColumn = (possibleNames: string[]): string | null => {
    for (const name of possibleNames) {
      const index = lowerHeaders.indexOf(name.toLowerCase())
      if (index !== -1) return headers[index]
    }
    return null
  }
  
  if (preset) {
    mapping.date = findColumn(preset.columns.date)
    mapping.description = findColumn(preset.columns.description)
    
    if (preset.amountConvention === 'separate_columns') {
      // For banks with separate debit/credit columns
      const amounts = preset.columns.amount
      mapping.amountDebit = findColumn([amounts[0]])
      mapping.amountCredit = findColumn(amounts.length > 1 ? [amounts[1]] : [])
    } else {
      mapping.amount = findColumn(preset.columns.amount)
    }
    
    if (preset.columns.category) {
      mapping.category = findColumn(preset.columns.category)
    }
    if (preset.columns.balance) {
      mapping.balance = findColumn(preset.columns.balance)
    }
  } else {
    // Fallback to smart guessing
    mapping.date = findColumn([
      'date', 'transaction date', 'posted date', 'Date', 'Transaction Date',
    ])
    mapping.description = findColumn([
      'description', 'memo', 'payee', 'merchant', 'name', 'reference',
      'Description', 'Memo', 'Payee', 'Merchant',
    ])
    mapping.amount = findColumn([
      'amount', 'value', 'transaction amount', 'Amount', 'Value',
    ])
    mapping.category = findColumn([
      'category', 'type', 'Category', 'Type',
    ])
    mapping.balance = findColumn([
      'balance', 'running balance', 'Balance',
    ])
  }
  
  return mapping
}

export interface ImportValidationError {
  row: number
  column: string
  value: string
  error: string
}

export function validateImportData(
  rows: any[],
  mapping: ColumnMapping,
  preset?: BankPreset
): ImportValidationError[] {
  const errors: ImportValidationError[] = []
  
  rows.forEach((row, index) => {
    const rowNum = index + 1 + (preset?.skipRows || 0)
    
    // Validate date
    if (mapping.date && row[mapping.date]) {
      const dateStr = row[mapping.date].trim()
      if (!isValidDate(dateStr)) {
        errors.push({
          row: rowNum,
          column: mapping.date,
          value: dateStr,
          error: 'Invalid date format',
        })
      }
    } else {
      errors.push({
        row: rowNum,
        column: 'date',
        value: '',
        error: 'Missing date',
      })
    }
    
    // Validate amount
    if (mapping.amount && row[mapping.amount]) {
      const amountStr = row[mapping.amount].trim()
      if (!isValidAmount(amountStr)) {
        errors.push({
          row: rowNum,
          column: mapping.amount,
          value: amountStr,
          error: 'Invalid amount format',
        })
      }
    } else if (!mapping.amountDebit && !mapping.amountCredit) {
      errors.push({
        row: rowNum,
        column: 'amount',
        value: '',
        error: 'Missing amount',
      })
    }
    
    // Validate description
    if (mapping.description && !row[mapping.description]?.trim()) {
      errors.push({
        row: rowNum,
        column: mapping.description,
        value: '',
        error: 'Missing description',
      })
    }
  })
  
  return errors
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

function isValidAmount(amountStr: string): boolean {
  if (!amountStr) return false
  const cleaned = amountStr.replace(/[£$€,\s]/g, '')
  return !isNaN(parseFloat(cleaned))
}

export function normalizeAmount(
  amountStr: string,
  _convention: BankPreset['amountConvention']
): number {
  const cleaned = amountStr.replace(/[£$€,\s]/g, '')
  const amount = parseFloat(cleaned)
  
  if (isNaN(amount)) return 0
  
  // For positive_income: positive values are income, negative are expenses
  // For positive_expense: positive values are expenses, negative are income
  // This returns the raw signed value
  return amount
}

export interface EnhancedImportStats {
  totalRows: number
  validRows: number
  invalidRows: number
  duplicates: number
  expenses: number
  income: number
  totalAmount: number
  dateRange: { from: string; to: string } | null
  topCategories: Array<{ category: string; count: number }>
}

export function analyzeImportData(
  rows: any[],
  mapping: ColumnMapping,
  preset?: BankPreset,
  existingTransactions: any[] = []
): EnhancedImportStats {
  const validRows = rows.filter(row => {
    return mapping.date && row[mapping.date] && 
           (mapping.amount && row[mapping.amount] || 
            (mapping.amountDebit && mapping.amountCredit))
  })
  
  const categoryCount = new Map<string, number>()
  let expenses = 0
  let income = 0
  let totalAmount = 0
  let minDate = ''
  let maxDate = ''
  let duplicates = 0
  
  validRows.forEach(row => {
    const description = mapping.description ? (row[mapping.description]?.trim() || '') : ''
    const dateStr = mapping.date ? (row[mapping.date]?.trim() || '') : ''
    
    let amount = 0
    if (mapping.amount) {
      amount = normalizeAmount(row[mapping.amount], preset?.amountConvention || 'positive_expense')
    } else if (mapping.amountDebit && mapping.amountCredit) {
      const debit = parseFloat(row[mapping.amountDebit] || '0')
      const credit = parseFloat(row[mapping.amountCredit] || '0')
      amount = credit - debit
    }
    
    // Check for duplicates
    const isDuplicate = existingTransactions.some(t => 
      t.date === dateStr && 
      t.description.toLowerCase() === description.toLowerCase() &&
      Math.abs(t.amount - Math.abs(amount)) < 0.01
    )
    if (isDuplicate) duplicates++
    
    if (amount < 0) {
      expenses++
      totalAmount += Math.abs(amount)
    } else {
      income++
    }
    
    if (mapping.category && row[mapping.category]) {
      const cat = row[mapping.category].toLowerCase()
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
    }
    
    if (!minDate || dateStr < minDate) minDate = dateStr
    if (!maxDate || dateStr > maxDate) maxDate = dateStr
  })
  
  const topCategories = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  return {
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: rows.length - validRows.length,
    duplicates,
    expenses,
    income,
    totalAmount,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    topCategories,
  }
}
