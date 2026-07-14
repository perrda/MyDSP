import { describe, expect, it } from 'vitest'
import { parseRowsWithBankPreset, type BankPreset } from '../services/enhancedCsvImport'

const lloyds: BankPreset = {
  id: 'lloyds',
  name: 'Lloyds',
  columns: {
    date: ['Transaction Date'],
    description: ['Transaction Description'],
    amount: ['Debit Amount', 'Credit Amount'],
  },
  amountConvention: 'separate_columns',
}

describe('enhanced CSV bank presets', () => {
  it('parses Lloyds-style debit/credit columns', () => {
    const headers = ['Transaction Date', 'Transaction Description', 'Debit Amount', 'Credit Amount']
    const rows = [
      {
        'Transaction Date': '01/07/2026',
        'Transaction Description': 'TESCO STORES',
        'Debit Amount': '45.20',
        'Credit Amount': '',
      },
      {
        'Transaction Date': '02/07/2026',
        'Transaction Description': 'SALARY',
        'Debit Amount': '',
        'Credit Amount': '2500.00',
      },
    ]
    const parsed = parseRowsWithBankPreset(rows, headers, lloyds, () => 'Shopping')
    expect(parsed).toHaveLength(2)
    expect(parsed[0].isIncome).toBe(false)
    expect(parsed[0].amount).toBeCloseTo(45.2)
    expect(parsed[0].selected).toBe(true)
    expect(parsed[1].isIncome).toBe(true)
    expect(parsed[1].amount).toBeCloseTo(2500)
    expect(parsed[1].selected).toBe(false)
  })
})
