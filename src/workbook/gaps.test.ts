import { describe, expect, it, vi } from 'vitest'
import { MAX_FILE_SIZE_BYTES } from '../domain/policy'
import { UNREADABLE_WORKBOOK_MESSAGE } from './messages'
import {
  getFileExtension,
  hasExpectedWorkbookSignature,
  readWorkbookFile,
} from './intake'
import * as sheetjs from './sheetjs'
import { createNamedFile, createSalesWorkbookFile, createZipMasqueradingAsXlsx } from '../test/excelFiles'
import { detectSheetStructure, worksheetToRows } from './structure'
import { runWorkbookPipeline } from './pipeline'
import { validateDataRows } from './validateRows'
import type { DetectedDataRow } from './structure'

describe('intake filename and signature edges', () => {
  it('treats a name with no extension as unsupported', async () => {
    const result = await readWorkbookFile(createNamedFile('workbook', 'data'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('unsupported-file-type')
    }
  })

  it('treats a leading-dot name such as .xlsx as unsupported', () => {
    expect(getFileExtension('.xlsx')).toBeUndefined()
  })

  it('rejects .xls bytes that are too short to be an OLE file', async () => {
    const result = await readWorkbookFile(createNamedFile('tiny.xls', 'AB'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe(UNREADABLE_WORKBOOK_MESSAGE)
    }
  })

  it('does not treat a truncated signature as a workbook', () => {
    expect(hasExpectedWorkbookSignature(new Uint8Array([0x50]), '.xlsx')).toBe(
      false,
    )
  })
})

describe('intake parse failures', () => {
  it('uses the generic unreadable message when SheetJS throws', async () => {
    const result = await readWorkbookFile(createZipMasqueradingAsXlsx('bad.xlsx'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe(UNREADABLE_WORKBOOK_MESSAGE)
    }
  })

  it('uses the generic unreadable message when the workbook has no sheets', async () => {
    const spy = vi.spyOn(sheetjs, 'parseExcelArrayBuffer').mockReturnValue({
      SheetNames: [],
      Sheets: {},
    })
    const file = createSalesWorkbookFile('any.xlsx', [['Ada', 'January', 1, 1]])
    const result = await readWorkbookFile(file)
    spy.mockRestore()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe(UNREADABLE_WORKBOOK_MESSAGE)
    }
  })

  it('uses the generic unreadable message when the first sheet is missing', async () => {
    const spy = vi.spyOn(sheetjs, 'parseExcelArrayBuffer').mockReturnValue({
      SheetNames: ['Data'],
      Sheets: {},
    })
    const file = createSalesWorkbookFile('any.xlsx', [['Ada', 'January', 1, 1]])
    const result = await readWorkbookFile(file)
    spy.mockRestore()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe(UNREADABLE_WORKBOOK_MESSAGE)
    }
  })
})

describe('structure conversion edges', () => {
  it('skips metadata keys and cells without a raw value', () => {
    const rows = worksheetToRows({
      '!ref': 'A1:B1',
      A1: { t: 's', v: 'Salesperson' },
      B1: { t: 'z' },
    })
    expect(rows[0]?.cells[0]).toBe('Salesperson')
    expect(rows[0]?.cells[1]).toBeNull()
  })

  it('ignores blank rows between the header and the first record', () => {
    const result = detectSheetStructure({
      A1: { t: 's', v: 'Salesperson' },
      B1: { t: 's', v: 'Month' },
      C1: { t: 's', v: 'Budget' },
      D1: { t: 's', v: 'Actual' },
      A3: { t: 's', v: 'Ada' },
      B3: { t: 's', v: 'January' },
      C3: { t: 'n', v: 10 },
      D3: { t: 'n', v: 10 },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.dataRows[0]?.excelRowNumber).toBe(3)
    }
  })
})

describe('row validation edges', () => {
  const columns = {
    salesperson: 0,
    month: 1,
    budgetAmount: 2,
    actualSales: 3,
  }

  function row(values: DetectedDataRow['values'], excelRowNumber = 4): DetectedDataRow {
    return { excelRowNumber, columnIndexes: columns, values }
  }

  it('rejects a boolean salesperson as invalid text and does not return partial records', () => {
    const result = validateDataRows([
      row({
        salesperson: true,
        month: 'January',
        budgetAmount: 10,
        actualSales: 10,
      }),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('invalid-text')
      expect(result).not.toHaveProperty('records')
    }
  })

  it('rejects an incomplete row that still has Excel numeric amounts', () => {
    const result = validateDataRows([
      row({
        salesperson: 'Ada',
        month: null,
        budgetAmount: 5000,
        actualSales: 4000,
      }),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('Row 4')
      expect(result.issues[0]?.code).toBe('missing-required-value')
    }
  })
})

describe('pipeline size gate', () => {
  it('does not parse when the file is over 10 MB', async () => {
    const file = createNamedFile('big.xlsx', 'x', MAX_FILE_SIZE_BYTES + 1)
    const result = await runWorkbookPipeline(file)
    expect(result.ok).toBe(false)
  })
})
