import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_HEADER_ALIASES,
  HEADER_ALIAS_MAP,
  lookupCanonicalField,
  normalizeHeader,
} from './policy'
import type { CanonicalField } from './types'

const EXPECTED_ALIAS_MAP: Readonly<Record<string, CanonicalField>> = {
  salesperson: 'salesperson',
  'sales person': 'salesperson',
  month: 'month',
  'budget amount': 'budgetAmount',
  budget: 'budgetAmount',
  'actual sales': 'actualSales',
  actual: 'actualSales',
  'actual sales amount': 'actualSales',
}

describe('normalizeHeader', () => {
  it('trims, lowercases, and collapses repeated spaces', () => {
    expect(normalizeHeader('  Sales   Person  ')).toBe('sales person')
    expect(normalizeHeader('BUDGET  AMOUNT')).toBe('budget amount')
    expect(normalizeHeader('Actual Sales Amount')).toBe('actual sales amount')
  })
})

describe('HEADER_ALIAS_MAP', () => {
  it('contains only the explicit normalized aliases', () => {
    expect(HEADER_ALIAS_MAP).toEqual(EXPECTED_ALIAS_MAP)
    expect(Object.keys(HEADER_ALIAS_MAP).sort()).toEqual(
      Object.keys(EXPECTED_ALIAS_MAP).sort(),
    )
  })

  it('is built only from ACCEPTED_HEADER_ALIASES', () => {
    const fromAliases = Object.fromEntries(
      ACCEPTED_HEADER_ALIASES.map(({ alias, field }) => [
        normalizeHeader(alias),
        field,
      ]),
    )

    expect(HEADER_ALIAS_MAP).toEqual(fromAliases)
  })
})

describe('accepted header aliases', () => {
  it.each(ACCEPTED_HEADER_ALIASES)(
    'maps "$alias" to $field',
    ({ alias, field }) => {
      expect(lookupCanonicalField(alias)).toBe(field)
    },
  )

  it.each(ACCEPTED_HEADER_ALIASES)(
    'maps a padded mixed-case form of "$alias" to $field',
    ({ alias, field }) => {
      const padded = `  ${alias.toUpperCase().replaceAll(' ', '   ')}  `
      expect(lookupCanonicalField(padded)).toBe(field)
    },
  )
})

describe('rejected near and fuzzy header names', () => {
  const rejectedHeaders = [
    'Salespersons',
    'Sales Person Name',
    'Salesperson Name',
    'sales',
    'person',
    'Months',
    'Monthly',
    'Mth',
    'Budgets',
    'Budget Amt',
    'Budget Amounts',
    'Budgeted Amount',
    'Actuals',
    'Actual Sale',
    'Actual Amount',
    'Actual Sales Amt',
    'Actual Sales Amounts',
    'Revenue',
    'Name',
    'Rep',
    'Date',
  ]

  it.each(rejectedHeaders)('does not map %s', (header) => {
    expect(lookupCanonicalField(header)).toBeUndefined()
  })

  it('does not treat a one-character edit as a match', () => {
    expect(lookupCanonicalField('Salespersom')).toBeUndefined()
    expect(lookupCanonicalField('Budjet')).toBeUndefined()
    expect(lookupCanonicalField('Mnth')).toBeUndefined()
  })

  it('does not match by substring or prefix', () => {
    expect(lookupCanonicalField('Salesperson Code')).toBeUndefined()
    expect(lookupCanonicalField('Budget Amount USD')).toBeUndefined()
    expect(lookupCanonicalField('Actual Sales 2024')).toBeUndefined()
  })
})
