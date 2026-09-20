import { describe, expect, it } from 'vitest'
import { CANONICAL_FIELD_LABELS } from '../domain/policy'
import type { CanonicalField } from '../domain/types'
import { NEGATIVE_AMOUNT_SCOPE_MESSAGE } from './messages'
import type { DetectedDataRow } from './structure'
import { validateDataRows } from './validateRows'

const COLUMNS: Readonly<Record<CanonicalField, number>> = {
  salesperson: 0,
  month: 1,
  budgetAmount: 2,
  actualSales: 3,
}

function dataRow(
  excelRowNumber: number,
  values: {
    salesperson?: unknown
    month?: unknown
    budgetAmount?: unknown
    actualSales?: unknown
  },
): DetectedDataRow {
  return {
    excelRowNumber,
    columnIndexes: COLUMNS,
    values: {
      salesperson: Object.hasOwn(values, 'salesperson')
        ? values.salesperson
        : 'Ada Lovelace',
      month: Object.hasOwn(values, 'month') ? values.month : 'January',
      budgetAmount: Object.hasOwn(values, 'budgetAmount')
        ? values.budgetAmount
        : 1000,
      actualSales: Object.hasOwn(values, 'actualSales')
        ? values.actualSales
        : 900,
    },
  }
}

describe('validateDataRows', () => {
  it('returns records only when every row is valid', () => {
    const result = validateDataRows([
      dataRow(2, {
        salesperson: '  Ada   Lovelace  ',
        month: ' January ',
        budgetAmount: 'AED 1,000.50',
        actualSales: 0,
      }),
    ])

    expect(result).toEqual({
      ok: true,
      records: [
        {
          salesperson: 'Ada Lovelace',
          month: 'January',
          budgetAmount: 1000.5,
          actualSales: 0,
          sourceRowNumber: 2,
        },
      ],
    })
  })

  it.each([
    { field: 'salesperson' as const, value: '' },
    { field: 'salesperson' as const, value: '   ' },
    { field: 'month' as const, value: null },
    { field: 'budgetAmount' as const, value: '' },
    { field: 'actualSales' as const, value: '  ' },
  ])('treats blank $field as missing, never as zero (value=$value)', ({
    field,
    value,
  }) => {
    const result = validateDataRows([dataRow(6, { [field]: value })])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'missing-required-value',
          message: `Row 6 is missing ${CANONICAL_FIELD_LABELS[field]}.`,
          rowNumber: 6,
          field,
          columnIndex: COLUMNS[field],
        },
      ])
    }
  })

  it('rejects boolean true in a money cell', () => {
    const result = validateDataRows([dataRow(3, { budgetAmount: true })])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]).toMatchObject({
        code: 'invalid-number',
        rowNumber: 3,
        field: 'budgetAmount',
        message: 'Row 3 has an invalid Budget Amount.',
      })
    }
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects nonfinite money value %s',
    (value) => {
      const result = validateDataRows([dataRow(4, { actualSales: value })])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues[0]?.code).toBe('invalid-number')
        expect(result.issues[0]?.rowNumber).toBe(4)
      }
    },
  )

  it('rejects 100abc and USD 1,000 as invalid money', () => {
    const result = validateDataRows([
      dataRow(5, { budgetAmount: '100abc' }),
      dataRow(6, { actualSales: 'USD 1,000' }),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'invalid-number',
          message: 'Row 5 has an invalid Budget Amount.',
          rowNumber: 5,
          field: 'budgetAmount',
          columnIndex: 2,
        },
        {
          code: 'invalid-number',
          message: 'Row 6 has an invalid Actual Sales.',
          rowNumber: 6,
          field: 'actualSales',
          columnIndex: 3,
        },
      ])
    }
  })

  it('rejects negative Budget and Actual Sales as out of scope', () => {
    const result = validateDataRows([
      dataRow(8, { budgetAmount: -10 }),
      dataRow(9, { actualSales: '-1,000.50' }),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'negative-budget',
          message: `Row 8 has a negative Budget Amount. ${NEGATIVE_AMOUNT_SCOPE_MESSAGE}`,
          rowNumber: 8,
          field: 'budgetAmount',
          columnIndex: 2,
        },
        {
          code: 'negative-actual-sales',
          message: `Row 9 has a negative Actual Sales. ${NEGATIVE_AMOUNT_SCOPE_MESSAGE}`,
          rowNumber: 9,
          field: 'actualSales',
          columnIndex: 3,
        },
      ])
    }
  })

  it('normalizes repeated spaces and casing for display and duplicate keys', () => {
    const result = validateDataRows([
      dataRow(2, {
        salesperson: '  ADA   lovelace ',
        month: '  JANUARY  ',
        budgetAmount: 100,
        actualSales: 80,
      }),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.records[0]?.salesperson).toBe('ADA lovelace')
      expect(result.records[0]?.month).toBe('JANUARY')
    }
  })

  it('accepts the same person in different months', () => {
    const result = validateDataRows([
      dataRow(2, { salesperson: 'Ada Lovelace', month: 'January' }),
      dataRow(3, { salesperson: 'Ada Lovelace', month: 'February' }),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.records).toHaveLength(2)
    }
  })

  it('rejects duplicate normalized salesperson and month and names both row numbers', () => {
    const result = validateDataRows([
      dataRow(4, {
        salesperson: 'Ada Lovelace',
        month: 'January',
        budgetAmount: 100,
        actualSales: 90,
      }),
      dataRow(7, {
        salesperson: '  ada   LOVELACE  ',
        month: ' JANUARY ',
        budgetAmount: 200,
        actualSales: 150,
      }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'duplicate-salesperson-month',
          message:
            'Rows 4 and 7 have the same salesperson and month.',
          rowNumber: 4,
          otherRowNumber: 7,
          field: 'salesperson',
        },
      ])
    }
  })

  it('never returns partially valid records as a successful result', () => {
    const result = validateDataRows([
      dataRow(2, { budgetAmount: 100, actualSales: 90 }),
      dataRow(3, { budgetAmount: '100abc' }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result).not.toHaveProperty('records')
    }
  })
})
