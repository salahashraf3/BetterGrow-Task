import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { ACCEPTED_HEADER_ALIASES, CANONICAL_FIELD_LABELS } from '../domain/policy'
import type { CanonicalField } from '../domain/types'
import {
  DUPLICATE_HEADER_MAPPING_MESSAGE,
  HEADERS_WITHOUT_RECORDS_MESSAGE,
  NO_DATA_MESSAGE,
  REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
} from './messages'
import {
  detectSheetStructure,
  detectWorksheetStructure,
  worksheetToRows,
  type WorksheetRow,
} from './structure'

const CANONICAL_HEADERS = [
  CANONICAL_FIELD_LABELS.salesperson,
  CANONICAL_FIELD_LABELS.month,
  CANONICAL_FIELD_LABELS.budgetAmount,
  CANONICAL_FIELD_LABELS.actualSales,
] as const

const SAMPLE_RECORD = ['Ada Lovelace', 'January', 1000, 1100] as const

function gridRow(excelRowNumber: number, cells: readonly unknown[]): WorksheetRow {
  return { excelRowNumber, cells }
}

function sheetFromAoa(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows)
}

const REQUIRED_HEADER_ORDER: readonly CanonicalField[] = [
  'salesperson',
  'month',
  'budgetAmount',
  'actualSales',
]

function headersWithAlias(field: CanonicalField, alias: string): string[] {
  return REQUIRED_HEADER_ORDER.map((canonicalField) =>
    canonicalField === field ? alias : CANONICAL_FIELD_LABELS[canonicalField],
  )
}

describe('worksheetToRows', () => {
  it('preserves raw cell values and 1-based Excel row numbers', () => {
    const sheet = sheetFromAoa([
      [...CANONICAL_HEADERS],
      ['Ada', 'January', 2500, 0],
    ])
    const rows = worksheetToRows(sheet)

    expect(rows.map((row) => row.excelRowNumber)).toEqual([1, 2])
    expect(rows[1]?.cells[2]).toBe(2500)
    expect(rows[1]?.cells[3]).toBe(0)
  })
})

describe('detectWorksheetStructure', () => {
  it('reports "No data found." for a completely blank sheet', () => {
    expect(detectWorksheetStructure([])).toEqual({
      ok: false,
      issues: [{ code: 'no-data', message: NO_DATA_MESSAGE }],
    })
    expect(
      detectWorksheetStructure([
        gridRow(1, [null, '', '   ']),
        gridRow(2, [undefined, '']),
      ]),
    ).toEqual({
      ok: false,
      issues: [{ code: 'no-data', message: NO_DATA_MESSAGE }],
    })
    expect(detectSheetStructure(sheetFromAoa([]))).toEqual({
      ok: false,
      issues: [{ code: 'no-data', message: NO_DATA_MESSAGE }],
    })
  })

  it('reports "Required columns not found." for a malformed sheet', () => {
    const result = detectWorksheetStructure([
      gridRow(1, ['Name', 'Amount']),
      gridRow(2, ['Ada', 50]),
    ])

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'header-row-not-found',
          message: REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
        },
      ],
    })
  })

  it('reports "Headers found, but no sales records." for a header-only sheet', () => {
    const result = detectWorksheetStructure([
      gridRow(1, [...CANONICAL_HEADERS]),
    ])

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'no-sales-records',
          message: HEADERS_WITHOUT_RECORDS_MESSAGE,
          rowNumber: 1,
        },
      ],
    })
  })

  it('accepts canonical headers on row 1 and preserves column indexes', () => {
    const result = detectWorksheetStructure([
      gridRow(1, [...CANONICAL_HEADERS]),
      gridRow(2, [...SAMPLE_RECORD]),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.headerRowNumber).toBe(1)
      expect(result.columnIndexes).toEqual({
        salesperson: 0,
        month: 1,
        budgetAmount: 2,
        actualSales: 3,
      })
      expect(result.dataRows).toEqual([
        {
          excelRowNumber: 2,
          columnIndexes: result.columnIndexes,
          values: {
            salesperson: 'Ada Lovelace',
            month: 'January',
            budgetAmount: 1000,
            actualSales: 1100,
          },
        },
      ])
    }
  })

  it('accepts headers on Excel row 20 with a record on row 21', () => {
    const result = detectWorksheetStructure([
      gridRow(20, [...CANONICAL_HEADERS]),
      gridRow(21, [...SAMPLE_RECORD]),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.headerRowNumber).toBe(20)
      expect(result.dataRows[0]?.excelRowNumber).toBe(21)
    }

    const fromSheet = detectSheetStructure(
      sheetFromAoa([
        ...Array.from({ length: 19 }, () => []),
        [...CANONICAL_HEADERS],
        [...SAMPLE_RECORD],
      ]),
    )
    expect(fromSheet.ok).toBe(true)
    if (fromSheet.ok) {
      expect(fromSheet.headerRowNumber).toBe(20)
      expect(fromSheet.dataRows[0]?.excelRowNumber).toBe(21)
    }
  })

  it('rejects headers on Excel row 21', () => {
    const result = detectWorksheetStructure([
      gridRow(21, [...CANONICAL_HEADERS]),
      gridRow(22, [...SAMPLE_RECORD]),
    ])

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'header-row-not-found',
          message: REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
        },
      ],
    })

    const fromSheet = detectSheetStructure(
      sheetFromAoa([
        ...Array.from({ length: 20 }, () => []),
        [...CANONICAL_HEADERS],
        [...SAMPLE_RECORD],
      ]),
    )
    expect(fromSheet).toEqual({
      ok: false,
      issues: [
        {
          code: 'header-row-not-found',
          message: REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
        },
      ],
    })
  })

  it('rejects headers split across rows', () => {
    const result = detectWorksheetStructure([
      gridRow(1, ['Salesperson', 'Month']),
      gridRow(2, ['Budget Amount', 'Actual Sales']),
      gridRow(3, [...SAMPLE_RECORD]),
    ])

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'header-row-not-found',
          message: REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
        },
      ],
    })
  })

  it.each(ACCEPTED_HEADER_ALIASES)(
    'accepts alias "$alias" for $field on the same header row',
    ({ alias, field }) => {
      const result = detectWorksheetStructure([
        gridRow(1, headersWithAlias(field, alias)),
        gridRow(2, [...SAMPLE_RECORD]),
      ])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.columnIndexes[field]).toBe(
          REQUIRED_HEADER_ORDER.indexOf(field),
        )
      }
    },
  )

  it('rejects a header row with two columns mapped to the same canonical field', () => {
    const result = detectWorksheetStructure([
      gridRow(1, [
        'Salesperson',
        'Month',
        'Budget Amount',
        'Actual Sales',
        'Budget',
      ]),
      gridRow(2, [...SAMPLE_RECORD, 5]),
    ])

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'duplicate-header-mapping',
          message: DUPLICATE_HEADER_MAPPING_MESSAGE,
          rowNumber: 1,
          field: 'budgetAmount',
          header: 'Budget',
          columnIndex: 4,
        },
      ],
    })
  })

  it('ignores fully blank rows when detecting data and collecting records', () => {
    const result = detectWorksheetStructure([
      gridRow(1, [null, '', '   ']),
      gridRow(2, [...CANONICAL_HEADERS]),
      gridRow(3, [null, null, null, null]),
      gridRow(4, [...SAMPLE_RECORD]),
      gridRow(5, ['', '  ']),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.headerRowNumber).toBe(2)
      expect(result.dataRows).toHaveLength(1)
      expect(result.dataRows[0]?.excelRowNumber).toBe(4)
    }
  })
})
